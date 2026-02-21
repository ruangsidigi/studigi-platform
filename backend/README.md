# SKD CPNS Tryout Backend

Backend untuk sistem tryout SKD CPNS dengan Node.js dan Express.

## Requirements

- Node.js v14 or higher
- npm

## Installation

```bash
cd backend
npm install
```

## Configuration

Copy `.env.example` ke `.env` dan isi dengan kredensial Supabase Anda:

```bash
cp .env.example .env
```

Edit `.env`:
- `SUPABASE_URL`: URL Supabase project Anda
- `SUPABASE_KEY`: Anon key Supabase
- `JWT_SECRET`: Secret key untuk JWT (ganti dengan string random yang kuat)
- `PORT`: Port server (default: 5000)

## Database Schema

Jalankan SQL ini di Supabase untuk setup database:

```sql
-- Users table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Packages table
CREATE TABLE packages (
  id SERIAL PRIMARY KEY,
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
  id SERIAL PRIMARY KEY,
  package_id INTEGER REFERENCES packages(id),
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
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  package_id INTEGER REFERENCES packages(id),
  payment_method VARCHAR(50),
  payment_status VARCHAR(50) DEFAULT 'pending',
  total_price INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tryout sessions table
CREATE TABLE tryout_sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  package_id INTEGER REFERENCES packages(id),
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
  id SERIAL PRIMARY KEY,
  session_id INTEGER REFERENCES tryout_sessions(id),
  question_id INTEGER REFERENCES questions(id),
  user_answer VARCHAR(1),
  is_correct BOOLEAN,
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Running

### Development mode with auto-reload:
```bash
npm run dev
```

### Production mode:
```bash
npm start
```

Server akan berjalan di `http://localhost:5000`

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register user
- `POST /api/auth/login` - Login user
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password

### Packages
- `GET /api/packages` - Get all packages
- `GET /api/packages/:id` - Get package details
- `POST /api/packages` - Create package (admin)
- `PUT /api/packages/:id` - Update package (admin)
- `DELETE /api/packages/:id` - Delete package (admin)

### Questions
- `GET /api/questions/package/:packageId` - Get questions by package
- `GET /api/questions/:id` - Get question details
- `POST /api/questions/upload` - Upload questions from Excel (admin)
- `PUT /api/questions/:id` - Update question (admin)
- `DELETE /api/questions/:id` - Delete question (admin)

### Tryouts
- `POST /api/tryouts/start` - Start tryout session
- `POST /api/tryouts/submit-answer` - Submit answer
- `POST /api/tryouts/finish` - Finish tryout and calculate score
- `GET /api/tryouts/:sessionId/results` - Get session results with explanations

### Purchases
- `GET /api/purchases` - Get user purchases
- `POST /api/purchases` - Create purchase
- `GET /api/purchases/admin/all` - Get all purchases (admin)

### Users
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update user profile

### Admin
- `GET /api/admin/stats` - Get dashboard stats (admin)
- `GET /api/admin/users` - Get all users (admin)
- `GET /api/admin/tryout-results` - Get all tryout results (admin)

## Features

- ✅ User authentication dengan JWT
- ✅ Role-based access control (admin/user)
- ✅ Package management
- ✅ Question management with Excel import
- ✅ Tryout sessions with timer support
- ✅ Scoring system (TWK, TIU, TKP separate)
- ✅ Purchase tracking
- ✅ Admin dashboard
- ✅ Password reset functionality
