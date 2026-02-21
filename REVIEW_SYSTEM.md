# EdTech Review System - Complete Implementation Guide

## Overview

This comprehensive review system provides an edtech-style interface for reviewing attempt questions with:
- Sidebar navigation grid with status indicators
- Full question viewer with highlighting
- Explanation panel
- Bookmark functionality
- Category filtering
- Responsive design

---

## 📊 Database Schema

### Question Bookmarks Table
```sql
CREATE TABLE question_bookmarks (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id BIGINT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  session_id BIGINT REFERENCES tryout_sessions(id) ON DELETE CASCADE,
  notes TEXT,
  bookmarked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, question_id, session_id)
);

CREATE INDEX idx_question_bookmarks_user_id ON question_bookmarks(user_id);
CREATE INDEX idx_question_bookmarks_session_id ON question_bookmarks(session_id);
CREATE INDEX idx_question_bookmarks_question_id ON question_bookmarks(question_id);
```

### Used Tables
- `tryout_sessions` - User attempt sessions
- `tryout_answers` - User answers to questions
- `questions` - Question definitions
- `users` - User accounts

---

## 🔌 API Endpoints

### GET /reviews/attempt/:attemptId
Get all questions for review (for sidebar navigation grid)

**Request:**
```http
GET /reviews/attempt/123 HTTP/1.1
Authorization: Bearer <token>
```

**Response:**
```json
{
  "attempt": {
    "id": 123,
    "totalScore": 75,
    "isPassed": true
  },
  "review": [
    {
      "questionId": 456,
      "questionNumber": 1,
      "category": "TWK",
      "status": "correct",
      "userAnswer": "A",
      "correctAnswer": "A",
      "isBookmarked": true,
      "bookmarkNotes": "Good question"
    },
    {
      "questionId": 457,
      "questionNumber": 2,
      "category": "TIU",
      "status": "incorrect",
      "userAnswer": "B",
      "correctAnswer": "C",
      "isBookmarked": false,
      "bookmarkNotes": null
    }
  ],
  "stats": {
    "total": 100,
    "correct": 75,
    "incorrect": 20,
    "unanswered": 5,
    "bookmarked": 8
  }
}
```

---

### GET /reviews/attempt/:attemptId/question/:questionNumber
Get detailed question data for viewer

**Request:**
```http
GET /reviews/attempt/123/question/1 HTTP/1.1
Authorization: Bearer <token>
```

**Response:**
```json
{
  "questionNumber": 1,
  "questionText": "Apa ibukota Indonesia?",
  "imageUrl": null,
  "category": "TWK",
  "options": [
    { "label": "A", "text": "Jakarta" },
    { "label": "B", "text": "Surabaya" },
    { "label": "C", "text": "Bandung" },
    { "label": "D", "text": "Yogyakarta" }
  ],
  "userAnswer": "A",
  "correctAnswer": "A",
  "isCorrect": true,
  "explanation": "Jakarta adalah ibukota negara Indonesia sejak tahun 1945.",
  "isBookmarked": true,
  "bookmarkNotes": "Important question"
}
```

---

### POST /reviews/attempt/:attemptId/bookmark
Toggle bookmark for a question

**Request:**
```http
POST /reviews/attempt/123/bookmark HTTP/1.1
Authorization: Bearer <token>
Content-Type: application/json

{
  "questionId": 456,
  "notes": "Perlu dipelajari ulang"
}
```

**Response:**
```json
{
  "bookmarked": true
}
```

---

### GET /reviews/attempt/:attemptId/bookmarks
Get all bookmarked questions for a session

**Request:**
```http
GET /reviews/attempt/123/bookmarks HTTP/1.1
Authorization: Bearer <token>
```

**Response:**
```json
{
  "bookmarks": [
    {
      "id": 789,
      "question_id": 456,
      "notes": "Interesting topic",
      "bookmarked_at": "2024-02-19T10:30:00Z",
      "questions": {
        "number": 5,
        "category": "TIU",
        "question_text": "..."
      }
    }
  ]
}
```

---

## 🛠️ Backend Implementation

### Review Service (`reviewService.js`)

```javascript
const reviewService = {
  // Get all questions for review
  getAttemptReview: async (attemptId, userId) => { ... },
  
  // Get detailed question
  getQuestionDetail: async (attemptId, questionNumber, userId) => { ... },
  
  // Toggle bookmark
  toggleBookmark: async (sessionId, questionId, userId, notes) => { ... },
  
  // Get bookmarked questions
  getBookmarkedQuestions: async (sessionId, userId) => { ... }
};
```

**Key Features:**
- Ownership verification (only user's own sessions)
- Automatic status calculation (correct/incorrect/unanswered/partial)
- Bookmark tracking with notes
- Category grouping
- Statistics aggregation

---

### Review Routes (`reviews.js`)

```javascript
router.get('/attempt/:attemptId', authenticateToken, ...);
router.get('/attempt/:attemptId/question/:questionNumber', authenticateToken, ...);
router.post('/attempt/:attemptId/bookmark', authenticateToken, ...);
router.get('/attempt/:attemptId/bookmarks', authenticateToken, ...);
```

---

### SQL Query Patterns

#### Get Review Data
```sql
SELECT 
  a.id,
  a.session_id,
  a.question_id,
  a.user_answer,
  a.is_correct,
  q.id,
  q.number,
  q.category,
  q.correct_answer
FROM tryout_answers a
JOIN questions q ON a.question_id = q.id
WHERE a.session_id = $1
ORDER BY q.number ASC
```

#### Get Question Detail
```sql
SELECT 
  a.user_answer,
  a.is_correct,
  q.id,
  q.number,
  q.question_text,
  q.option_a,
  q.option_b,
  q.option_c,
  q.option_d,
  q.option_e,
  q.correct_answer,
  q.explanation,
  q.category,
  q.image_url
FROM tryout_answers a
JOIN questions q ON a.question_id = q.id
WHERE a.session_id = $1 AND q.number = $2
```

#### Toggle Bookmark
```sql
-- Check existing
SELECT id FROM question_bookmarks 
WHERE user_id = $1 AND question_id = $2 AND session_id = $3

-- Delete or Insert based on result
DELETE FROM question_bookmarks WHERE id = $1;
INSERT INTO question_bookmarks (...) VALUES (...);
```

---

## 🎨 Frontend Components

### ReviewPage.js
Main page component handling:
- Question loading and filtering
- State management
- Navigation logic
- Bookmark toggle

**State Management:**
```javascript
const [reviewData, setReviewData] = useState(null);
const [currentQuestion, setCurrentQuestion] = useState(null);
const [questionDetail, setQuestionDetail] = useState(null);
const [showExplanation, setShowExplanation] = useState(true);
const [selectedFilter, setSelectedFilter] = useState('all');
const [bookmarkedQuestions, setBookmarkedQuestions] = useState(new Set());
```

**Features:**
- Automatic first question load
- Question navigation (prev/next)
- Bookmark optimization (optimistic update)
- Error handling
- Loading states

---

### QuestionSidebar.js
Navigation grid with:
- Filter tabs (All, Correct, Incorrect, Unanswered, Bookmarked)
- Question button grid grouped by category
- Status indicators with emojis
- Summary statistics

**Props:**
```javascript
{
  questions,           // Filtered question array
  currentQuestion,     // Current selected question number
  selectedFilter,      // Current active filter
  onSelectQuestion,    // Callback on question select
  onFilterChange,      // Callback on filter change
  stats,              // Statistics object
  bookmarkedQuestions // Set of bookmarked question IDs
}
```

---

### QuestionViewer.js
Question display with:
- Full question text
- Image support
- Answer options with color coding:
  - 🟢 Green: Correct answer (when user is wrong)
  - 🔵 Blue: User answered correctly
  - 🔴 Red: User answered incorrectly
- Answer summary
- Bookmark button
- Status indicator
- Legend

**Props:**
```javascript
{
  question,              // Question detail object
  isBookmarked,         // Bookmark status
  onToggleBookmark,     // Bookmark toggle callback
  showExplanation       // Explanation visibility
}
```

---

## 🎯 Navigation Logic

### Filter Logic
```javascript
const getFilteredQuestions = useCallback(() => {
  const questions = reviewData.review;
  
  switch (selectedFilter) {
    case 'correct':
      return questions.filter(q => q.status === 'correct');
    case 'incorrect':
      return questions.filter(q => q.status === 'incorrect');
    case 'unanswered':
      return questions.filter(q => q.status === 'unanswered');
    case 'bookmarked':
      return questions.filter(q => q.isBookmarked);
    default:
      return questions;
  }
}, [reviewData, selectedFilter]);
```

### Question Selection Flow
1. User clicks question in sidebar
2. `loadQuestion(questionNumber)` is called
3. API fetches question detail
4. `setQuestionDetail()` updates viewer
5. `setCurrentQuestion()` highlights in sidebar

### Bookmark Toggle Flow
1. User clicks bookmark button
2. Optimistic UI update
3. API call to toggle
4. Revert if fails
5. Update review data stats

---

## 📱 Responsive Design

### Breakpoints
- **Desktop (1024px+):** 280px sidebar + full content
- **Tablet (768px):** 240px sidebar + content
- **Mobile (480px):** Single column, horizontal filter tabs

### Mobile Optimizations
- Collapsible filter tabs
- Smaller question buttons (32px)
- Vertical navigation buttons
- Touch-friendly spacing
- Scrollable sidebar

---

## 🔐 Security

### Authentication
- All endpoints require JWT token
- `authenticateToken` middleware validates user
- Ownership verification in service functions

### Authorization
- Users can only review their own attempts
- Review data filtered by `user_id`
- Bookmarks tied to user and session

---

## 🚀 Performance Optimizations

1. **Optimistic Updates:** Immediate UI feedback for bookmarks
2. **Lazy Loading:** Question detail loaded on demand
3. **Set-based Bookmarks:** O(1) lookup time
4. **Category Grouping:** Efficient grid organization
5. **Memoized Callbacks:** Prevent unnecessary renders

---

## 📋 Usage Example

### Access Review Page
```javascript
// From Reports page, click attempt
navigate(`/review/${attemptId}`);

// URL: http://localhost:3000/review/123
```

### User Flow
1. User completes attempt
2. User clicks "Lihat Review" in Reports
3. Review page loads with sidebar grid
4. User filters by status or category
5. User clicks question number
6. Question detail loads
7. User toggles bookmark
8. User navigates to previous/next question
9. User toggles explanation visibility

---

## 🎓 Status Colors

| Status | Color | Emoji | Meaning |
|--------|-------|-------|---------|
| Correct | 🟢 Green | ✓ | Answered correctly |
| Incorrect | 🔴 Red | ✗ | Answered incorrectly |
| Unanswered | 🟡 Orange | ○ | Not answered |
| Partial | 🟣 Purple | ~ | Category without score (TKP) |

---

## 🔍 Debugging

### Common Issues

**Question not loading:**
```javascript
// Check endpoint response
GET /reviews/attempt/123/question/1

// Verify question exists in attempt
GET /reviews/attempt/123
```

**Bookmark not saving:**
```javascript
// Check question_bookmarks table
SELECT * FROM question_bookmarks 
WHERE user_id = 1 AND session_id = 123
```

**Filter showing no results:**
```javascript
// Verify filter logic matches status values
// Status values: 'correct', 'incorrect', 'unanswered', 'partial'
```

---

## 📚 Related Documentation

- Backend: `/backend/README.md`
- Frontend: `/frontend/README.md`
- Database: `/database_schema.sql`

---

## ✅ Checklist

- [x] Database migration (question_bookmarks table)
- [x] Review service implementation
- [x] API routes and endpoints
- [x] Frontend page component
- [x] Sidebar component
- [x] Question viewer component
- [x] CSS styling (all responsive)
- [x] State management
- [x] Navigation logic
- [x] Bookmark functionality
- [x] Filter implementation
- [x] Error handling
- [x] Loading states
- [x] Security checks
- [x] Documentation

