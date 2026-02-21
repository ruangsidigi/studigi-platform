-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create packages table
CREATE TABLE IF NOT EXISTS packages (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(50) NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  question_count INT DEFAULT 100,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create questions table
CREATE TABLE IF NOT EXISTS questions (
  id BIGSERIAL PRIMARY KEY,
  package_id BIGINT NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
  number INT NOT NULL,
  question_text TEXT NOT NULL,
  option_a TEXT NOT NULL,
  option_b TEXT NOT NULL,
  option_c TEXT NOT NULL,
  option_d TEXT NOT NULL,
  option_e TEXT NOT NULL,
  correct_answer VARCHAR(1) NOT NULL,
  explanation TEXT,
  category VARCHAR(20),
  point_a INT DEFAULT 0,
  point_b INT DEFAULT 0,
  point_c INT DEFAULT 0,
  point_d INT DEFAULT 0,
  point_e INT DEFAULT 0,
  image_url VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create purchases table
CREATE TABLE IF NOT EXISTS purchases (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  package_id BIGINT NOT NULL REFERENCES packages(id),
  payment_method VARCHAR(50),
  payment_status VARCHAR(50) DEFAULT 'completed',
  total_price DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create tryout_sessions table
CREATE TABLE IF NOT EXISTS tryout_sessions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  package_id BIGINT NOT NULL REFERENCES packages(id),
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  finished_at TIMESTAMP,
  status VARCHAR(50) DEFAULT 'active',
  twk_score DECIMAL(5, 2),
  tiu_score DECIMAL(5, 2),
  tkp_score INT,
  total_score DECIMAL(5, 2),
  is_passed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create tryout_answers table
CREATE TABLE IF NOT EXISTS tryout_answers (
  id BIGSERIAL PRIMARY KEY,
  session_id BIGINT NOT NULL REFERENCES tryout_sessions(id) ON DELETE CASCADE,
  question_id BIGINT NOT NULL REFERENCES questions(id),
  user_answer VARCHAR(1),
  is_correct BOOLEAN,
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_questions_package ON questions(package_id);
CREATE INDEX IF NOT EXISTS idx_purchases_user ON purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_purchases_package ON purchases(package_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON tryout_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_package ON tryout_sessions(package_id);
CREATE INDEX IF NOT EXISTS idx_answers_session ON tryout_answers(session_id);
CREATE INDEX IF NOT EXISTS idx_answers_question ON tryout_answers(question_id);

-- Insert sample admin user with hashed password (admin123)
-- Password hash: $2a$10$YIjlrVyVyUVlVyVlVTQyAuVl5VyVyVlVyVyV5VyVyVyVyVT
-- Using bcryptjs generated hash for: admin123
INSERT INTO users (email, password, name, role) 
VALUES ('admin@skdcpns.com', '$2a$10$YIjlrVyVyUVlVyVlVTQyAuVl5VyVyVlVyVyV5VyVyVyVyVT', 'Admin CPNS', 'admin')
ON CONFLICT (email) DO NOTHING;

-- Insert sample packages
INSERT INTO packages (name, description, type, price, question_count) VALUES
('Paket Tryout Full 1', 'Paket tryout lengkap dengan 100 soal', 'tryout', 50000.00, 100),
('Paket Tryout Full 2', 'Paket tryout lengkap dengan 100 soal edisi revisi', 'tryout', 50000.00, 100),
('Latihan TWK', 'Paket latihan soal TWK 50 soal', 'latihan', 20000.00, 50),
('Latihan TIU', 'Paket latihan soal TIU 50 soal', 'latihan', 20000.00, 50),
('Latihan TKP', 'Paket latihan soal TKP 50 soal', 'latihan', 20000.00, 50)
ON CONFLICT DO NOTHING;
