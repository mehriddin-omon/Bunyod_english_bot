# Linguara — Backend API Specification Prompt

---

## Loyiha haqida

**Linguara** — ingliz tili o'rgatish platformasi. Frontend Next.js 16 (App Router, TypeScript) da yozilgan.  
Backend uchun **REST API** kerak (NestJS).  
Auth: **JWT (access + refresh token)**.  
DB: **PostgreSQL** (TypeORM).

---

## Rollar va ruxsatlar

| Rol | Huquqlar |
|-----|----------|
| `ADMIN` | Hammasi: foydalanuvchilar, kontent, guruhlar, tahlillar |
| `TEACHER` | O'z guruhlari, o'quvchilari, jadval, topshiriqlar, monitoring |
| `SUB_TEACHER` | Teacher kabi, lekin faqat belgilangan guruhga |
| `STUDENT` | Faqat o'z ma'lumotlari, darslar, progress |

---

## Data Models (TypeORM entity ko'rinishida)

```typescript
export enum Role { ADMIN = 'ADMIN', TEACHER = 'TEACHER', SUB_TEACHER = 'SUB_TEACHER', STUDENT = 'STUDENT' }
export enum LessonType { GRAMMAR = 'GRAMMAR', READING = 'READING', LISTENING = 'LISTENING', VOCABULARY = 'VOCABULARY', TEST = 'TEST' }
export enum ProgressStatus { NOT_STARTED = 'NOT_STARTED', IN_PROGRESS = 'IN_PROGRESS', COMPLETED = 'COMPLETED' }
export enum SubmissionStatus { PENDING = 'PENDING', SUBMITTED = 'SUBMITTED', GRADED = 'GRADED', LATE = 'LATE' }

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid') id: string
  @Column() firstName: string
  @Column() lastName: string
  @Column({ unique: true }) username: string
  @Column({ unique: true }) phone: string
  @Column() password: string
  @Column({ type: 'enum', enum: Role, default: Role.STUDENT }) role: Role
  @Column({ nullable: true }) cefrLevel: string  // A1, A2, B1, B2, C1
  @CreateDateColumn() createdAt: Date
  @UpdateDateColumn() updatedAt: Date

  @OneToMany(() => GroupMember, gm => gm.user) groupMemberships: GroupMember[]
  @OneToMany(() => Group, g => g.teacher) teacherGroups: Group[]
  @OneToMany(() => Progress, p => p.user) progress: Progress[]
  @OneToMany(() => AssignmentSubmission, s => s.student) assignments: AssignmentSubmission[]
  @OneToMany(() => XpHistory, x => x.user) xpHistory: XpHistory[]
  @OneToOne(() => Gamification, g => g.user) gamification: Gamification
  @OneToMany(() => Notification, n => n.user) notifications: Notification[]
}

@Entity('groups')
export class Group {
  @PrimaryGeneratedColumn('uuid') id: string
  @Column() name: string
  @Column() color: string  // blue, emerald, amber, rose, violet, zinc
  @Column() cefrLevel: string
  @Column({ default: 20 }) maxStudents: number
  @Column({ type: 'date' }) startDate: Date
  @Column() teacherId: string
  @ManyToOne(() => User) teacher: User
  @CreateDateColumn() createdAt: Date

  @OneToMany(() => GroupMember, gm => gm.group) members: GroupMember[]
  @OneToMany(() => Schedule, s => s.group) schedules: Schedule[]
  @OneToMany(() => Assignment, a => a.group) assignments: Assignment[]
}

@Entity('group_members')
@Unique(['groupId', 'userId'])
export class GroupMember {
  @PrimaryGeneratedColumn('uuid') id: string
  @Column() groupId: string
  @Column() userId: string
  @CreateDateColumn() joinedAt: Date
  @ManyToOne(() => Group, g => g.members) group: Group
  @ManyToOne(() => User, u => u.groupMemberships) user: User
}

@Entity('schedules')
export class Schedule {
  @PrimaryGeneratedColumn('uuid') id: string
  @Column() groupId: string
  @ManyToOne(() => Group, g => g.schedules) group: Group
  @Column('simple-array') days: number[]  // [0,2,4] — 0=Du, 6=Yak
  @Column() startTime: string  // "14:00"
  @Column() duration: number   // daqiqada
  @Column({ nullable: true }) topic: string
  @Column({ default: true }) recurring: boolean
  @CreateDateColumn() createdAt: Date
}

@Entity('units')
export class Unit {
  @PrimaryGeneratedColumn('uuid') id: string
  @Column() number: number  // 1-6
  @Column() title: string
  @Column({ nullable: true }) description: string
  @OneToMany(() => Lesson, l => l.unit) lessons: Lesson[]
}

@Entity('lessons')
export class Lesson {
  @PrimaryGeneratedColumn('uuid') id: string
  @Column() unitId: string
  @ManyToOne(() => Unit, u => u.lessons) unit: Unit
  @Column() number: number   // 1-20 (unit ichida)
  @Column() title: string
  @Column({ type: 'enum', enum: LessonType }) type: LessonType
  @Column() duration: number  // daqiqada
  @Column({ type: 'jsonb' }) content: object
  @Column() order: number
  @OneToMany(() => Progress, p => p.lesson) progress: Progress[]
}

@Entity('progress')
@Unique(['userId', 'lessonId'])
export class Progress {
  @PrimaryGeneratedColumn('uuid') id: string
  @Column() userId: string
  @ManyToOne(() => User, u => u.progress) user: User
  @Column() lessonId: string
  @ManyToOne(() => Lesson, l => l.progress) lesson: Lesson
  @Column({ type: 'enum', enum: ProgressStatus, default: ProgressStatus.NOT_STARTED }) status: ProgressStatus
  @Column({ type: 'float', nullable: true }) score: number
  @Column({ default: 0 }) attempts: number
  @Column({ default: 0 }) timeSpent: number  // sekundda
  @Column({ nullable: true }) completedAt: Date
  @UpdateDateColumn() updatedAt: Date
}

@Entity('assignments')
export class Assignment {
  @PrimaryGeneratedColumn('uuid') id: string
  @Column() groupId: string
  @ManyToOne(() => Group, g => g.assignments) group: Group
  @Column({ nullable: true }) lessonId: string
  @Column() title: string
  @Column({ nullable: true }) description: string
  @Column() type: string  // writing, speaking, test
  @Column({ type: 'timestamp' }) dueDate: Date
  @CreateDateColumn() createdAt: Date
  @OneToMany(() => AssignmentSubmission, s => s.assignment) submissions: AssignmentSubmission[]
}

@Entity('assignment_submissions')
@Unique(['assignmentId', 'studentId'])
export class AssignmentSubmission {
  @PrimaryGeneratedColumn('uuid') id: string
  @Column() assignmentId: string
  @ManyToOne(() => Assignment, a => a.submissions) assignment: Assignment
  @Column() studentId: string
  @ManyToOne(() => User, u => u.assignments) student: User
  @Column({ nullable: true }) content: string
  @Column({ nullable: true }) fileUrl: string
  @Column({ type: 'float', nullable: true }) score: number
  @Column({ nullable: true }) feedback: string
  @Column({ type: 'enum', enum: SubmissionStatus, default: SubmissionStatus.PENDING }) status: SubmissionStatus
  @Column({ nullable: true }) submittedAt: Date
  @Column({ nullable: true }) gradedAt: Date
}

@Entity('gamification')
export class Gamification {
  @PrimaryGeneratedColumn('uuid') id: string
  @Column({ unique: true }) userId: string
  @OneToOne(() => User, u => u.gamification) user: User
  @Column({ default: 0 }) xp: number
  @Column({ default: 1 }) level: number
  @Column({ default: 0 }) xpInLevel: number   // joriy level ichidagi XP (0-100)
  @Column({ default: 0 }) league: number       // 0=Bronza, 1=Kumush, 2=Oltin, 3=Platina, 4=Olmos
  @Column({ default: 0 }) streak: number
  @Column({ nullable: true }) lastActiveAt: string  // YYYY-MM-DD
  @Column({ default: 0 }) weeklyXp: number
  @UpdateDateColumn() updatedAt: Date
}

@Entity('xp_history')
export class XpHistory {
  @PrimaryGeneratedColumn('uuid') id: string
  @Column() userId: string
  @ManyToOne(() => User, u => u.xpHistory) user: User
  @Column() amount: number
  @Column() reason: string  // lesson_complete, streak_bonus, assignment_grade
  @CreateDateColumn() createdAt: Date
}

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid') id: string
  @Column() userId: string
  @ManyToOne(() => User, u => u.notifications) user: User
  @Column() title: string
  @Column() body: string
  @Column() type: string  // assignment, reminder, achievement, group
  @Column({ default: false }) read: boolean
  @CreateDateColumn() createdAt: Date
}
```

---

## API Endpoints

Barcha endpoint'lar `/api/v1` prefix bilan boshlanadi.  
Autentifikatsiya: `Authorization: Bearer <access_token>` header'i.

---

### 1. AUTH

#### `POST /api/v1/auth/login`
```json
// Request
{
  "username": "javohir_d",
  "password": "Password123"
}

// Response 200
{
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "user": {
    "id": "uuid",
    "firstName": "Javohir",
    "lastName": "Davronov",
    "username": "javohir_d",
    "role": "STUDENT",
    "cefrLevel": "B1"
  }
}

// Error 401: { "error": "Noto'g'ri login yoki parol" }
```

#### `POST /api/v1/auth/register`
```json
// Request
{
  "firstName": "Javohir",
  "lastName": "Davronov",
  "phone": "+998901234567",
  "username": "javohir_d",
  "password": "Password123",
  "role": "STUDENT"  // STUDENT | TEACHER (ADMIN faqat invite bilan)
}

// Response 201
{
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "user": { ...UserObject }
}

// Error 409: { "error": "Bu username band" }
// Error 409: { "error": "Bu telefon raqam band" }
```

#### `POST /api/v1/auth/refresh`
```json
// Request
{ "refreshToken": "eyJ..." }

// Response 200
{ "accessToken": "eyJ..." }
```

#### `POST /api/v1/auth/logout`
```json
// Request: Authorization header yetarli
// Response 200: { "message": "Chiqildi" }
```

#### `GET /api/v1/auth/me`
```json
// Response 200
{
  "id": "uuid",
  "firstName": "Javohir",
  "lastName": "Davronov",
  "username": "javohir_d",
  "phone": "+998901234567",
  "role": "STUDENT",
  "cefrLevel": "B1",
  "group": {
    "id": "uuid",
    "name": "1-guruh",
    "color": "blue"
  },
  "gamification": {
    "xp": 2210,
    "level": 16,
    "xpInLevel": 64,
    "league": 2,
    "streak": 14,
    "weeklyXp": 480
  }
}
```

---

### 2. USERS (Admin)

#### `GET /api/v1/users` — `[ADMIN]`
```
Query params: ?role=STUDENT&groupId=uuid&page=1&limit=20&search=javohir
```
```json
// Response 200
{
  "data": [{ ...UserObject }],
  "total": 150,
  "page": 1,
  "limit": 20
}
```

#### `GET /api/v1/users/:id` — `[ADMIN, TEACHER (o'z o'quvchilari)]`
```json
// Response 200: { ...UserObject, group: {...}, gamification: {...} }
```

#### `PUT /api/v1/users/:id` — `[ADMIN]`
```json
// Request: firstName, lastName, phone, cefrLevel, role
// Response 200: { ...updatedUserObject }
```

#### `DELETE /api/v1/users/:id` — `[ADMIN]`
```json
// Response 200: { "message": "O'chirildi" }
```

---

### 3. GROUPS

#### `GET /api/v1/groups` — `[ADMIN, TEACHER]`
- ADMIN: barcha guruhlar
- TEACHER: faqat o'z guruhlari
```json
// Response 200
{
  "data": [
    {
      "id": "uuid",
      "name": "1-guruh",
      "color": "blue",
      "cefrLevel": "B1",
      "maxStudents": 20,
      "studentCount": 18,
      "teacher": { "id": "uuid", "firstName": "Bunyod", "lastName": "Shamsiddinov" },
      "schedule": { "days": ["Du", "Ch", "Ju"], "startTime": "14:00", "duration": 90 },
      "progress": 64,
      "avgScore": 86
    }
  ]
}
```

#### `POST /api/v1/groups` — `[ADMIN, TEACHER]`
```json
// Request
{
  "name": "4-guruh",
  "color": "violet",
  "cefrLevel": "B1",
  "maxStudents": 20,
  "startDate": "2026-06-01",
  "schedule": {
    "days": ["Se", "Pa"],
    "startTime": "15:00",
    "duration": 90,
    "recurring": true
  },
  "studentIds": ["uuid1", "uuid2"]  // optional
}

// Response 201: { ...GroupObject }
```

#### `GET /api/v1/groups/:id` — `[ADMIN, TEACHER]`
```json
// Response 200
{
  "id": "uuid",
  "name": "1-guruh",
  "color": "blue",
  "cefrLevel": "B1",
  "teacher": { ...TeacherObject },
  "schedule": { ...ScheduleObject },
  "students": [{ ...StudentWithProgressObject }],
  "stats": {
    "avgAttendance": 94,
    "avgScore": 86,
    "avgProgress": 64
  }
}
```

#### `PUT /api/v1/groups/:id` — `[ADMIN, TEACHER (o'z guruhi)]`
```json
// Request: name, color, cefrLevel, maxStudents, schedule (partial update)
// Response 200: { ...updatedGroupObject }
```

#### `DELETE /api/v1/groups/:id` — `[ADMIN]`

#### `POST /api/v1/groups/:id/students` — `[ADMIN, TEACHER]`
```json
// Request: { "studentIds": ["uuid1", "uuid2"] }
// Response 200: { "added": 2, "message": "O'quvchilar qo'shildi" }
```

#### `DELETE /api/v1/groups/:id/students/:studentId` — `[ADMIN, TEACHER]`
```json
// Response 200: { "message": "O'quvchi guruhdan chiqarildi" }
```

#### `GET /api/v1/groups/:id/schedule` — `[ADMIN, TEACHER, STUDENT (o'z guruhi)]`
```json
// Response 200
{
  "groupId": "uuid",
  "schedule": [
    {
      "id": "uuid",
      "days": ["Du", "Ch", "Ju"],
      "startTime": "14:00",
      "duration": 90,
      "topic": "Past Simple",
      "recurring": true
    }
  ]
}
```

---

### 4. SCHEDULE (Teacher)

#### `GET /api/v1/schedule` — `[TEACHER]`
```
Query params: ?week=2026-05-25 (hafta boshlanish sanasi)
```
```json
// Response 200
{
  "week": "2026-05-25",
  "lessons": [
    {
      "id": "uuid",
      "groupId": "uuid",
      "groupName": "1-guruh",
      "groupColor": "blue",
      "day": 0,          // 0=Dushanba, 6=Yakshanba
      "startTime": "14:00",
      "duration": 90,
      "topic": "Past Simple",
      "studentCount": 18
    }
  ]
}
```

#### `POST /api/v1/schedule` — `[TEACHER]`
```json
// Request
{
  "groupId": "uuid",
  "days": [0, 2, 4],
  "startTime": "14:00",
  "duration": 90,
  "topic": "Past Simple — qoidalar",
  "recurring": true
}
// Response 201: { ...ScheduleObject }
```

#### `PUT /api/v1/schedule/:id` — `[TEACHER]`
#### `DELETE /api/v1/schedule/:id` — `[TEACHER]`

---

### 5. LESSONS (Content)

#### `GET /api/v1/lessons/units` — `[Authenticated]`
```json
// Response 200
{
  "units": [
    {
      "id": "uuid",
      "number": 1,
      "title": "Asoslar va tanishuv",
      "lessonCount": 20,
      "progress": 100,        // STUDENT uchun o'z progressi
      "status": "completed"   // completed | current | locked
    },
    {
      "id": "uuid",
      "number": 3,
      "title": "Grammatika asoslari",
      "lessonCount": 20,
      "progress": 50,
      "status": "current",
      "currentLesson": {
        "id": "uuid",
        "number": 11,
        "title": "When I was young — Reading"
      }
    }
  ]
}
```

#### `GET /api/v1/lessons/units/:unitId` — `[Authenticated]`
```json
// Response 200
{
  "unit": {
    "id": "uuid",
    "number": 3,
    "title": "Grammatika asoslari",
    "progress": 50
  },
  "lessons": [
    {
      "id": "uuid",
      "number": 9,
      "lessonCode": "3.9",
      "title": "Past Simple — yasalishi va qoidalar",
      "type": "GRAMMAR",
      "duration": 12,
      "status": "completed",    // completed | current | locked
      "score": 92
    }
  ]
}
```

#### `GET /api/v1/lessons/:lessonId` — `[Authenticated]`
```json
// Response 200 — Grammar uchun misol
{
  "id": "uuid",
  "lessonCode": "3.9",
  "title": "Past Simple — yasalishi va qoidalar",
  "type": "GRAMMAR",
  "duration": 12,
  "content": {
    "badge": "Grammar",
    "heading": "Past Simple",
    "description": "O'tgan zamonda yakunlangan harakatlar...",
    "formula": {
      "parts": ["Subject", "+", "Verb(past)", "+", "Object", "+", "Time"]
    },
    "examples": [
      {
        "en": "I watched a film yesterday.",
        "uz": "Men kecha film ko'rdim.",
        "highlight": "watched"
      }
    ],
    "rules": [
      { "title": "Regular fe'llar", "body": "-ed qo'shimchasi..." },
      { "title": "Irregular fe'llar", "body": "go → went, see → saw..." }
    ],
    "relatedWords": ["yesterday", "ago", "last week"],
    "tip": "Past Simple aniq vaqt ifodalari bilan keladi..."
  },
  "userProgress": {
    "status": "IN_PROGRESS",
    "score": null,
    "attempts": 1,
    "timeSpent": 420
  },
  "outline": [
    { "title": "Kirish", "duration": "1 min", "done": true },
    { "title": "Formula", "duration": "2 min", "done": true },
    { "title": "Misollar", "duration": "4 min", "done": false, "current": true }
  ]
}
```

#### `GET /api/v1/lessons/units/:unitId/lessons/:lessonId/reading` — reading kontenti
```json
// Response 200
{
  "lessonId": "uuid",
  "type": "READING",
  "text": {
    "title": "When I Was Young",
    "author": "Sarah Whitman",
    "wordCount": 412,
    "readTime": 6,
    "paragraphs": [
      {
        "text": "When I was young, my family lived in a small village...",
        "highlights": [
          { "word": "lived", "type": "past_simple" },
          { "word": "were swimming", "type": "past_continuous" }
        ]
      }
    ]
  },
  "questions": [
    {
      "id": "uuid",
      "number": 3,
      "type": "multiple_choice",
      "question": "What happened while the children were swimming?",
      "options": [
        { "id": "A", "text": "Their mother called them" },
        { "id": "B", "text": "A storm suddenly appeared" },
        { "id": "C", "text": "They caught many fish" },
        { "id": "D", "text": "Their father came to find them" }
      ],
      "correctId": "B",
      "explanation": "While they were swimming, a sudden storm appeared..."
    }
  ]
}
```

#### `GET /api/v1/lessons/units/:unitId/lessons/:lessonId/listening` — listening kontenti
```json
// Response 200
{
  "lessonId": "uuid",
  "type": "LISTENING",
  "audio": {
    "title": "A Memorable Trip",
    "trackCode": "Track 4.4",
    "duration": 188,       // sekundda (3:08)
    "audioUrl": "https://cdn.linguara.uz/audio/track-4.4.mp3",
    "speakers": [
      { "id": "A", "name": "Emma", "color": "blue" },
      { "id": "B", "name": "Tom", "color": "emerald" }
    ]
  },
  "transcript": [
    {
      "speakerId": "A",
      "timeStart": 14,
      "text": "So, where did you go on your last holiday?"
    }
  ],
  "questions": [
    {
      "id": "uuid",
      "number": 1,
      "type": "multiple_choice",
      "question": "Where did Tom go on his last holiday?",
      "options": [
        { "id": "A", "text": "Spain" },
        { "id": "B", "text": "Italy" },
        { "id": "C", "text": "Greece" },
        { "id": "D", "text": "France" }
      ],
      "correctId": "B"
    },
    {
      "id": "uuid",
      "number": 2,
      "type": "fill_blank",
      "question": "What ___ you ___ when the earthquake happened?",
      "blanks": 2,
      "correctAnswer": ["were", "doing"]
    }
  ]
}
```

---

### 6. PROGRESS (Student)

#### `POST /api/v1/progress/lessons/:lessonId/start` — `[STUDENT]`
```json
// Response 200: { "progressId": "uuid", "startedAt": "2026-05-30T14:00:00Z" }
```

#### `POST /api/v1/progress/lessons/:lessonId/complete` — `[STUDENT]`
```json
// Request
{
  "score": 87,
  "timeSpent": 720,      // sekundda
  "answers": [           // quiz javoblari
    { "questionId": "uuid", "answer": "B" },
    { "questionId": "uuid", "answer": ["were", "doing"] }
  ]
}

// Response 200
{
  "progress": {
    "status": "COMPLETED",
    "score": 87,
    "timeSpent": 720,
    "completedAt": "2026-05-30T14:12:00Z"
  },
  "xpEarned": 50,
  "nextLesson": {
    "id": "uuid",
    "lessonCode": "3.10",
    "title": "Past Continuous"
  },
  "streakUpdated": true,
  "newStreak": 15
}
```

#### `GET /api/v1/progress/overview` — `[STUDENT]` (Dashboard uchun)
```json
// Response 200
{
  "streak": 12,
  "totalLessons": 120,
  "completedLessons": 34,
  "completedPercent": 28,
  "learnedWords": 412,
  "avgScore": 87,
  "todayGoal": {
    "targetMinutes": 30,
    "spentMinutes": 23,
    "percent": 76,
    "tasks": [
      { "label": "1 ta dars yakunlash", "done": true },
      { "label": "15 ta so'z takrorlash", "done": true },
      { "label": "1 ta listening", "done": false }
    ]
  },
  "currentLesson": {
    "unitNumber": 3,
    "unitTitle": "Grammatika asoslari",
    "lessonCode": "3.11",
    "lessonTitle": "When I was young — Reading",
    "unitProgress": 66
  },
  "weeklyActivity": [
    { "date": "2026-05-24", "minutes": 45 },
    { "date": "2026-05-25", "minutes": 30 }
  ]
}
```

---

### 7. VOCABULARY

#### `GET /api/v1/vocabulary` — `[STUDENT]`
```
Query params: ?unitId=uuid&cefrLevel=B1&status=learned|new|reviewing
```
```json
// Response 200
{
  "words": [
    {
      "id": "uuid",
      "word": "watched",
      "translation": "ko'rdi",
      "example": "I watched a film yesterday.",
      "cefrLevel": "A2",
      "status": "learned",
      "nextReviewAt": "2026-06-01T00:00:00Z"
    }
  ],
  "stats": {
    "total": 412,
    "learned": 280,
    "reviewing": 100,
    "new": 32
  }
}
```

#### `POST /api/v1/vocabulary/:wordId/review` — `[STUDENT]`
```json
// Request: { "quality": 5 }  // 1-5 (SRS sistem uchun)
// Response 200: { "nextReviewAt": "2026-06-02T00:00:00Z", "xpEarned": 5 }
```

---

### 8. STATISTICS (Student o'zi)

#### `GET /api/v1/stats/my` — `[STUDENT]`
```json
// Response 200
{
  "cefrLevel": "B1",
  "cefrProgress": 32,    // B2 ga 32% o'tildi
  "skills": {
    "reading": { "level": "B1", "pct": 88 },
    "grammar": { "level": "B1", "pct": 84 },
    "writing": { "level": "B1", "pct": 79 },
    "vocabulary": { "level": "B1", "pct": 76, "wordCount": 1240 },
    "listening": { "level": "A2", "pct": 68 },
    "speaking": { "level": "A2", "pct": 62 }
  },
  "vocabulary": {
    "total": 1240,
    "retention": 91,
    "byLevel": [
      { "level": "A1", "count": 320 },
      { "level": "A2", "count": 410 },
      { "level": "B1", "count": 380 },
      { "level": "B2", "count": 130 }
    ]
  },
  "activityHeatmap": [
    { "dayOfWeek": 0, "hour": 16, "intensity": 4 }
  ],
  "weeklyMinutes": [
    { "day": "Du", "minutes": 65 },
    { "day": "Se", "minutes": 40 }
  ],
  "gamification": {
    "xp": 2210,
    "weeklyXp": 480,
    "level": 16,
    "xpInLevel": 64,
    "league": 2,
    "leagueName": "Oltin",
    "rankInGroup": 2
  }
}
```

---

### 9. ASSIGNMENTS

#### `GET /api/v1/assignments` — `[Authenticated]`
- STUDENT: o'z topshiriqlari
- TEACHER: o'z guruhlarining topshiriqlari
```json
// Response 200
{
  "data": [
    {
      "id": "uuid",
      "title": "3-bo'lim · Writing 3.5",
      "type": "writing",
      "dueDate": "2026-06-01T23:59:59Z",
      "group": { "id": "uuid", "name": "1-guruh" },
      "status": "SUBMITTED",    // STUDENT uchun o'z statusi
      "submittedCount": 11,     // TEACHER uchun
      "totalCount": 18
    }
  ]
}
```

#### `POST /api/v1/assignments` — `[TEACHER]`
```json
// Request
{
  "groupId": "uuid",
  "lessonId": "uuid",        // optional
  "title": "Formal email yozish",
  "description": "B1 darajasiga mos formal email...",
  "type": "writing",
  "dueDate": "2026-06-01T23:59:59Z"
}
// Response 201: { ...AssignmentObject }
```

#### `POST /api/v1/assignments/:id/submit` — `[STUDENT]`
```json
// Request
{
  "content": "Dear Sir/Madam...",
  "fileUrl": "https://cdn.linguara.uz/files/uuid.pdf"  // optional
}
// Response 200: { "submissionId": "uuid", "status": "SUBMITTED" }
```

#### `GET /api/v1/assignments/:id/submissions` — `[TEACHER]`
```json
// Response 200
{
  "assignment": { ...AssignmentObject },
  "submissions": [
    {
      "id": "uuid",
      "student": { "id": "uuid", "firstName": "Sevara", "lastName": "Yusupova" },
      "status": "SUBMITTED",
      "submittedAt": "2026-05-30T14:20:00Z",
      "score": null,
      "feedback": null
    }
  ],
  "stats": {
    "submitted": 11,
    "pending": 4,
    "late": 3,
    "total": 18
  }
}
```

#### `PUT /api/v1/assignments/:assignmentId/submissions/:submissionId/grade` — `[TEACHER]`
```json
// Request: { "score": 87, "feedback": "Juda yaxshi..." }
// Response 200: { ...updatedSubmission, xpEarned: 40 }
```

---

### 10. MONITORING (Teacher)

#### `GET /api/v1/monitoring/groups/:groupId` — `[TEACHER]`
```
Query params: ?period=week|month|quarter
```
```json
// Response 200
{
  "period": "month",
  "kpi": {
    "avgAttendance": 94,
    "avgAssignmentCompletion": 81,
    "avgScore": 84,
    "atRiskCount": 4
  },
  "weeklyActivity": [
    { "day": "Du", "activeStudents": 88 }
  ],
  "students": [
    {
      "id": "uuid",
      "firstName": "Sevara",
      "lastName": "Yusupova",
      "attendance": 100,
      "assignmentCompletion": 96,
      "lastActiveAt": "2026-05-30T13:30:00Z",
      "status": "good"    // good | watch | risk
    }
  ]
}
```

#### `GET /api/v1/monitoring/students/:studentId` — `[TEACHER]`
```json
// Response 200 — Student detail sahifasi uchun
{
  "student": {
    "id": "uuid",
    "firstName": "Otabek",
    "lastName": "Rasulov",
    "email": "otabek_r@linguara.uz",
    "cefrLevel": "B1",
    "group": { "id": "uuid", "name": "1-guruh" },
    "joinedAt": "2025-09-12",
    "status": "risk"
  },
  "summary": {
    "streak": 9,
    "totalTime": "42s",
    "rankInGroup": 11
  },
  "kpi": {
    "avgScore": 72,
    "groupAvgScore": 84,
    "attendance": 64,
    "completedAssignments": 19,
    "totalAssignments": 28,
    "lateAssignments": 5,
    "weeklyActiveTime": "3s 38m",
    "weeklyChangePercent": -22
  },
  "skills": {
    "grammar": { "level": "B1", "pct": 78 },
    "reading": { "level": "B1", "pct": 82 },
    "listening": { "level": "A2", "pct": 64 },
    "speaking": { "level": "A2", "pct": 58 },
    "writing": { "level": "B1", "pct": 74 },
    "vocabulary": { "level": "B1", "pct": 71, "wordCount": 1240 }
  },
  "vocabulary": {
    "total": 1240,
    "retention": 86,
    "weeklyGain": 45
  },
  "activityHeatmap": [...],
  "weeklyMinutes": [...],
  "topicStats": [
    {
      "lessonCode": "3.1",
      "title": "Present Perfect",
      "type": "Grammar",
      "completedPercent": 100,
      "score": "92%",
      "timeSpent": "42m",
      "attempts": 1
    }
  ],
  "recentAssignments": [
    {
      "title": "Formal email · Writing",
      "status": "late",
      "score": null,
      "dueDate": "2026-05-28"
    }
  ]
}
```

---

### 11. GAMIFICATION / LEADERBOARD

#### `GET /api/v1/gamification/leaderboard` — `[Authenticated]`
```
Query params: ?groupId=uuid&period=week|all
```
```json
// Response 200
{
  "period": "week",
  "currentUserId": "uuid",
  "board": [
    {
      "rank": 1,
      "userId": "uuid",
      "firstName": "Sevara",
      "lastName": "Yusupova",
      "initials": "SY",
      "level": 19,
      "xpInLevel": 80,
      "totalXp": 2940,
      "weeklyXp": 620,
      "league": 4,
      "leagueName": "Olmos",
      "streak": 31,
      "weeklyRankChange": 1,
      "isCurrentUser": false
    }
  ],
  "groupChallenge": {
    "targetXp": 5000,
    "currentXp": 3090,
    "daysLeft": 3,
    "reward": "Qo'shimcha so'z paketi"
  }
}
```

#### `GET /api/v1/gamification/my` — `[STUDENT]`
```json
// Response 200
{
  "xp": 2210,
  "level": 16,
  "xpInLevel": 64,
  "xpToNextLevel": 360,
  "league": 2,
  "leagueName": "Oltin",
  "streak": 14,
  "weeklyXp": 480,
  "rankInGroup": 2,
  "achievements": [
    { "id": "uuid", "title": "Birinchi dars", "icon": "flame", "unlocked": true, "unlockedAt": "2025-09-13" },
    { "id": "uuid", "title": "7 kun seriya", "icon": "star", "unlocked": true }
  ]
}
```

---

### 12. NOTIFICATIONS

#### `GET /api/v1/notifications` — `[Authenticated]`
```json
// Response 200
{
  "unreadCount": 3,
  "notifications": [
    {
      "id": "uuid",
      "title": "Yangi topshiriq",
      "body": "3-bo'lim · Writing 3.5 topshirig'i qo'shildi",
      "type": "assignment",
      "read": false,
      "createdAt": "2026-05-30T14:00:00Z"
    }
  ]
}
```

#### `PUT /api/v1/notifications/:id/read` — `[Authenticated]`
#### `PUT /api/v1/notifications/read-all` — `[Authenticated]`

---

### 13. ADMIN ONLY

#### `GET /api/v1/admin/overview` — `[ADMIN]`
```json
// Response 200
{
  "stats": {
    "totalUsers": 4820,
    "totalStudents": 4700,
    "totalTeachers": 115,
    "activeGroups": 230,
    "totalLessons": 120,
    "avgDailyActive": 1240
  }
}
```

#### `GET /api/v1/admin/analytics` — `[ADMIN]`
```
Query params: ?period=week|month|quarter
```
```json
// Response 200
{
  "dailyActive": [{ "date": "2026-05-30", "count": 1240 }],
  "newRegistrations": [{ "date": "2026-05-30", "count": 45 }],
  "lessonCompletions": [{ "date": "2026-05-30", "count": 2340 }],
  "topLessons": [{ "lessonCode": "3.9", "completions": 890 }]
}
```

---

## Xatolik formati (barcha endpoint'lar uchun)

```json
// 400 Bad Request
{ "error": "Validation xato", "details": { "username": "Majburiy maydon" } }

// 401 Unauthorized
{ "error": "Token yaroqsiz yoki muddati o'tgan" }

// 403 Forbidden
{ "error": "Bu amalni bajarish uchun ruxsatingiz yo'q" }

// 404 Not Found
{ "error": "Ma'lumot topilmadi" }

// 409 Conflict
{ "error": "Bu username allaqachon band" }

// 500 Internal Server Error
{ "error": "Server xatosi" }
```

---

## Texnik talablar

### Autentifikatsiya
- **Access token**: JWT, 15 daqiqa amal qiladi
- **Refresh token**: JWT, 30 kun amal qiladi, HttpOnly cookie YOKI response body da qaytarish
- Middleware barcha himoyalangan route'larda token tekshirishi kerak

### Fayl yuklash
- Audio fayllar: `.mp3` format, CDN da saqlash
- Topshiriq fayllari: `.pdf`, `.docx`, `.jpg` — max 10MB
- Endpoint: `POST /api/v1/upload` → `{ "url": "https://cdn.linguara.uz/files/uuid.ext" }`

### Pagination
```json
// Barcha ro'yxat endpoint'lari uchun:
{
  "data": [...],
  "meta": {
    "total": 150,
    "page": 1,
    "limit": 20,
    "totalPages": 8
  }
}
```

### Rate Limiting
- Auth endpoint'lari: 5 urinish / daqiqa (IP bo'yicha)
- Boshqa endpoint'lar: 100 so'rov / daqiqa (user bo'yicha)

### CORS
- Frontend URL: `http://localhost:3000` (dev) va production domain

### Environment variables
```env
DATABASE_URL=postgresql://...
JWT_SECRET=...
JWT_REFRESH_SECRET=...
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=30d
CDN_BASE_URL=https://cdn.linguara.uz
PORT=4000
```

---

## API URL Mapping (Frontend sahifalariga mos)

| Frontend sahifasi | Ishlatiladigan API'lar |
|-------------------|------------------------|
| `/login` | `POST /auth/login` |
| `/register` | `POST /auth/register` |
| `/student/dashboard` | `GET /auth/me`, `GET /progress/overview` |
| `/student/lessons` | `GET /lessons/units` |
| `/student/lessons/[unit]/[lesson]/grammar` | `GET /lessons/:id`, `POST /progress/:id/complete` |
| `/student/lessons/[unit]/[lesson]/reading` | `GET /lessons/:id/reading` |
| `/student/lessons/[unit]/[lesson]/listening` | `GET /lessons/:id/listening` |
| `/student/stats` | `GET /stats/my`, `GET /gamification/leaderboard` |
| `/teacher/dashboard` | `GET /schedule`, `GET /assignments?pending=true`, `GET /monitoring/groups/:id` |
| `/teacher/schedule` | `GET /schedule`, `POST /schedule`, `PUT /schedule/:id` |
| `/teacher/monitor` | `GET /monitoring/groups/:id` |
| `/teacher/students/[id]` | `GET /monitoring/students/:id` |
| `/teacher/students/new-group` | `POST /groups`, `GET /users?role=STUDENT&groupId=none` |
| `/teacher/leaderboard` | `GET /gamification/leaderboard` |
