# 📚 Bunyod English Bot — Loyiha Progress

> **Maqsad:** Telegram orqali ingliz tili o'rgatuvchi bot.
> O'quvchilar lesson ichidagi Listening, Reading, Vocabulary va Test materiallarini o'rganadi.
> O'qituvchilar lesson yaratadi, materiallarni Telegram channelga yuboradi va bazaga saqlaydi.
> Tizim foydalanuvchilarning natijalarini kuzatib boradi (VocabularyStats, difficulty rating).

---

## 🗄️ Ma'lumotlar bazasi (Entities)

| Entity | Fayl | Holat |
|--------|------|-------|
| `User` | `user.entity.ts` | ✅ Tayyor — telegramId, role, vocabulary_rating |
| `Lesson` | `lesson.entity.ts` | ✅ Tayyor — lesson_name, status (draft/published/archived) |
| `Listening` | `listening.entity.ts` | ✅ Tayyor — title, message_id, order_index |
| `Reading` | `reading.entity.ts` | ✅ Tayyor — title, message_id, order_index |
| `Vocabulary` | `vocabulary.entity.ts` | ✅ Tayyor — word, lang, voice_file_id, order_index |
| `VocabularyRelations` | `vocabulary.entity.ts` | ✅ Tayyor — attempts, wrong_attempts, difficulty |
| `UserVocabularyStats` | `user-vocabulary-stats.entity.ts` | ✅ Tayyor — attempts, wrong_attempts per user |
| `Test` | `test.entity.ts` | ✅ Tayyor (entity bor) — question, message_id, order_index |

---

## 🤖 Bot (Telegram)

### 🟢 Umumiy Bot
| Funksiya | Holat | Tavsif |
|----------|-------|--------|
| `/start` komandasi | ✅ Tayyor | Guruh a'zoligini tekshiradi |
| Guruhga qo'shilish tekshiruvi | ✅ Tayyor | `check_membership` callback |
| Teacher menyu | ✅ Tayyor | `➕ Lesson create`, `📚 Lessons list`, `📊 Statistika`, `⚙️ Sozlamalar` |
| Student menyu | ✅ Tayyor | `📚 Lessons`, `ℹ️ Help` |
| Rol tizimi (admin/teacher/student) | ✅ Tayyor | DB + TEACHER_ID const fallback |
| `ℹ️ Yordam` komandasi | ✅ Tayyor | Teacher va Programmer kontaktlari |

---

## 📦 Modullar

### ✅ Auth moduli (`src/modules/auth/`)
- [x] Register (username, password, role)
- [x] Login — JWT token qaytaradi
- [x] JWT Guard, Public decorator

---

### ✅ User moduli (`src/modules/user/`)
- [x] `createOrUpdateFromTelegram` — Telegramdan user yaratish/yangilash
- [x] `findByTelegramId`, `getRole`
- [x] User controller (REST API)

---

### ✅ Admin moduli (`src/modules/admin/`)
- [x] Admin controller va service (bazasi tayyor)

---

### ✅ Lesson moduli (`src/modules/lesson/`)

#### Teacher — Lesson yaratish (`lesson-create.command.ts`)
- [x] `➕ Lesson create` — lesson menu ochish
- [x] `📌 Lesson name` — lesson nomini kiritish
- [x] `🎧 Listening create` — audio/video fayl qabul qilish
- [x] `📖 Reading create` — PDF/document qabul qilish
- [x] `📚 Vocabulary create` — matn parse qilish (format: `english - uzbek`)
- [x] `✅ Saqlash` — channelga yuborish + bazaga saqlash
- [x] `🔄 Update status` — draft/published/archived o'zgartirish
- [x] `❌ Bekor qilish` — sessiyani tozalash
- [ ] `❓ Test create` — **YOPIQ** (comment qilingan, `TestsService` ham comment)

#### Teacher — Lesson ko'rish/tahrirlash (`lesson-view.command.ts`)
- [x] `📚 Lessons list` — teacher lessonlarini ko'rsatish
- [x] `✏️ {lesson_name}` — lesson tanlash va tahrirlash menyusi
- [x] `📌 Update lesson name` — lesson nomini yangilash
- [x] `🎧 Listening list` — listening materiallar ro'yxati
- [x] `📖 Reading list` — (handler mavjud, lekin inline view yo'q)
- [x] `📚 Vocabulary list` — (handler mavjud)
- [ ] `🎧 Listening {N}` tahrirlash — **YOPIQ** (comment qilingan)
- [ ] `❓️ Test list` / `❓️ Test create` (edit view) — **YO'Q**

#### Student — Lesson ko'rish
- [ ] `📚 Lessons` handler — **YO'Q** (student lesson ro'yxatini ko'radigan handler yo'q)

---

### ⚠️ Listening moduli (`src/modules/listening/`)
| Qism | Holat | Tavsif |
|------|-------|--------|
| `ListeningService` | ✅ Tayyor | Ma'lumotlarni qayta ishlash |
| `ListeningHandler` | ❌ To'liq comment | Barcha kod `//` bilan yopilgan |
| `ListeningModule` | ✅ Tayyor | Module ro'yxatda bor |

---

### ⚠️ Reading moduli (`src/modules/reading/`)
| Qism | Holat | Tavsif |
|------|-------|--------|
| `ReadingService` | ❌ Bo'sh | Faqat `@Injectable()` — hech qanday metod yo'q |
| Bot handler | ❌ Yo'q | Reading botda ko'rsatilmaydi |
| `ReadingModule` | ✅ Tayyor | Module ro'yxatda bor |

---

### ⚠️ Tests moduli (`src/modules/tests/`)
| Qism | Holat | Tavsif |
|------|-------|--------|
| `TestsService.parseTestToJson()` | ✅ Tayyor | Raw text → JSON (A/B/C/D format) |
| Bot handler — test yaratish | ❌ YOPIQ | `lesson-create.command.ts` da comment qilingan |
| Bot handler — test ishlash | ❌ Yo'q | Student test ishlash flow yo'q |
| `TestsModule` | ❌ `app.module.ts` dan olib tashlangan | `// TestsModule` comment holatda |

---

### ✅ Vocabulary moduli (`src/modules/vocabulary/`)
- [x] `parseVocabularyText` — matn → `[{english, uzbek, transcription}]`
- [x] `generateVoice` — Google TTS orqali `.mp3` fayl
- [x] `create` — Vocabulary + VocabularyRelations bazaga saqlash
- [x] Vocabularyni Telegram channelga yuborish + `voice_file_id` saqlash
- [x] REST API controller

---

### ✅ VocabularyStats moduli (`src/modules/results/`)
- [x] `insertUserVocabularyStats` — to'g'ri/noto'g'ri javob saqlash
- [x] `updateVocabularyRelationStats` — attempts, wrong_attempts, difficulty hisoblash
- [x] `POST /result/create` REST endpoint

---

### ❌ Statistika (`src/modules/stats/`)
```
@Hears("📊 Statistika")
→ "Afsuski, bu bo'lim hozircha tayyor emas"
```
- [ ] Teacher statistikasi (lessonlar bo'yicha)
- [ ] Student statistikasi (o'z natijalari)

---

### ❌ Sozlamalar (`src/modules/params/`)
```
@Hears("⚙️ Sozlamalar")
→ "Afsuski, bu bo'lim hozircha tayyor emas"
```
- [ ] Bot sozlamalari (til, bildirishnoma va h.k.)

---

## 🔐 Guard va Middleware

| Qism | Holat |
|------|-------|
| `JwtAuthGuard` | ✅ Tayyor |
| `AdminGuard` | ✅ Tayyor |
| `RolesGuard` | ✅ Tayyor |
| `ChannelGuard` | ✅ Tayyor |
| `ResponseTransformInterceptor` | ✅ Tayyor |
| `@Public()` decorator | ✅ Tayyor |
| `@Roles()` decorator | ✅ Tayyor |
| `@Channel()` decorator | ✅ Tayyor |

---

## 📋 Umumiy Yig'indi

| Kategoriya | Bajarilgan | Bajarilmagan |
|------------|-----------|--------------|
| Database entities | 8/8 ✅ | — |
| Auth tizimi | ✅ | — |
| Bot (umumiy) | ✅ | — |
| Teacher — Lesson create | 5/6 (Test yopiq) | Test create |
| Teacher — Lesson edit | 3/5 | Listening/Test edit |
| Student — Lesson view | ❌ | Butun flow yo'q |
| Listening handler | ❌ | To'liq qayta yozish kerak |
| Reading service/handler | ❌ | Bo'sh (faqat entity bor) |
| Tests flow (bot) | ❌ | Uncomment + handler yozish |
| Vocabulary | ✅ | — |
| VocabularyStats | ✅ (API) | Bot orqali natija kirish yo'q |
| Statistika sahifasi | ❌ | To'liq yozish kerak |
| Sozlamalar sahifasi | ❌ | To'liq yozish kerak |

---

## 🚀 Keyingi Bosqichlar (Navbat bo'yicha)

1. **[ ] Student Lesson Flow** — `📚 Lessons` → lesson tanlash → Listening/Reading/Vocabulary/Test ko'rish
2. **[ ] Listening Handlerni tiklash** — `listenining.handler.ts` ni uncomment + to'ldirish
3. **[ ] Reading Service + Handler** — reading materiallarni botda ko'rsatish
4. **[ ] Tests Module ulash** — `app.module.ts` ga qo'shish + bot handler yozish
5. **[ ] Statistika sahifasi** — Teacher: lesson statistikasi, Student: o'z natijalari
6. **[ ] Sozlamalar sahifasi** — Foydalanuvchi sozlamalari
