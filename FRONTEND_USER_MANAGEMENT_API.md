# User Management API

Base URL: `http://localhost:4000`
Header: `Authorization: Bearer <access_token>`

---

**API name:** POST /users — Foydalanuvchi yaratish (Admin, Teacher)

Request body:
```json
{
    "firstName": "Ali",
    "lastName": "Valiyev",
    "username": "ali_valiyev",
    "password": "password123",
    "phone": "+998901234567",
    "email": "ali@example.com",
    "role": "student"
}
```

Response:
```json
{
    "statusCode": 201,
    "message": "Foydalanuvchi yaratildi",
    "data": {
        "id": "c0e0cb0d-60af-49c8-929c-229326f5b242",
        "first_name": "Ali",
        "last_name": "Valiyev",
        "username": "ali_valiyev",
        "phone": "+998901234567",
        "email": "ali@example.com",
        "role": "student",
        "created_by": "a1b2c3d4-0000-0000-0000-000000000001",
        "created_at": "2026-05-31T10:00:00.000Z",
        "update_at": "2026-05-31T10:00:00.000Z"
    }
}
```

---

**API name:** GET /users — Foydalanuvchilar ro'yxati (Admin, Teacher)

Query params: `?role=student&search=ali&page=1&limit=20`

Response:
```json
{
    "statusCode": 200,
    "message": "Foydalanuvchilar ro'yxati",
    "data": [
        {
            "id": "c0e0cb0d-60af-49c8-929c-229326f5b242",
            "first_name": "Ali",
            "last_name": "Valiyev",
            "username": "ali_valiyev",
            "phone": "+998901234567",
            "email": null,
            "role": "student",
            "created_by": "a1b2c3d4-0000-0000-0000-000000000001",
            "created_at": "2026-05-31T10:00:00.000Z",
            "update_at": "2026-05-31T10:00:00.000Z"
        }
    ],
    "meta": {
        "total": 45,
        "page": 1,
        "limit": 20,
        "total_pages": 3
    }
}
```

---

**API name:** GET /users/:id — Bitta foydalanuvchi (Admin, Teacher)

Response:
```json
{
    "statusCode": 200,
    "message": "Foydalanuvchi ma'lumoti",
    "data": {
        "id": "c0e0cb0d-60af-49c8-929c-229326f5b242",
        "first_name": "Ali",
        "last_name": "Valiyev",
        "username": "ali_valiyev",
        "phone": "+998901234567",
        "email": null,
        "role": "student",
        "created_by": "a1b2c3d4-0000-0000-0000-000000000001",
        "created_at": "2026-05-31T10:00:00.000Z",
        "update_at": "2026-05-31T10:00:00.000Z"
    }
}
```

---

**API name:** PUT /users/:id — Foydalanuvchini yangilash (Admin, Teacher)

Request body:
```json
{
    "firstName": "Ali",
    "lastName": "Valiyev",
    "username": "ali_v2",
    "password": "newpassword123",
    "phone": "+998901234567",
    "email": "ali@example.com",
    "role": "student"
}
```

Response:
```json
{
    "statusCode": 200,
    "message": "Foydalanuvchi yangilandi",
    "data": {
        "id": "c0e0cb0d-60af-49c8-929c-229326f5b242",
        "first_name": "Ali",
        "last_name": "Valiyev",
        "username": "ali_v2",
        "phone": "+998901234567",
        "email": "ali@example.com",
        "role": "student",
        "created_by": "a1b2c3d4-0000-0000-0000-000000000001",
        "created_at": "2026-05-31T10:00:00.000Z",
        "update_at": "2026-05-31T10:00:00.000Z"
    }
}
```

---

**API name:** DELETE /users/:id — Foydalanuvchini o'chirish (Admin, Teacher)

Response:
```json
{
    "statusCode": 200,
    "message": "Foydalanuvchi o'chirildi",
    "data": {
        "id": "c0e0cb0d-60af-49c8-929c-229326f5b242"
    }
}
```

---

**API name:** POST /auth/login — Tizimga kirish

Request body:
```json
{
    "username": "ali_valiyev",
    "password": "password123"
}
```

Response:
```json
{
    "statusCode": 200,
    "message": "Success",
    "data": {
        "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        "user": {
            "id": "c0e0cb0d-60af-49c8-929c-229326f5b242",
            "first_name": "Ali",
            "last_name": "Valiyev",
            "username": "ali_valiyev",
            "phone": "+998901234567",
            "role": "admin"
        }
    }
}
```

---

**API name:** POST /auth/register — Ro'yxatdan o'tish

Request body:
```json
{
    "firstName": "Ali",
    "lastName": "Valiyev",
    "phone": "+998901234567",
    "username": "ali_valiyev",
    "password": "password123",
    "role": "student"
}
```

Response:
```json
{
    "statusCode": 201,
    "message": "Success",
    "data": {
        "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        "user": {
            "id": "c0e0cb0d-60af-49c8-929c-229326f5b242",
            "first_name": "Ali",
            "last_name": "Valiyev",
            "username": "ali_valiyev",
            "phone": "+998901234567",
            "role": "student"
        }
    }
}
```

---

**API name:** POST /auth/refresh — Tokenni yangilash

Request body:
```json
{
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

Response:
```json
{
    "statusCode": 200,
    "message": "Success",
    "data": {
        "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    }
}
```

---

## Xato javoblari

```json
{ "statusCode": 401, "message": "Unauthorized" }
{ "statusCode": 403, "message": "Sizda bu endpointga kirish huquqi yo'q" }
{ "statusCode": 404, "message": "Foydalanuvchi topilmadi" }
{ "statusCode": 409, "message": "Bu username allaqachon band" }
```

---

## Role qiymatlari

```
superAdmin | admin | teacher | subTeacher | student
```

## Qoidalar

- Teacher yaratishda `role`: faqat `student` yoki `subTeacher`
- Admin yaratishda `role`: `student`, `subTeacher`, `teacher` (o'zidan past)
- `access_token` — har so'rovda `Authorization: Bearer <access_token>` headeriga qo'yiladi
