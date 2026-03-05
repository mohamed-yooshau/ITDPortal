import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../api";
import StepGuide from "../components/StepGuide";

type Guide = {
  id: number;
  title: string;
  subtitle?: string;
  description?: string;
  type: "step" | "knowledge" | "video";
  body?: string;
  videoUrl?: string;
  steps: Array<{ id: string; title: string; content: string; imageUrl?: string }>;
};

type RatingSummary = {
  count: number;
  avg: number;
};

type RatingComment = {
  id: string;
  user_name: string;
  rating: number;
  comment: string;
  created_at: string;
  upVotes?: number;
  downVotes?: number;
  userVote?: number;
};

type UserRating = {
  rating: number;
  comment?: string | null;
};

export default function GuideDetail() {
  const { id } = useParams();
  const [guide, setGuide] = useState<Guide | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ratingsLoading, setRatingsLoading] = useState(true);
  const [summary, setSummary] = useState<RatingSummary | null>(null);
  const [comments, setComments] = useState<RatingComment[]>([]);
  const [userRating, setUserRating] = useState<UserRating | null>(null);
  const [ratingValue, setRatingValue] = useState(0);
  const [commentValue, setCommentValue] = useState("");
  const [savingRating, setSavingRating] = useState(false);
  const [ratingError, setRatingError] = useState("");

  useEffect(() => {
    api
      .get(`/guides/${id}`)
      .then((res) => setGuide(res.data.guide))
      .catch((err) => setError(err.response?.data?.error || "Unable to load guide."))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    setRatingsLoading(true);
    api
      .get(`/guides/${id}/ratings`)
      .then((res) => {
        setSummary(res.data.summary || null);
        setComments(Array.isArray(res.data.comments) ? res.data.comments : []);
        setUserRating(res.data.userRating || null);
        if (res.data.userRating?.rating) {
          setRatingValue(res.data.userRating.rating);
          setCommentValue(res.data.userRating.comment || "");
        }
      })
      .catch(() => {
        setSummary(null);
        setComments([]);
      })
      .finally(() => setRatingsLoading(false));
  }, [id]);

  if (loading) {
    return (
      <section className="card">
        <div className="panel">Loading guide...</div>
      </section>
    );
  }

  if (error || !guide) {
    return (
      <section className="card">
        <div className="panel">{error || "Guide not found."}</div>
      </section>
    );
  }

  return (
    <section className="card">
      <Link to="/guides" className="back-link">
        ← Back to Guides
      </Link>
      <div className="guide-wrapper">
        {(!guide.type || guide.type === "step") && (
          <StepGuide title={guide.title} subtitle={guide.subtitle} steps={guide.steps} />
        )}
        {guide.type === "knowledge" && (
          <div className="guide-article">
            <div className="guide-article-header">
              <h2>{guide.title}</h2>
              {guide.subtitle && <p className="muted">{guide.subtitle}</p>}
            </div>
            <div
              className="guide-html"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(guide.body || "") }}
            />
          </div>
        )}
        {guide.type === "video" && (
          <div className="guide-video">
            <div className="guide-article-header">
              <h2>{guide.title}</h2>
              {(guide.subtitle || guide.description) && (
                <p className="muted">{guide.subtitle || guide.description}</p>
              )}
            </div>
            {guide.videoUrl ? (
              <div className="guide-video-frame">
                <iframe
                  src={guide.videoUrl}
                  title={guide.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : (
              <div className="panel">Video unavailable.</div>
            )}
          </div>
        )}
      </div>
      <div className="panel guide-feedback">
        <div className="guide-feedback-header">
          <div>
            <h3>Rate this guide</h3>
            <p className="muted">Help us improve future guides by leaving a quick rating.</p>
          </div>
          {summary && (
            <div className="guide-rating-summary">
              <div className="rating-score">{summary.avg.toFixed(1)}</div>
              <div className="muted">{summary.count} ratings</div>
            </div>
          )}
        </div>
        <div className="guide-rating-stars">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              className={`rating-star ${ratingValue >= value ? "active" : ""}`}
              onClick={() => setRatingValue(value)}
              aria-label={`Rate ${value} star`}
            >
              ★
            </button>
          ))}
        </div>
        <textarea
          className="rating-input"
          placeholder={ratingValue > 0 && ratingValue <= 3 ? "Please add a short comment" : "Add a comment (optional)"}
          value={commentValue}
          onChange={(event) => setCommentValue(event.target.value)}
          rows={3}
        />
        {ratingError && <div className="error-text">{ratingError}</div>}
        <div className="rating-actions">
          <button
            className="btn primary"
            type="button"
            disabled={savingRating || ratingValue === 0}
            onClick={async () => {
              if (!id) return;
              if (ratingValue <= 3 && commentValue.trim().length === 0) {
                setRatingError("Please add a comment when rating 3 stars or less.");
                return;
              }
              setSavingRating(true);
              setRatingError("");
              try {
                await api.post(`/guides/${id}/ratings`, {
                  rating: ratingValue,
                  comment: commentValue
                });
                setUserRating({ rating: ratingValue, comment: commentValue });
                const refreshed = await api.get(`/guides/${id}/ratings`);
                setSummary(refreshed.data.summary || null);
                setComments(Array.isArray(refreshed.data.comments) ? refreshed.data.comments : []);
              } catch (err: any) {
                setRatingError(err.response?.data?.error || "Unable to save rating.");
              } finally {
                setSavingRating(false);
              }
            }}
          >
            {savingRating ? "Saving..." : userRating ? "Update rating" : "Submit rating"}
          </button>
        </div>
        <div className="guide-comments">
          <h4>Comments</h4>
          {ratingsLoading ? (
            <div className="muted">Loading comments...</div>
          ) : comments.length === 0 ? (
            <div className="muted">No comments yet.</div>
          ) : (
            <div className="guide-comment-list">
              {comments.map((comment) => (
                <div key={comment.id} className="guide-comment">
                  <div className="comment-head">
                    <span className="comment-name">{comment.user_name}</span>
                    <span className="comment-rating">{comment.rating}/5</span>
                  </div>
                  <div className="comment-body">{comment.comment}</div>
                  <div className="comment-actions">
                    <button
                      className={`vote-btn ${comment.userVote === 1 ? "active" : ""}`}
                      type="button"
                      onClick={async () => {
                        if (!id) return;
                        const nextVote = comment.userVote === 1 ? 1 : 1;
                        const res = await api.post(`/guides/${id}/ratings/${comment.id}/vote`, {
                          vote: nextVote
                        });
                        setComments((prev) =>
                          prev.map((item) =>
                            item.id === comment.id
                              ? {
                                  ...item,
                                  upVotes: res.data.upVotes,
                                  downVotes: res.data.downVotes,
                                  userVote: res.data.userVote
                                }
                              : item
                          )
                        );
                      }}
                    >
                      👍 {comment.upVotes || 0}
                    </button>
                    <button
                      className={`vote-btn ${comment.userVote === -1 ? "active" : ""}`}
                      type="button"
                      onClick={async () => {
                        if (!id) return;
                        const nextVote = comment.userVote === -1 ? -1 : -1;
                        const res = await api.post(`/guides/${id}/ratings/${comment.id}/vote`, {
                          vote: nextVote
                        });
                        setComments((prev) =>
                          prev.map((item) =>
                            item.id === comment.id
                              ? {
                                  ...item,
                                  upVotes: res.data.upVotes,
                                  downVotes: res.data.downVotes,
                                  userVote: res.data.userVote
                                }
                              : item
                          )
                        );
                      }}
                    >
                      👎 {comment.downVotes || 0}
                    </button>
                  </div>
                  <div className="comment-date muted">
                    {new Date(comment.created_at).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function sanitizeHtml(input: string): string {
  if (!input) return "";
  const parser = new DOMParser();
  const doc = parser.parseFromString(input, "text/html");
  const blockedTags = ["script", "style", "iframe", "object", "embed"];
  blockedTags.forEach((tag) => doc.querySelectorAll(tag).forEach((node) => node.remove()));
  doc.querySelectorAll("*").forEach((node) => {
    [...node.attributes].forEach((attr) => {
      const name = attr.name.toLowerCase();
      if (name.startsWith("on")) {
        node.removeAttribute(attr.name);
      }
      if (name === "style") {
        const allowed = attr.value
          .split(";")
          .map((item) => item.trim())
          .filter((item) => {
            const [prop] = item.split(":");
            const key = prop?.trim().toLowerCase();
            return key === "color" || key === "background-color" || key === "text-align";
          })
          .join("; ");
        if (allowed) {
          node.setAttribute("style", allowed);
        } else {
          node.removeAttribute("style");
        }
      }
      if (name === "href" && (node as HTMLAnchorElement).href?.startsWith("javascript:")) {
        node.removeAttribute(attr.name);
      }
    });
  });
  return doc.body.innerHTML;
}
