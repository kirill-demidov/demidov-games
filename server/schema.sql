CREATE TABLE IF NOT EXISTS scores (
  id            BIGSERIAL PRIMARY KEY,
  name          VARCHAR(24) NOT NULL,
  difficulty    VARCHAR(16) NOT NULL CHECK (difficulty IN ('beginner', 'intermediate', 'expert')),
  time_seconds  SMALLINT NOT NULL CHECK (time_seconds >= 0 AND time_seconds <= 999),
  score         INTEGER NOT NULL CHECK (score >= 0 AND score <= 20000),
  opened        SMALLINT NOT NULL CHECK (opened >= 0),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS scores_diff_time_idx
  ON scores (difficulty, time_seconds ASC, created_at ASC);
