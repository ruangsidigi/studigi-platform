-- SKD CPNS Tryout System Database Schema
-- Run this SQL in Supabase to create all required tables

-- Users table
CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Packages table
CREATE TABLE packages (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(50), -- 'tryout' atau 'latihan'
  price INTEGER,
  question_count INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP
);

-- Questions table
CREATE TABLE questions (
  id BIGSERIAL PRIMARY KEY,
  package_id BIGINT REFERENCES packages(id) ON DELETE CASCADE,
  number INTEGER,
  question_text TEXT NOT NULL,
  option_a TEXT,
  option_b TEXT,
  option_c TEXT,
  option_d TEXT,
  option_e TEXT,
  correct_answer VARCHAR(1),
  explanation TEXT,
  category VARCHAR(50), -- TWK, TIU, TKP
  point_a INTEGER,
  point_b INTEGER,
  point_c INTEGER,
  point_d INTEGER,
  point_e INTEGER,
  image_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP
);

-- Purchases table
CREATE TABLE purchases (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  package_id BIGINT REFERENCES packages(id),
  payment_method VARCHAR(50),
  payment_status VARCHAR(50) DEFAULT 'pending',
  total_price INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tryout sessions table
CREATE TABLE tryout_sessions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  package_id BIGINT REFERENCES packages(id),
  started_at TIMESTAMP,
  finished_at TIMESTAMP,
  status VARCHAR(50), -- 'in_progress', 'completed', 'abandoned'
  twk_score DECIMAL,
  tiu_score DECIMAL,
  tkp_score INTEGER,
  total_score DECIMAL,
  is_passed BOOLEAN,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tryout answers table
CREATE TABLE tryout_answers (
  id BIGSERIAL PRIMARY KEY,
  session_id BIGINT REFERENCES tryout_sessions(id) ON DELETE CASCADE,
  question_id BIGINT REFERENCES questions(id),
  user_answer VARCHAR(1),
  is_correct BOOLEAN,
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_packages_type ON packages(type);
CREATE INDEX idx_questions_package_id ON questions(package_id);
CREATE INDEX idx_questions_category ON questions(category);
CREATE INDEX idx_purchases_user_id ON purchases(user_id);
CREATE INDEX idx_purchases_package_id ON purchases(package_id);
CREATE INDEX idx_tryout_sessions_user_id ON tryout_sessions(user_id);
CREATE INDEX idx_tryout_sessions_package_id ON tryout_sessions(package_id);
CREATE INDEX idx_tryout_answers_session_id ON tryout_answers(session_id);
CREATE INDEX idx_tryout_answers_question_id ON tryout_answers(question_id);

-- Insert sample admin user (password: admin123 hashed with bcrypt)
INSERT INTO users (email, password, name, role) VALUES 
('admin@skdcpns.com', '$2a$10$UgXqNqJ7qZ3EWU8r0aJ5P.YX2W.wjYXGdnF6H6LQq6kH1K8W5pMWC', 'Admin SKD CPNS', 'admin');

-- Insert sample packages
INSERT INTO packages (name, description, type, price, question_count) VALUES 
('Tryout SKD CPNS 1', 'Paket tryout lengkap SKD CPNS simulasi ujian', 'tryout', 50000, 100),
('Tryout SKD CPNS 2', 'Paket tryout kedua dengan soal berbeda', 'tryout', 50000, 100),
('Latihan TWK', 'Paket latihan soal Test Wawasan Kebangsaan', 'latihan', 20000, 80),
('Latihan TIU', 'Paket latihan soal Tes Intelegensi Umum', 'latihan', 20000, 90),
('Latihan TKP', 'Paket latihan soal Tes Karakteristik Pribadi', 'latihan', 20000, 95);
