CREATE TABLE IF NOT EXISTS guide_rating_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rating_id UUID NOT NULL REFERENCES guide_ratings(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,
  vote INTEGER NOT NULL CHECK (vote IN (-1, 1)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (rating_id, user_email)
);

CREATE INDEX IF NOT EXISTS idx_guide_rating_votes_rating_id ON guide_rating_votes (rating_id);
CREATE INDEX IF NOT EXISTS idx_guide_rating_votes_user_email ON guide_rating_votes (user_email);
