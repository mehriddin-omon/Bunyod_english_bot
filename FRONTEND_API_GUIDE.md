# Frontend API Documentation

## Overview

The Frontend API client provides a complete, type-safe interface for interacting with the Linguara backend. It's built for Next.js/React and includes:

- **Type-safe API client** with all endpoints defined
- **React hooks** for common API operations
- **Token management** with automatic refresh
- **Error handling** and loading states

## Installation & Setup

### 1. Import the API Client

```typescript
import { apiClient, useMe, useLogin } from '@/common/api';
```

### 2. Configure API URL

The client automatically uses `process.env.REACT_APP_API_URL` or defaults to `http://localhost:4000/api/v1`

Create `.env.local`:

```env
REACT_APP_API_URL=http://localhost:4000/api/v1
```

## Usage Examples

### Authentication

#### Login

```typescript
'use client'; // Next.js 16 client component
import { useLogin } from '@/common/api';

export default function LoginPage() {
  const { mutate: login, loading, error } = useLogin();

  const handleLogin = async (username: string, password: string) => {
    const result = await login({ username, password });
    if (result) {
      // Redirect to dashboard
      window.location.href = '/student/dashboard';
    }
  };

  return (
    <button onClick={() => handleLogin('user123', 'password')}>
      {loading ? 'Loading...' : 'Login'}
    </button>
  );
}
```

#### Get Current User

```typescript
import { useMe } from '@/common/api';

export default function Dashboard() {
  const { data: user, loading, error } = useMe();

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return <h1>Welcome, {user?.firstName}!</h1>;
}
```

#### Logout

```typescript
import { useLogout } from '@/common/api';

export default function LogoutButton() {
  const { mutate: logout, loading } = useLogout();

  return (
    <button onClick={() => logout()}>
      {loading ? 'Logging out...' : 'Logout'}
    </button>
  );
}
```

### Lessons & Learning

#### Get All Units

```typescript
import { useLessonUnits } from '@/common/api';

export default function LessonsPage() {
  const { data: units, loading } = useLessonUnits();

  return (
    <div>
      {units?.map((unit) => (
        <div key={unit.id}>
          <h2>{unit.title}</h2>
          <p>Progress: {unit.progress}%</p>
          <p>Status: {unit.status}</p>
        </div>
      ))}
    </div>
  );
}
```

#### Get Specific Lesson

```typescript
import { useLesson } from '@/common/api';

export default function LessonDetail({ lessonId }: { lessonId: string }) {
  const { data: lesson, loading } = useLesson(lessonId);

  if (!lesson) return <div>Lesson not found</div>;

  return (
    <div>
      <h1>{lesson.title}</h1>
      <p>Type: {lesson.type}</p>
      <div>{/* Render lesson content */}</div>
    </div>
  );
}
```

#### Complete a Lesson

```typescript
import { useCompleteLesson } from '@/common/api';

export default function LessonQuiz({ lessonId }: { lessonId: string }) {
  const { mutate: completeLesson, loading, error } = useCompleteLesson();

  const handleSubmit = async (answers: any[]) => {
    const result = await completeLesson(lessonId, {
      score: 85,
      timeSpent: 720, // seconds
      answers,
    });

    if (result) {
      alert(`You earned ${result.xpEarned} XP!`);
    }
  };

  return <button onClick={() => handleSubmit([])}>Submit</button>;
}
```

### Progress & Statistics

#### Get Progress Overview (Dashboard)

```typescript
import { useProgressOverview } from '@/common/api';

export default function StudentDashboard() {
  const { data: progress, loading } = useProgressOverview();

  return (
    <div>
      <p>Streak: {progress?.streak} 🔥</p>
      <p>Completed: {progress?.completedLessons}/{progress?.totalLessons}</p>
      <p>Avg Score: {progress?.avgScore}%</p>
      <p>Learned Words: {progress?.learnedWords}</p>
    </div>
  );
}
```

#### Get User Statistics

```typescript
import { useUserStats } from '@/common/api';

export default function StatsPage() {
  const { data: stats, loading } = useUserStats();

  return (
    <div>
      <h2>Your Statistics</h2>
      <p>CEFR Level: {stats?.cefrLevel}</p>
      <p>Reading: {stats?.skills.reading.pct}%</p>
      <p>Grammar: {stats?.skills.grammar.pct}%</p>
      <p>Vocabulary: {stats?.skills.vocabulary.wordCount} words</p>
    </div>
  );
}
```

### Gamification & Leaderboard

#### Get Leaderboard

```typescript
import { useLeaderboard } from '@/common/api';

export default function Leaderboard() {
  const { data: leaderboard, loading } = useLeaderboard({
    period: 'week',
    groupId: 'group-id', // optional
  });

  return (
    <div>
      {leaderboard?.board.map((entry) => (
        <div key={entry.userId}>
          <span>{entry.rank}</span>
          <span>{entry.firstName} {entry.lastName}</span>
          <span>{entry.weeklyXp} XP</span>
          <span>Level {entry.level}</span>
        </div>
      ))}
    </div>
  );
}
```

### Groups (Teacher)

#### Get Groups

```typescript
import { useGroups } from '@/common/api';

export default function TeacherDashboard() {
  const { data: groups, loading } = useGroups();

  return (
    <div>
      {groups?.map((group) => (
        <div key={group.id}>
          <h3>{group.name}</h3>
          <p>Level: {group.cefrLevel}</p>
          <p>Students: {group.studentCount}/{group.maxStudents}</p>
        </div>
      ))}
    </div>
  );
}
```

#### Create Group

```typescript
import { apiClient } from '@/common/api';

export async function createNewGroup() {
  const group = await apiClient.createGroup({
    name: '4-guruh',
    color: 'blue',
    cefrLevel: 'B1',
    maxStudents: 20,
    startDate: '2026-06-01',
    schedule: {
      days: [1, 3, 5], // Monday, Wednesday, Friday
      startTime: '14:00',
      duration: 90,
      recurring: true,
    },
  });
  return group;
}
```

### Assignments

#### Get Assignments

```typescript
import { useAssignments } from '@/common/api';

export default function AssignmentsPage() {
  const { data: assignments, loading } = useAssignments({
    pending: true, // only pending assignments
  });

  return (
    <ul>
      {assignments?.map((assignment) => (
        <li key={assignment.id}>
          <h4>{assignment.title}</h4>
          <p>Due: {new Date(assignment.dueDate).toLocaleDateString()}</p>
          <p>Status: {assignment.status}</p>
        </li>
      ))}
    </ul>
  );
}
```

#### Submit Assignment

```typescript
import { useSubmitAssignment } from '@/common/api';

export default function AssignmentSubmit({ assignmentId }: { assignmentId: string }) {
  const { mutate: submit, loading } = useSubmitAssignment();

  const handleSubmit = async (content: string) => {
    const result = await submit(assignmentId, {
      content,
      fileUrl: 'https://cdn.example.com/file.pdf', // optional
    });

    if (result) {
      alert('Assignment submitted!');
    }
  };

  return <button onClick={() => handleSubmit('My answer')}>Submit</button>;
}
```

### Notifications

#### Get Notifications

```typescript
import { useNotifications } from '@/common/api';

export default function NotificationCenter() {
  const { data: notifications, loading, refetch } = useNotifications();

  return (
    <div>
      <p>Unread: {notifications?.unreadCount}</p>
      {notifications?.notifications.map((notif) => (
        <div key={notif.id}>
          <h4>{notif.title}</h4>
          <p>{notif.body}</p>
          <p>{new Date(notif.createdAt).toLocaleDateString()}</p>
        </div>
      ))}
    </div>
  );
}
```

## Direct API Client Usage

For operations not covered by hooks, use the API client directly:

```typescript
import { apiClient } from '@/common/api';

// Get a specific user
const user = await apiClient.getUserById('user-id');

// Update user profile
const updated = await apiClient.updateUser('user-id', {
  firstName: 'New Name',
});

// Get vocabulary
const vocab = await apiClient.getVocabulary({
  cefrLevel: 'B1',
  status: 'new',
});

// Review vocabulary word
const review = await apiClient.reviewVocabularyWord('word-id', 4); // quality 1-5

// Get reading content
const reading = await apiClient.getReadingContent('unit-id', 'lesson-id');

// Get listening content
const listening = await apiClient.getListeningContent('unit-id', 'lesson-id');

// Teacher: Get group monitoring
const monitoring = await apiClient.getGroupMonitoring('group-id', {
  period: 'month',
});

// Teacher: Get student details
const studentDetail = await apiClient.getStudentDetail('student-id');

// Admin: Get overview
const adminStats = await apiClient.getAdminOverview();

// Admin: Get analytics
const analytics = await apiClient.getAdminAnalytics({
  period: 'quarter',
});
```

## Error Handling

All API operations wrap errors properly:

```typescript
import { useLogin } from '@/common/api';

export default function LoginForm() {
  const { mutate: login, error, loading } = useLogin();

  const handleLogin = async (username: string, password: string) => {
    const result = await login({ username, password });
    if (!result && error) {
      // Handle error
      console.error('Login failed:', error.message);
      // Show error message to user
    }
  };

  return (
    <>
      {error && <div className="error">{error.message}</div>}
      <button onClick={() => handleLogin('user', 'pass')}>
        {loading ? 'Loading...' : 'Login'}
      </button>
    </>
  );
}
```

## Token Management

The client automatically:
- Stores tokens in `localStorage`
- Includes token in `Authorization` header
- Refreshes expired access tokens automatically
- Clears tokens on logout

No manual token handling needed!

## Pagination

For list endpoints, use pagination parameters:

```typescript
const users = await apiClient.getUsers({
  page: 1,
  limit: 20,
  role: 'STUDENT',
  search: 'john',
});

// Response includes meta:
// {
//   data: [...],
//   meta: {
//     total: 150,
//     page: 1,
//     limit: 20,
//     totalPages: 8
//   }
// }
```

## Environment Variables

Create `.env.local`:

```env
REACT_APP_API_URL=http://localhost:4000/api/v1
```

For production, update in `.env.production`:

```env
REACT_APP_API_URL=https://api.linguara.uz/api/v1
```

## File Upload

For assignment file uploads, upload to CDN first, then submit the URL:

```typescript
const file = new FormData();
file.append('file', fileInput.files[0]);

const uploadResponse = await fetch('/api/v1/upload', {
  method: 'POST',
  body: file,
});

const { url } = await uploadResponse.json();

// Then submit with the URL
await apiClient.submitAssignment(assignmentId, {
  content: 'My submission',
  fileUrl: url,
});
```

## Rate Limiting

The API enforces rate limits:
- Auth endpoints: 5 requests/minute per IP
- Other endpoints: 100 requests/minute per user

Handle 429 errors gracefully:

```typescript
try {
  await apiClient.login(credentials);
} catch (error) {
  if (error.message.includes('429')) {
    // Too many requests - wait before retrying
  }
}
```

## Hooks Reference

| Hook | Purpose | Returns |
|------|---------|---------|
| `useLogin()` | Login user | `{ mutate, data, loading, error }` |
| `useRegister()` | Register user | `{ mutate, data, loading, error }` |
| `useLogout()` | Logout user | `{ mutate, loading, error }` |
| `useMe()` | Get current user | `{ data, loading, error, refetch }` |
| `useGroups()` | Get all groups | `{ data, loading, error, refetch }` |
| `useGroup(id)` | Get specific group | `{ data, loading, error, refetch }` |
| `useLessonUnits()` | Get all units | `{ data, loading, error, refetch }` |
| `useLesson(id)` | Get specific lesson | `{ data, loading, error, refetch }` |
| `useProgressOverview()` | Get dashboard progress | `{ data, loading, error, refetch }` |
| `useCompleteLesson()` | Complete lesson | `{ mutate, data, loading, error }` |
| `useUserStats()` | Get user statistics | `{ data, loading, error, refetch }` |
| `useLeaderboard(params)` | Get leaderboard | `{ data, loading, error, refetch }` |
| `useNotifications()` | Get notifications | `{ data, loading, error, refetch }` |
| `useAssignments(params)` | Get assignments | `{ data, loading, error, refetch }` |
| `useSubmitAssignment()` | Submit assignment | `{ mutate, data, loading, error }` |

## API Endpoints Reference

All endpoints follow the pattern `/api/v1/{resource}`:

### Authentication
- `POST /auth/login` - Login
- `POST /auth/register` - Register
- `POST /auth/refresh` - Refresh token
- `POST /auth/logout` - Logout
- `GET /auth/me` - Get current user

### Users
- `GET /users` - List users (admin only)
- `GET /users/:id` - Get user
- `PUT /users/:id` - Update user (admin)
- `DELETE /users/:id` - Delete user (admin)

### Groups
- `GET /groups` - List groups
- `POST /groups` - Create group
- `GET /groups/:id` - Get group details
- `PUT /groups/:id` - Update group
- `DELETE /groups/:id` - Delete group
- `POST /groups/:id/students` - Add students
- `DELETE /groups/:id/students/:studentId` - Remove student
- `GET /groups/:id/schedule` - Get group schedule

### Schedule
- `GET /schedule` - Get teacher schedule
- `POST /schedule` - Create schedule
- `PUT /schedule/:id` - Update schedule
- `DELETE /schedule/:id` - Delete schedule

### Lessons
- `GET /lessons/units` - List all units
- `GET /lessons/units/:unitId` - Get unit with lessons
- `GET /lessons/:lessonId` - Get lesson detail
- `GET /lessons/units/:unitId/lessons/:lessonId/reading` - Get reading content
- `GET /lessons/units/:unitId/lessons/:lessonId/listening` - Get listening content

### Progress
- `POST /progress/lessons/:lessonId/start` - Start lesson
- `POST /progress/lessons/:lessonId/complete` - Complete lesson
- `GET /progress/overview` - Get progress overview

### Vocabulary
- `GET /vocabulary` - List vocabulary
- `POST /vocabulary/:wordId/review` - Review word

### Statistics
- `GET /stats/my` - Get user statistics

### Assignments
- `GET /assignments` - List assignments
- `POST /assignments` - Create assignment (teacher)
- `POST /assignments/:id/submit` - Submit assignment (student)
- `GET /assignments/:id/submissions` - Get submissions (teacher)
- `PUT /assignments/:assignmentId/submissions/:submissionId/grade` - Grade submission (teacher)

### Gamification
- `GET /gamification/leaderboard` - Get leaderboard
- `GET /gamification/my` - Get user gamification

### Monitoring (Teacher)
- `GET /monitoring/groups/:groupId` - Get group monitoring
- `GET /monitoring/students/:studentId` - Get student details

### Notifications
- `GET /notifications` - Get notifications
- `PUT /notifications/:id/read` - Mark as read
- `PUT /notifications/read-all` - Mark all as read

### Admin
- `GET /admin/overview` - Get admin overview
- `GET /admin/analytics` - Get analytics

---

For more details, check `BACKEND_PROMPT.md` for the complete API specification.
