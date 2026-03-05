import { Router } from "express";
import path from "path";
import { requireAuth, AuthedRequest } from "../middleware/auth.js";
import { logAuditEvent } from "../utils/audit.js";
import { listPublishedGuides, getGuide } from "../stores/guidesStore.js";
import pool from "../db.js";

const MAX_COMMENT_LENGTH = 2000;

const router = Router();
const GUIDE_UPLOAD_DIR = "/uploads/guides";

const normalizeImageUrl = (value?: string) => {
  if (!value) return undefined;
  if (value.startsWith("/api/guides/images/")) return value;
  if (
    value.startsWith("/admin/uploads/guides/") ||
    value.startsWith("/uploads/guides/") ||
    value.startsWith("/api/uploads/guides/")
  ) {
    const filename = path.basename(value);
    return `/api/guides/images/${filename}`;
  }
  return value;
};

const normalizeGuide = (guide: ReturnType<typeof getGuide>) => {
  if (!guide) return guide;
  return {
    ...guide,
    steps: guide.steps.map((step) => ({
      ...step,
      imageUrl: normalizeImageUrl(step.imageUrl)
    }))
  };
};

router.use(requireAuth);

router.get("/", (_req, res) => {
  const guides = listPublishedGuides().map((guide) => normalizeGuide(guide));
  res.json({ guides });
});

router.get("/images/:filename", (req, res) => {
  const filename = path.basename(req.params.filename || "");
  if (!filename) {
    res.status(400).json({ error: "Invalid filename" });
    return;
  }
  const filePath = path.join(GUIDE_UPLOAD_DIR, filename);
  res.sendFile(filePath, (err) => {
    if (err) {
      res.status(404).json({ error: "File not found" });
    }
  });
});

router.get("/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid guide id" });
    return;
  }
  const guide = getGuide(id);
  if (!guide || !guide.published) {
    res.status(404).json({ error: "Guide not found" });
    return;
  }
  res.json({ guide: normalizeGuide(guide) });
});

router.get("/:id/ratings", async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid guide id" });
    return;
  }
  const guide = getGuide(id);
  if (!guide || !guide.published) {
    res.status(404).json({ error: "Guide not found" });
    return;
  }

  try {
    const summaryResult = await pool.query(
      "SELECT COUNT(*)::int AS count, COALESCE(AVG(rating), 0)::float AS avg FROM guide_ratings WHERE guide_id = $1",
      [String(id)]
    );
    const commentsResult = await pool.query(
      "SELECT id, user_name, rating, comment, created_at FROM guide_ratings WHERE guide_id = $1 AND comment IS NOT NULL AND comment <> '' ORDER BY created_at DESC LIMIT 50",
      [String(id)]
    );
    const userEmail = req.user?.email?.toLowerCase();
    const commentIds = commentsResult.rows.map((row) => row.id);
    const votesByComment: Record<string, { up: number; down: number }> = {};
    const userVotes: Record<string, number> = {};
    if (commentIds.length) {
      const voteTotals = await pool.query(
        `SELECT rating_id,
                SUM(CASE WHEN vote = 1 THEN 1 ELSE 0 END)::int AS up,
                SUM(CASE WHEN vote = -1 THEN 1 ELSE 0 END)::int AS down
         FROM guide_rating_votes
         WHERE rating_id = ANY($1)
         GROUP BY rating_id`,
        [commentIds]
      );
      voteTotals.rows.forEach((row) => {
        votesByComment[row.rating_id] = { up: row.up || 0, down: row.down || 0 };
      });
      if (userEmail) {
        const userVoteRows = await pool.query(
          "SELECT rating_id, vote FROM guide_rating_votes WHERE rating_id = ANY($1) AND user_email = $2",
          [commentIds, userEmail]
        );
        userVoteRows.rows.forEach((row) => {
          userVotes[row.rating_id] = row.vote;
        });
      }
    }
    let userRating = null;
    if (userEmail) {
      const userResult = await pool.query(
        "SELECT rating, comment FROM guide_ratings WHERE guide_id = $1 AND user_email = $2 LIMIT 1",
        [String(id), userEmail]
      );
      userRating = userResult.rows[0] || null;
    }
    res.json({
      summary: summaryResult.rows[0],
      comments: commentsResult.rows.map((row) => ({
        ...row,
        upVotes: votesByComment[row.id]?.up || 0,
        downVotes: votesByComment[row.id]?.down || 0,
        userVote: userVotes[row.id] || 0
      })),
      userRating
    });
  } catch (error) {
    console.error("Guide ratings fetch failed", error);
    res.status(500).json({ error: "Failed to load ratings" });
  }
});

router.post("/:id/ratings", async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid guide id" });
    return;
  }
  const guide = getGuide(id);
  if (!guide || !guide.published) {
    res.status(404).json({ error: "Guide not found" });
    return;
  }
  const userEmail = req.user?.email?.toLowerCase();
  const userName = req.user?.name || userEmail || "User";
  if (!userEmail) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const rating = Number(req.body?.rating);
  const commentRaw = typeof req.body?.comment === "string" ? req.body.comment.trim() : "";
  const comment = commentRaw ? commentRaw.slice(0, MAX_COMMENT_LENGTH) : null;

  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    res.status(400).json({ error: "Rating must be between 1 and 5" });
    return;
  }
  if (rating <= 3 && !comment) {
    res.status(400).json({ error: "Please add a comment when rating 3 stars or less." });
    return;
  }

  try {
    const result = await pool.query(
      `INSERT INTO guide_ratings (id, guide_id, user_email, user_name, rating, comment)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)
       ON CONFLICT (guide_id, user_email)
       DO UPDATE SET rating = EXCLUDED.rating, comment = EXCLUDED.comment, updated_at = NOW()
       RETURNING id, guide_id, user_name, rating, comment, created_at, updated_at`,
      [String(id), userEmail, userName, rating, comment]
    );
    res.json({ rating: result.rows[0] });
    logAuditEvent(
      {
        action: "user.guide.rating",
        resource: `guides:${id}`,
        metadata: { rating, hasComment: Boolean(comment) }
      },
      req,
      req.user
    );
  } catch (error) {
    console.error("Guide rating save failed", error);
    res.status(500).json({ error: "Failed to save rating" });
  }
});

router.post("/:id/ratings/:ratingId/vote", async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const ratingId = String(req.params.ratingId || "");
  if (!Number.isFinite(id) || !ratingId) {
    res.status(400).json({ error: "Invalid guide or rating id" });
    return;
  }
  const vote = Number(req.body?.vote);
  if (![1, -1].includes(vote)) {
    res.status(400).json({ error: "Vote must be 1 or -1" });
    return;
  }
  const userEmail = req.user?.email?.toLowerCase();
  if (!userEmail) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const ratingCheck = await pool.query(
      "SELECT id FROM guide_ratings WHERE id = $1 AND guide_id = $2",
      [ratingId, String(id)]
    );
    if (!ratingCheck.rowCount) {
      res.status(404).json({ error: "Rating not found" });
      return;
    }
    await pool.query(
      `INSERT INTO guide_rating_votes (rating_id, user_email, vote)
       VALUES ($1, $2, $3)
       ON CONFLICT (rating_id, user_email)
       DO UPDATE SET vote = EXCLUDED.vote, created_at = NOW()`,
      [ratingId, userEmail, vote]
    );
    const totals = await pool.query(
      `SELECT
         SUM(CASE WHEN vote = 1 THEN 1 ELSE 0 END)::int AS up,
         SUM(CASE WHEN vote = -1 THEN 1 ELSE 0 END)::int AS down
       FROM guide_rating_votes
       WHERE rating_id = $1`,
      [ratingId]
    );
    res.json({
      ratingId,
      upVotes: totals.rows[0]?.up || 0,
      downVotes: totals.rows[0]?.down || 0,
      userVote: vote
    });
    logAuditEvent(
      {
        action: "user.guide.vote",
        resource: `guide_ratings:${ratingId}`,
        metadata: { vote }
      },
      req,
      req.user
    );
  } catch (error) {
    console.error("Guide rating vote failed", error);
    res.status(500).json({ error: "Failed to save vote" });
  }
});

export default router;
