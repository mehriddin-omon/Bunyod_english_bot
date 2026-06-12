# Backend Prompt — ilova (English Learning App)

## Stack

NestJS + TypeORM + PostgreSQL + JWT

Port: **2003**
Base path: `/api/v1`

---

## Auth

### POST /api/v1/auth/register
```json
Body: { "email": "string", "password": "string", "firstName": "string", "lastName": "string" }
Response: { "statusCode": 201, "message": "...", "data": { "accessToken": "...", "refreshToken": "...", "user": { ...User } } }
```

### POST /api/v1/auth/login
```json
Body: { "username": "string", "password": "string" }
Response: { "statusCode": 200, "message": "...", "data": { "accessToken": "...", "refreshToken": "...", "user": { ...User } } }
```

### POST /api/v1/auth/logout
Requires Bearer token. Invalidate refresh token.

### GET /api/v1/auth/me
Requires Bearer token.
```json
Response: { "id": "uuid", "firstName": "string", "lastName": "string", "username": "string", "phone": "string", "role": "student|teacher|sub_teacher|admin", "cefrLevel": "string|null" }
```

### POST /api/v1/auth/refresh
```json
Body: { "refreshToken": "string" }
Response: { "data": { "accessToken": "...", "refreshToken": "..." } }
```

---

## User Entity

```
id          UUID (PK)
firstName   string
lastName    string
username    string (unique)
email       string (unique)
phone       string (nullable)
password    string (hashed with bcrypt)
role        enum: student | teacher | sub_teacher | admin  (default: student)
cefrLevel   string (nullable)  // A1, A2, B1, B2, C1, C2
createdAt   timestamp
```

---

## Sections

Each section is a unit (bo'lim) containing 20 lessons.

### Section Entity
```
id              UUID (PK)
number          int (1..6)
title           string  // e.g. "Asoslar va tanishuv"
totalLessons    int (computed or stored)
order           int
isPublished     boolean
```

### GET /api/v1/sections
Requires Bearer token. Returns sections with per-user progress.
```json
Response: [
  {
    "id": "uuid",
    "number": 1,
    "title": "Asoslar va tanishuv",
    "totalLessons": 20,
    "completedLessons": 20,
    "status": "completed"   // "completed" | "active" | "available" | "locked"
  },
  ...
]
```

**Status logic (per user):**
- `completed` — completedLessons === totalLessons
- `active` — user has started but not finished (completedLessons > 0 && < totalLessons)
- `available` — previous section is completed but user hasn't started this one
- `locked` — previous section is not completed

### GET /api/v1/sections/:id
Returns single section with user progress (same shape as one item above).

### GET /api/v1/sections/:id/lessons
Returns lessons in a section with per-user status.
```json
Response: [
  {
    "id": "uuid",
    "sectionId": "uuid",
    "number": "3.9",         // "{section.number}.{lesson.order}"
    "title": "Past Simple — yasalishi va qoidalar",
    "type": "Grammar",       // "Grammar" | "Reading" | "Listening" | "Vocabulary" | "Test"
    "duration": 12,          // minutes
    "status": "completed"    // "completed" | "active" | "locked"
  },
  ...
]
```

**Status logic (per user):**
- `completed` — user has progress record for this lesson
- `active` — the first lesson after all completed ones (currently in progress)
- `locked` — not yet reached

---

## Lessons

### Lesson Entity
```
id          UUID (PK)
sectionId   UUID (FK → Section)
title       string
type        enum: Grammar | Reading | Listening | Vocabulary | Test
duration    int (minutes)
order       int  // within section (1..20)
number      string  // computed: "{section.number}.{order}" e.g. "3.9"
isPublished boolean
```

### GET /api/v1/lessons/:id/content
Returns full lesson content (grammar rules, reading text, vocabulary).
```json
Response: {
  "id": "uuid",
  "title": "Past Simple",
  "sectionId": "uuid",
  "sectionNumber": 3,
  "sectionTitle": "Grammatika asoslari",
  "number": "3.9",
  "type": "Grammar",
  "grammar": {
    "description": "O'tgan zamonda yakunlangan harakatlarni ifodalovchi zamon.",
    "formula": [
      { "text": "Subject", "isBox": true },
      { "text": "+" },
      { "text": "Verb", "isBox": true, "sub": "past" },
      { "text": "+" },
      { "text": "Object", "isBox": true }
    ],
    "examples": [
      { "en": "I watched a film yesterday.", "uz": "Men kecha film ko'rdim.", "verb": "watched" },
      { "en": "We didn't go to school.", "uz": "Biz maktabga bormadik.", "verb": "didn't go", "isNegative": true }
    ],
    "rules": [
      { "title": "Regular fe'llar", "desc": "-ed qo'shimchasi:", "example": "work → worked, play → played" }
    ]
  },
  "reading": {
    "text": "Yesterday was a special day for Tom...",
    "questions": [
      {
        "q": "Where did Tom go yesterday?",
        "options": ["To school", "To the park", "To the market", "To the library"],
        "answer": 1
      }
    ]
  },
  "vocabulary": [
    { "en": "watched", "uz": "ko'rdi", "pronunciation": "/wɒtʃt/" }
  ]
}
```

**Store grammar/reading/vocabulary as JSON columns in the Lesson table (or separate LessonContent table).**

---

## Progress

### Progress Entity
```
id          UUID (PK)
userId      UUID (FK → User)
lessonId    UUID (FK → Lesson)
score       int (0..100)
completedAt timestamp
UNIQUE(userId, lessonId)
```

### GET /api/v1/progress/me
Requires Bearer token. Returns all completed lessons for the current user.
```json
Response: [
  { "lessonId": "uuid", "userId": "uuid", "score": 95, "completedAt": "2026-06-10T..." }
]
```

### POST /api/v1/progress
```json
Body: { "lessonId": "uuid", "score": 90 }
Response: { "lessonId": "uuid", "userId": "uuid", "score": 90, "completedAt": "..." }
```
Upsert — if record exists, update score and completedAt.

---

## Home

### GET /api/v1/home/stats
Requires Bearer token.
```json
Response: {
  "lessons": { "completed": 30, "total": 120, "percentage": 25 },
  "words": { "total": 240, "weeklyNew": 18 },
  "averageScore": { "score": 88, "change": 3 },
  "dailyGoal": { "targetMinutes": 20, "completedMinutes": 12 }
}
```

### GET /api/v1/home/streak
```json
Response: {
  "currentStreak": 5,
  "longestStreak": 14,
  "lastActivity": "2026-06-10T..."
}
```

### GET /api/v1/home/current-lesson
Returns the first incomplete lesson for the user.
```json
Response: {
  "lessonId": "uuid",
  "title": "Past Simple — yasalishi va qoidalar",
  "sectionNumber": 3,
  "totalSections": 6,
  "completedSections": 2,
  "remainingMinutes": 12,
  "progress": 50
}
```

### GET /api/v1/home/daily-goals
Returns today's learning goals for the user.
```json
Response: [
  { "id": "grammar", "label": "Grammatika darsini tugatish", "completed": true },
  { "id": "vocab", "label": "10 ta yangi so'z", "completed": false },
  { "id": "reading", "label": "Reading mashqi", "completed": false }
]
```

---

## Seed Data (6 sections × 20 lessons)

Create a `seed` script that inserts all 120 lessons with full content.

### Sections:
| # | Title |
|---|-------|
| 1 | Asoslar va tanishuv |
| 2 | Kundalik hayot va muloqot |
| 3 | Grammatika asoslari |
| 4 | Zamonlar va hikoya qilish |
| 5 | Erkin suhbat va fikr bildirish |
| 6 | Ilg'or grammatika |

### Section 1 lessons (20 ta):
1.1 English Alphabet (Grammar, 15 min)
1.2 Talaffuz qoidalari (Grammar, 12)
1.3 Salom va tanishish (Grammar, 10)
1.4 Hello! — Reading (Reading, 9)
1.5 Pronouns — olmoshlar (Grammar, 11)
1.6 Numbers 1–100 (Vocabulary, 14)
1.7 Nice to meet you — Listening (Listening, 10)
1.8 To be — am/is/are (Grammar, 13)
1.9 My Family — Reading (Reading, 10)
1.10 Colors va shapes (Vocabulary, 12)
1.11 Prepositions — predloglar (Grammar, 11)
1.12 At School — Listening (Listening, 10)
1.13 Articles — a/an/the (Grammar, 12)
1.14 My Room — Reading (Reading, 9)
1.15 Days and months (Vocabulary, 13)
1.16 Plural nouns (Grammar, 11)
1.17 At the Park — Listening (Listening, 10)
1.18 Common phrases — 20 so'z (Vocabulary, 15)
1.19 SVOMPT tartib qoidasi (Grammar, 12)
1.20 Test 1 (Test, 20)

### Section 3 lessons (20 ta):
3.1 Grammatika nima? (Grammar, 8)
3.2 So'z turkumlari — Parts of Speech (Grammar, 10)
3.3 Ot (Noun) va sifat (Adjective) (Grammar, 12)
3.4 Describing People — Reading (Reading, 10)
3.5 Fe'l (Verb) turlari (Grammar, 11)
3.6 Common verbs — 20 ta so'z (Vocabulary, 15)
3.7 Present Simple — yasalishi (Grammar, 13)
3.8 My Daily Routine — Reading (Reading, 10)
3.9 Past Simple — yasalishi va qoidalar (Grammar, 12)
3.10 Past Continuous — yasalishi va qo'llanilishi (Grammar, 14)
3.11 When I was young — Reading (Reading, 10)
3.12 A Memorable Trip — Listening (Listening, 11)
3.13 Past tense vocabulary — 20 ta so'z (Vocabulary, 15)
3.14 Present Continuous — yasalishi (Grammar, 13)
3.15 Present Perfect — kirish (Grammar, 12)
3.16 My Achievements — Reading (Reading, 10)
3.17 At the Office — Listening (Listening, 11)
3.18 Present tense vocabulary — 20 ta so'z (Vocabulary, 14)
3.19 Future Simple — will (Grammar, 11)
3.20 Test 3 (Test, 20)

---

## CORS

Allow all origins during development. In production, restrict to the mobile app's domain.

## Environment Variables

```
DATABASE_URL=postgresql://user:pass@localhost:5432/ilova
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=your_refresh_secret
JWT_REFRESH_EXPIRES_IN=30d
PORT=2003
```
