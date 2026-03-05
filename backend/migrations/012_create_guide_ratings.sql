CREATE TABLE IF NOT EXISTS guide_ratings (
  id UUID PRIMARY KEY,
  guide_id TEXT NOT NULL,
  user_email TEXT NOT NULL,
  user_name TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (guide_id, user_email)
);

CREATE INDEX IF NOT EXISTS idx_guide_ratings_guide_id ON guide_ratings (guide_id);
CREATE INDEX IF NOT EXISTS idx_guide_ratings_user_email ON guide_ratings (user_email);
