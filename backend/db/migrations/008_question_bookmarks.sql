-- Question Bookmarks Table
-- Allows users to bookmark specific questions from attempt reviews

CREATE TABLE IF NOT EXISTS question_bookmarks (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id BIGINT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  session_id BIGINT REFERENCES tryout_sessions(id) ON DELETE CASCADE,
  notes TEXT,
  bookmarked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, question_id, session_id)
);

-- Index for faster queries
CREATE INDEX idx_question_bookmarks_user_id ON question_bookmarks(user_id);
CREATE INDEX idx_question_bookmarks_session_id ON question_bookmarks(session_id);
CREATE INDEX idx_question_bookmarks_question_id ON question_bookmarks(question_id);
