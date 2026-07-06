# CODE_SYNC — DBML ↔ Entity moslashtirish ro'yxati

> `sql.dbml` "to'liq holat"ga keltirildi (2026-07-02). Bu fayl DBML bilan mos bo'lishi uchun
> TypeORM entity'lariga (`src/common/core/entitys/`) kiritilishi kerak bo'lgan o'zgarishlarni sanaydi.
> DBML = maqsad (spec); kod shunga moslashtiriladi.

---

## 1. Yetishmayotgan `@Index`lar (DBMLda bor, kodda yo'q)

Har entity class'iga qo'shing:

| Entity | Qo'shiladigan dekorator |
|--------|------------------------|
| `Vocabulary` | `@Index(['lessonId'])` |
| `VocabularyRelation` | `@Index(['vocabularyId'])`, `@Index(['translationId'])` |
| `VocabularyExample` | `@Index(['pairId'])` |
| `QuizContent` | `@Index(['lessonId'])` |
| `QuizExercise` | `@Index(['quizId'])` |
| `QuizItem` | `@Index(['exerciseId'])` |
| `QuizStudentAnswer` | `@Index(['quizId'])` |
| `UserVocabularyProgress` | `@Index(['nextReviewAt'])`, `@Index(['status'])` |
| `UserGamification` | `@Index(['xpTotal'])`, `@Index(['xpWeekly'])`, `@Index(['league'])` |
| `Group` | `@Index(['teacherId'])`, `@Index(['status'])` |
| `Schedule` | `@Index(['groupId'])`, `@Index(['teacherId'])` |
| `ScheduleSession` | `@Index(['scheduleId'])` |
| `Attendance` | `@Index(['userId'])` |
| `Assignment` | `@Index(['teacherId'])`, `@Index(['dueDate'])` |
| `AssignmentSubmission` | `@Index(['studentId'])`, `@Index(['status'])`, `@Index(['gradedBy'])` |
| `Message` | `@Index(['senderId'])` |

---

## 2. `varchar/text` → `jsonb` (ustun tipi o'zgaradi + migratsiya)

| Entity : ustun | Hozir | Bo'lishi kerak | Izoh |
|----------------|-------|----------------|------|
| `QuizItem.options` | `text` (JSON string) | `jsonb` | `JSON.stringify` ni olib tashlab, obyekt saqlang |
| `Schedule.daysOfWeek` | `varchar` (JSON string) | `jsonb` (yoki `int[]`) | "dushanba darslari" so'rovi imkoni |
| `Message.attachments` | `text` (JSON string) | `jsonb` | — |
| `ListeningQuestion.matchTargets` | (DBda migratsiyada `jsonb`) | entity tipini `jsonb`ga tekshiring | DB allaqachon jsonb |

---

## 3. PG enum tiplari (KATTA — migratsiya kerak)

Hozir barcha enumli ustunlar `type: 'varchar', enum: SomeEnum` — ya'ni DBda **varchar** sifatida saqlanadi.
DBML endi PG `enum` tiplarini ko'rsatadi. To'liq moslik uchun:

- Entity ustunlarini `type: 'enum', enum: SomeEnum` ga o'zgartiring.
- Har biriga migratsiya generatsiya qiling (`CREATE TYPE ... AS ENUM (...)` + `ALTER COLUMN ... TYPE`).

**Ta'sirlanadigan ustunlar:** `users.role`, `units.status`, `lessons.status`, `lesson_progress.status`,
`student_profiles.cefr_level`, `reading_questions.question_type`, `listening_questions.question_type`,
`vocabularys.lang`, `vocabularys.pos`, `quiz_exercises.exercise_type`, `user_vocabulary_progress.status`,
`user_skills.skill`, `user_skills.cefr_level`, `user_gamification.league`, `xp_transactions.source`,
`achievements.condition_type`, `schedule_sessions.status`, `attendance.status`, `daily_tracking`→`activity_log.activity_type`,
`assignments.type`, `assignments.status`, `assignment_submissions.status`, `notifications.type`.

> Muqobil: enumlarni faqat "ruxsat etilgan qiymatlar hujjati" sifatida qoldirib, ustunlarni varchar saqlash.
> Bu holda DBMLdagi enum bloklari hujjat rolini o'ynaydi, DB o'zgarmaydi.

---

## 4. Struktura o'zgarishlari (entity qayta yoziladi)

### 4.1 `VocabularyPracticeLog` — TO'LIQ QAYTA YOZISH ⚠️
Hozirgi entity: `session_id` (SET NULL) + `mode` **smallint** + vaqt ustunsiz (BaseEntity emas).
Maqsad (DBML): `user_id` (CASCADE) + `mode` **enum** (`practice_mode`) + `answered_at` + `created_at/updated_at` (BaseEntity).
- Ta'sir: `vocabulary.service.ts` dagi practice-log yozish mantiqi o'zgaradi (session o'rniga user).
- Migratsiya: `session_id` olib tashlash, `user_id` + `answered_at` qo'shish, `mode` smallint→enum.

### 4.2 `group_members` — join-entity ga aylantirish
Hozir: `Group` da `@ManyToMany(() => User) @JoinTable({ name: 'group_members' })` (faqat 2 FK).
Maqsad: `joined_at` ustuni uchun alohida `GroupMember` entity (group_id, user_id, joined_at) + `@ManyToOne`lar.

### 4.3 `Group.createdBy` — FK bog'lanish qo'shish
Hozir: faqat `@Column({ name: 'created_by' })` (FK yo'q).
Maqsad: `@ManyToOne(() => User)` bog'lanish (DBMLda `ref: > users.id`).

---

## 5. Rejalashtirilgan jadvallar (DBMLda bor, entity YO'Q)

Bu jadvallar `⚠️ REJALASHTIRILGAN` deb belgilangan — funksiya qurilganda entity yarating:
- `test_questions`, `test_options` — "Test / Amaliyot" bo'limi (hozir `quiz_*` ishlatiladi).
- `group_lessons` — guruhga aniq dars biriktirish (hozir gating `manual_lesson_ceiling` bilan).

---

## 6. Hali qilinmagan (ixtiyoriy keyingi qadam)

- ✅ (tekshirilgan) jadvallarning FK'lariga hali `delete` qoidasi qo'shilmagan
  (`reading_*`, `listening_*`, `grammar_contents`, `lesson_progress`, `*_profiles`, `units`, `lessons`).
  Kod entity'laridan `onDelete` ni o'qib, DBMLga qo'shish kerak — izchillik uchun.

---

## 7. KONSOLIDATSIYA (diagramma ko'rigidan keyin — 2026-07-03)

Ushbu strukturaviy birlashtirishlar kodda ham bajarilishi kerak. Migratsiya bilan ma'lumot ko'chiriladi.

### 7.1 `vocabulary_synonyms` + `vocabulary_antonyms` → `vocabulary_word_relations`
- `Vocabulary` entity'dagi 2 ta `@ManyToMany` (`synonyms`, `antonyms`) + `@JoinTable` ni olib tashlang.
- Yangi entity `VocabularyWordRelation` yarating: `vocabulary_id`, `related_id`, `relation_type` (enum `synonym|antonym`), composite PK.
- Migratsiya: eski 2 jadvaldagi qatorlarni `relation_type` bilan yangi jadvalga ko'chiring.

### 7.2 `group_lessons` — o'chirildi
- Kodda entity yo'q edi — o'zgarish shart emas. Gating `manual_lesson_ceiling` + `group_member_settings` bilan davom etadi.

### 7.3 `user_skills` → `student_profiles` ustunlari
- `UserSkill` entity + `user_skills` jadvalini o'chiring. `skill_type` enum ham keraksiz.
- `StudentProfile` entity'ga ustun qo'shing: `grammar_score`, `reading_score`, `listening_score`,
  `speaking_score`, `writing_score`, `vocabulary_score`, `vocabulary_words_count` (int, default 0).
- Umumiy `cefr_level` `student_profiles`da qoladi (bitta, per-skill emas).
- Migratsiya: `user_skills` qatorlarini foydalanuvchi bo'yicha yig'ib, mos ustunlarga yozing.
- ⚠️ `monitoring.service.ts` `skillRepo`ni ishlatadi — uni `student_profiles`dan o'qishga o'zgartiring.

### 7.4 `activity_log` + `xp_transactions` → `activity_events`
- `ActivityLog` va `XpTransaction` entity'larini o'chiring.
- Yangi entity `ActivityEvent`: `user_id`, `activity_type` (nullable), `occurred_at`, `duration_sec`,
  `xp_earned`, `xp_source` (nullable), `reference_id`, `meta` (jsonb), timestamps.
- `day_of_week`/`hour_of_day` — endi saqlanmaydi, `occurred_at`dan hisoblanadi (heatmap uchun SQL/kod).
- `duration_minutes` → `duration_sec` (birlik o'zgardi).
- ⚠️ XP yozadigan joylar (`progress.service.ts` `updateGamification`, gamification) endi `activity_events`ga
  `xp_earned` + `xp_source` yozsin; alohida xp_transactions yo'q.
- `daily_tracking` (kunlik yig'indi) va `vocabulary_practice_logs` (SRS) o'zgarmaydi.

---

## 8. MAVHUMLIK TUZATISHLARI (2026-07-03)

### 8.1 Media nomlash → `*_url` konventsiyasi
Entity maydonlari + ustunlar qayta nomlanadi (migratsiya bilan):
| Entity | Eski | Yangi |
|--------|------|-------|
| `Vocabulary` | `voice_file_id` / `voiceFileId` | `voice_url` / `voiceUrl` |
| `ListeningContent` | `file_id` / `fileId` | `audio_url` / `audioUrl` |
| `AssignmentSubmission` | `file_id` / `fileId` | `file_url` / `fileUrl` |
| `test_questions` (rejada) | `media_file_id` | `media_url` |
- ⚠️ Bu maydonlarni ishlatadigan servislarni yangilang: `vocabulary.service.ts` (`voiceFileId`),
  listening/upload oqimi (`fileId`), `assignments.service.ts` (`fileId`).
- `avatar_url`, `image_url` allaqachon to'g'ri — tegilmaydi.

### 8.2 `grammar_contents` aniqlashtirildi
- `GrammarContent` entity: `page_name`/`pageName` → `component_key`/`componentKey`.
- Yangi maydonlar qo'shing: `title` (varchar), `content` (jsonb — ixtiyoriy DB-kontent), `order_index` (int).
- Endi grammatika yo front komponent kaliti (`component_key`) orqali, yo DB kontenti (`content`) orqali beriladi.

### 8.3 Savol/variant — ALOHIDA qoldirildi
- reading/listening/test savol+variant jadvallari birlashtirilmadi (polimorf FK trade-off qabul qilinmadi).
- Kod o'zgarmaydi — har kontent turi mustaqil.
