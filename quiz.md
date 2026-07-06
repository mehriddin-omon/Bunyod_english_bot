# TOPSHIRIQ (PROMPT): Barcha mashqlarni yagona tizimga birlashtirish

> Bu hujjat — to'liq texnik topshiriq. Maqsad: listening, reading, grammar va quiz uchun
> mashqlar ALOHIDA jadval/ustunlarda saqlanmasin. Barcha mashqlar BITTA yagona tizimda
> saqlanadi, mashqning TURI esa alohida `exercise_type` ustunida (enum) yoziladi.
> Har bir bo'limni to'liq bajaring — hech bir qism qolib ketmasin.

---

## 1. MAQSAD

1. Bitta universal "mashq" tizimi: `exercises` + `exercise_items` jadvallari.
2. Mashq istalgan blokka biriktiriladi: `owner_block_type` (quiz | reading | listening | grammar)
   va `owner_block_id` ustunlari orqali. Blok turi uchun ALOHIDA jadval OCHILMAYDI.
3. Mashq turi alohida ustunda: `exercise_type` — mavjud `quiz_exercise_type_enum`:
   `matching, fill_in_blank, multiple_choice, true_false, word_bank, translation`.
4. Eski `reading_questions`, `reading_options`, `listening_questions`, `listening_options`
   jadvallaridagi ma'lumotlar yangi tizimga KO'CHIRILADI, so'ng eski jadvallar O'CHIRILADI.
5. Student javoblari allaqachon yagona `student_answers` jadvalida — u SAQLANIB QOLADI,
   faqat `question_id` endi hamma joyda `exercise_items.id` ga ishora qiladi.
6. Baholash bitta servisda (`StudentAnswersService`) qoladi, `lesson_progress` dagi
   `quiz_score / reading_score / listening_score / grammar_score` ustunlari o'zgarmaydi
   (ular summary/cache — bu XATO EMAS, ular qoladi).

---

## 2. HOZIRGI HOLAT (o'zgartirilishi kerak bo'lgan joylar)

Backend (`backend/src/`):

| Nima | Qayerda | Muammo |
|---|---|---|
| Quiz mashqlari | `common/core/entitys/quiz-exercise.entity.ts`, `quiz-item.entity.ts` | Yagona engine shu bo'ladi, lekin hozir faqat quiz blokiga bog'liq (`quiz_id`) |
| Reading savollari | `common/core/entitys/reading-question.entity.ts`, `reading-option.entity.ts` | Alohida tizim — YO'Q QILINADI (ko'chirilgach) |
| Listening savollari | `common/core/entitys/listening-question.entity.ts`, `listening-option.entity.ts` | Alohida tizim — YO'Q QILINADI (ko'chirilgach) |
| Grammar | `common/core/entitys/grammar-content.entity.ts` | Mashq biriktirish imkoni yo'q — qo'shiladi |
| Teacher CRUD | `modules/teacher-lessons/blocks.service.ts` | Reading/listening savollari uchun alohida CRUD, quiz uchun alohida — BITTA umumiy CRUD bo'ladi |
| Student output | `modules/lessons/lessons.service.ts` (`getLessonBlocks`) | Har blok o'z savol formatini qaytaradi — yagona `exercises` formati bo'ladi |
| Baholash | `modules/lessons/student-answers.service.ts` | submitReading/submitListening eski jadvallardan o'qiydi — yagona submitga birlashadi |
| Javoblar | `common/core/entitys/student-answer.entity.ts` (`student_answers`) | TAYYOR — tegilmaydi |

Frontend (web, `frontend/src/`):
- `app/teacher/lessons/[lessonId]/blocks/[blockId]/quiz/page.tsx` — mashq builder (6 tur) — UMUMIY builderga aylanadi.
- Reading/listening teacher sahifalari — savollar bo'limi eski API bilan ishlaydi — yangi umumiy exercises APIga o'tkaziladi.

Mobil (`ilova/src/`):
- `components/blocks/QuizBlockView.tsx` — 6 turni renderlaydi (stepper) — UMUMIY renderer bo'ladi.
- `components/blocks/ReadingBlockView.tsx`, `ListeningBlockView.tsx` — o'z savol renderlari bor — umumiy rendererga o'tadi.

Vocabulary va speaking BU TOPSHIRIQQA KIRMAYDI (vocabulary'ning o'z tizimi bor).

---

## 3. MAQSADLI SXEMA (DB)

### 3.1. `exercises` jadvali (hozirgi `quiz_exercises` ni kengaytirish)

```sql
exercises (
  id            uuid PK DEFAULT gen_random_uuid(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  lesson_id     uuid NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,

  -- Mashq qaysi blokka tegishli (alohida jadval EMAS, ustun):
  owner_block_type  student_answer_block_type_enum NOT NULL,  -- 'quiz' | 'reading' | 'listening' | 'grammar'
  owner_block_id    uuid NOT NULL,  -- quiz_contents.id / reading_contents.id / listening_contents.id / grammar_contents.id (polimorf, FK yo'q)

  -- Mashq turi alohida ustunda:
  exercise_type quiz_exercise_type_enum NOT NULL,  -- matching | fill_in_blank | multiple_choice | true_false | word_bank | translation

  title         varchar NULL,
  instructions  text NULL,          -- word_bank uchun: vergul bilan so'zlar ro'yxati
  order_index   int NOT NULL DEFAULT 0
)
CREATE INDEX ON exercises (owner_block_type, owner_block_id);
CREATE INDEX ON exercises (lesson_id);
```

Eslatma: `quiz_id` ustuni o'rniga `owner_block_type + owner_block_id` keladi.
Mavjud quiz mashqlari uchun: `owner_block_type='quiz'`, `owner_block_id=quiz_id`, `lesson_id=quiz_contents.lesson_id`.

### 3.2. `exercise_items` jadvali (hozirgi `quiz_items` ni kengaytirish)

```sql
exercise_items (
  id             uuid PK,
  created_at     timestamptz, updated_at timestamptz,
  exercise_id    uuid NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  item_text      text NOT NULL,          -- gap / savol matni / o'zbekcha gap (translation)
  correct_answer text NOT NULL,          -- to'g'ri javob / 'true'|'false' / model tarjima
  options        jsonb NULL,             -- quyidagi 3.3 formatda
  image_url      varchar NULL,           -- listening savollaridagi rasm (savol darajasida)
  explanation    text NULL,              -- correct_explanation (reading/listeningdan ko'chadi)
  order_index    int NOT NULL DEFAULT 0
)
```

### 3.3. `options` (jsonb) yagona formati

Ikki ko'rinish qo'llab-quvvatlanadi:

1. Oddiy satrlar massivi (multiple_choice, word_bank legacy): `["am", "is", "are"]`
2. Obyektlar massivi (rasmli/matchingli variantlar uchun):
```json
[
  { "text": "is",  "isCorrect": true,  "imageUrl": null, "matchKey": null },
  { "text": "am",  "isCorrect": false, "imageUrl": "https://...", "matchKey": "A" }
]
```

`true_false` turida: `options = ["to'g'ri shakl (fix)"]` — noto'g'ri gapning to'g'rilangan varianti (ixtiyoriy).

### 3.4. O'CHIRILADIGAN jadvallar (data ko'chirilgach)

- `reading_questions`, `reading_options`
- `listening_questions`, `listening_options`

### 3.5. TEGILMAYDIGAN jadvallar

- `student_answers` (yagona javoblar — tayyor)
- `lesson_progress` (barcha `*_score` ustunlari qoladi)
- `reading_contents`, `listening_contents`, `grammar_contents`, `quiz_contents` (kontent qoladi — faqat savollari ko'chadi)
- `vocabulary_*` jadvallari

---

## 4. MA'LUMOT MIGRATSIYASI (aniq mapping)

TypeORM migratsiya yozing (`src/database/migrations/`) + dev uchun bootstrap
(`src/database/ensure-*.ts` uslubida, `app.service.ts` dagi kabi chaqiriladi).

### 4.1. `quiz_exercises` → `exercises`

| Eski | Yangi |
|---|---|
| `quiz_id` | `owner_block_id`, `owner_block_type='quiz'` |
| (join `quiz_contents.lesson_id`) | `lesson_id` |
| `exercise_type` | `exercise_type` (o'zgarmaydi) |
| `title`, `instructions`, `order_index` | o'zgarmaydi |

`quiz_items` → `exercise_items`: `item_text`, `correct_answer`, `order_index` o'zgarmaydi;
`options` (text/JSON string) → jsonb ga cast.

### 4.2. `reading_questions` → `exercises` + `exercise_items`

Har bir reading_content uchun uning savollari BITTA exercise bo'ladi:
- `exercises`: `owner_block_type='reading'`, `owner_block_id=reading_id`,
  `lesson_id=reading_contents.lesson_id`, `title='Savollar'`,
  `exercise_type` = savollar turiga qarab (pastda), `order_index=0`.
- Agar bir readingda ham `multiple_choice`, ham `true_false` savollar bo'lsa —
  har tur uchun alohida exercise yarating (tur bo'yicha guruhlab).

Har savol → `exercise_items`:

| Eski (`reading_questions` + `reading_options`) | Yangi (`exercise_items`) |
|---|---|
| `question_text` | `item_text` |
| `question_type` `multiple_choice` → | `exercise_type='multiple_choice'` (exercise darajasida) |
| `question_type` `true_false` → | `exercise_type='true_false'` |
| options ichidan `is_correct=true` bo'lganning `option_text` | `correct_answer` |
| barcha optionlar | `options` jsonb: `[{ "text", "isCorrect" }]` |
| `correct_explanation` | `explanation` |
| `order_index` | `order_index` |

### 4.3. `listening_questions` → `exercises` + `exercise_items`

Xuddi reading kabi, `owner_block_type='listening'`:

| Eski tur | Yangi `exercise_type` |
|---|---|
| `mcq` / `multiple_choice` | `multiple_choice` |
| `fill_in_blank` | `fill_in_blank` |
| `matching` | `matching` |

Qo'shimcha maydonlar:
- savol `image_url` → `exercise_items.image_url`
- option `image_url`, `match_key` → `options` jsonb obyektlariga: `{ "text", "isCorrect", "imageUrl", "matchKey" }`
- `match_targets` (jsonb) → exercise `instructions` ga JSON string sifatida YOKI options obyektlarida saqlang — renderer o'qiy oladigan bitta usulni tanlang va hujjatlashtiring.

### 4.4. `student_answers` dagi eski reading/listening javoblari

`student_answers.question_id` eski `reading_questions.id`/`listening_questions.id` ga
ishora qilishi mumkin. ENG OSON YO'L: ko'chirishda ESKI savol id sini yangi
`exercise_items.id` sifatida SAQLAB QOLING (id o'zgarmaydi) — shunda `student_answers` ga
umuman tegish shart emas. Quiz itemlari uchun ham id saqlanadi.

### 4.5. Tartib

1. Yangi jadvallar yaratiladi (yoki quiz_exercises/quiz_items RENAME + ALTER).
2. Quiz ma'lumotlari moslashtiriladi (owner ustunlari to'ldiriladi).
3. Reading/listening savollari ko'chiriladi (id SAQLANGAN holda).
4. Tekshiruv so'rovlari (COUNT eski = COUNT yangi).
5. Eski 4 jadval DROP qilinadi.
6. Bootstrap idempotent bo'lsin: qayta ishga tushganda hech narsani buzmasin.

---

## 5. BACKEND KOD O'ZGARISHLARI (fayl-ba-fayl)

### 5.1. Entitylar (`src/common/core/entitys/`)

- `quiz-exercise.entity.ts` → `exercise.entity.ts` (`@Entity('exercises')`):
  `lessonId`, `ownerBlockType` (enum `StudentAnswerBlockType`), `ownerBlockId`,
  `exerciseType` (enum `QuizExerciseType`), `title`, `instructions`, `orderIndex`, `items`.
- `quiz-item.entity.ts` → `exercise-item.entity.ts` (`@Entity('exercise_items')`):
  `exerciseId`, `itemText`, `correctAnswer`, `options` (jsonb), `imageUrl`, `explanation`, `orderIndex`.
- `reading-question.entity.ts`, `reading-option.entity.ts`,
  `listening-question.entity.ts`, `listening-option.entity.ts` — birdan o'chirmang:
  avval migratsiya, keyin fayllar `export {}` stub qilinadi (sync qayta yaratmasligi uchun),
  modullardan forFeature/importlar olib tashlanadi.
- `reading-content.entity.ts`, `listening-content.entity.ts` dagi `questions` relationlari olib tashlanadi.

### 5.2. Teacher API (`modules/teacher-lessons/`)

BITTA umumiy mashq CRUD — blok turidan qat'i nazar:

```
GET    /teacher/lessons/:lessonId/blocks/:blockId/exercises
POST   /teacher/lessons/:lessonId/blocks/:blockId/exercises        — { exerciseType, title?, instructions? }
PUT    /teacher/lessons/:lessonId/blocks/:blockId/exercises/reorder
PUT    /teacher/lessons/:lessonId/blocks/:blockId/exercises/:exId
DELETE /teacher/lessons/:lessonId/blocks/:blockId/exercises/:exId
POST   /teacher/lessons/:lessonId/blocks/:blockId/exercises/:exId/items
PUT    .../items/:itemId
DELETE .../items/:itemId
```

- `:blockId` — istalgan kontent id (quiz/reading/listening/grammar). Server blok turini
  4 jadvaldan qidirib topadi (`resolveOwner(blockId)` helper) va `owner_block_type` ni o'zi qo'yadi.
- `blocks.service.ts` dagi eski quiz exercise CRUD shu umumiy CRUDga aylanadi.
- Eski reading/listening savol CRUD endpointlari yangi umumiy CRUDga proxy qilinadi,
  frontend yangilangach butunlay olib tashlanadi.
- `getBlocks` / `getLessonById` (teacher) — har blokka `exercises` haqida ma'lumot
  (soni + turlari) qo'shib qaytaradi.

### 5.3. Student API (`modules/lessons/`)

- `getLessonBlocks` — har blok uchun yagona format:

```json
{
  "id": "...", "type": "reading", "order": 2,
  "reading": { "title": "...", "content": "..." },
  "exercises": [
    { "id": "...", "type": "true_false", "title": "...", "instructions": null,
      "orderIndex": 0,
      "items": [ { "id": "...", "itemText": "...", "correctAnswer": "...",
                   "options": [], "imageUrl": null, "explanation": null, "orderIndex": 0 } ] }
  ]
}
```

  Quiz bloki ham, reading ham, listening ham, grammar ham AYNAN SHU formatda `exercises` qaytaradi.
- Submit — BITTA endpoint:

```
POST /lessons/:lessonId/blocks/:blockId/submit   body: { answers: [{ questionId, answer }] }
```

  Server `resolveOwner(blockId)` bilan blok turini topadi, mashqlarni `exercises` dan o'qiydi,
  baholaydi, `student_answers` ga yozadi, `lesson_progress` dagi tegishli `*_score` ni yangilaydi.
- ESKI endpointlar SAQLANADI (backward compat, mobil ilova ishlashda davom etishi uchun)
  va ichkarida yangi umumiy submitga delegatsiya qiladi:
  `/quiz/:quizId/submit`, `/reading/:blockId/submit`, `/listening/:blockId/submit`.
- `student-answers.service.ts` — submitQuiz/submitReading/submitListening o'rniga bitta
  `submitBlock(lessonId, blockId, userId, answers)`; baholash qoidalari:
  - `translation` — ballga kirmaydi (total ga qo'shilmaydi), javob baribir saqlanadi;
  - `true_false` — javob `correct_answer` ('true'/'false') bilan taqqoslanadi;
  - `multiple_choice`/`matching` — javob option `text` yoki `matchKey` ga normalizatsiya
    (`norm()`) bilan teng bo'lsa to'g'ri;
  - boshqa turlar — `correct_answer` bilan `norm()` orqali taqqoslash;
  - `*_score` maydoni `owner_block_type` dan aniqlanadi: quiz→quizScore, reading→readingScore,
    listening→listeningScore, grammar→grammarScore.

### 5.4. Modul/DI va bootstrap

- `lessons.module.ts`, `teacher-lessons.module.ts` — forFeature yangilanadi
  (Exercise, ExerciseItem qo'shiladi; ReadingQuestion/Option, ListeningQuestion/Option olib tashlanadi).
- `app.service.ts` — yangi bootstrap chaqiruvi (`ensureExercisesUnified()`), mavjud
  `ensureQuizEnum()` / `ensureStudentAnswersMigrated()` uslubida: sync dan keyin data ko'chirish,
  idempotent, xatoda ROLLBACK.

---

## 6. FRONTEND (WEB TEACHER) O'ZGARISHLARI

- `blocks/[blockId]/quiz/page.tsx` dagi mashq builder alohida komponentga ajratiladi:
  `components/teacher/lessons/ExerciseBuilder.tsx` — props: `lessonId`, `blockId`.
  6 tur (true_false, fill_in_blank, word_bank, translation, matching, multiple_choice) shu yerda.
- Reading teacher sahifasi: eski savol formalar o'rniga `<ExerciseBuilder />`.
- Listening teacher sahifasi: xuddi shunday (option formasiga rasm/matchKey maydonlari qo'shiladi).
- Grammar blok sahifasi: "Mashqlar" bo'limi qo'shiladi — `<ExerciseBuilder />`.
- `feature/teacher/interface.ts`: `TLQuizExercise`/`TLQuizItem` → `TLExercise`/`TLExerciseItem`
  (imageUrl, explanation, options obyekt formati), `lib/endpoints.ts` ga yangi yo'llar.

## 7. MOBIL ILOVA O'ZGARISHLARI (`ilova/src/`)

- `components/blocks/QuizBlockView.tsx` → umumiy `ExerciseRunner.tsx` ga ajratiladi.
  HOZIRGI OQIM SAQLANADI: har mashq alohida ekranda, alohida "Tekshirish",
  "Keyingi mashq →" tugmasi, progress chiziqchalari, yakuniy natija, klaviatura fix
  (padding + fokusdagi inputga scroll). Props: `exercises`, `lessonId`, `blockId`.
- `ReadingBlockView` — matndan keyin `<ExerciseRunner exercises={block.exercises} />`
  (eski lokal savol renderi olib tashlanadi).
- `ListeningBlockView` — audio/transcriptdan keyin `<ExerciseRunner />`
  (rasmli optionlar renderi qo'shiladi).
- Grammar tab — grammar sahifadan keyin mashqlar bo'lsa `<ExerciseRunner />`.
- `api/types.ts`: umumiy `Exercise`/`ExerciseItem` tiplar; `QuizBlock`, `ReadingBlock`,
  `ListeningBlock`, `GrammarBlock` hammasida `exercises: Exercise[]`.
- `api/lessons.api.ts`: submit yangi umumiy endpointga (`/blocks/:blockId/submit`),
  eski funksiya saqlanadi.

## 8. BAJARISH TARTIBI (xavfsiz ketma-ketlik)

1. DB: yangi entity/jadvallar + migratsiya + bootstrap (eski jadvallar hali turadi).
2. Backend: umumiy teacher CRUD + student `exercises` output + umumiy submit
   (eski endpointlar delegatsiya qiladi).
3. Web teacher: ExerciseBuilder hamma blok sahifalarida.
4. Mobil: ExerciseRunner hamma bloklarda.
5. Ma'lumot tekshiruvi (eski COUNT = yangi COUNT), so'ng eski jadvallar DROP + eski kod o'chirish.
6. To'liq regressiya: 9-bo'limdagi qabul mezonlari.

## 9. QABUL MEZONLARI (hammasi bajarilishi SHART)

- [ ] Bitta darsda quiz, reading, listening, grammar bloklarining HAR BIRIGA istalgan
      turdagi mashq (6 tur) teacher tomonidan qo'shiladi, tahrirlanadi, o'chiriladi.
- [ ] Reading/listening uchun ALOHIDA savol jadvallari qolmagan (`reading_questions`,
      `reading_options`, `listening_questions`, `listening_options` DROP qilingan).
- [ ] Mashq turi FAQAT `exercises.exercise_type` ustunida (enum).
- [ ] Blok bog'lanishi FAQAT `owner_block_type` + `owner_block_id` ustunlarida —
      blok turi uchun alohida jadval/ustun YO'Q.
- [ ] Eski reading/listening savollari yo'qolmagan — yangi tizimda ochiladi (id saqlangan).
- [ ] Student mobil ilovada 4 blok turida ham mashqlar bitta ExerciseRunner bilan ishlaydi
      (har mashq alohida, alohida tekshirish, keyingi mashq tugmasi).
- [ ] Submit hamma blok uchun `student_answers` ga yozadi va `lesson_progress` dagi tegishli
      `*_score` yangilanadi.
- [ ] Eski submit endpointlari ishlashda davom etadi (eski mobil build buzilmaydi).
- [ ] `npm run start:dev` xatosiz ko'tariladi (synchronize bilan), prod uchun migratsiyalar bor.
- [ ] Vocabulary tizimiga TEGILMAGAN.

## 10. TAQIQLAR

- `student_answers` va `lesson_progress` sxemasini o'zgartirmaslik.
- Har blok turi uchun alohida javob/mashq jadvali OCHMASLIK.
- Ma'lumotni migratsiyasiz DROP qilmaslik.
- Mobil ilovaning hozirgi quiz oqimini (stepper) va submit backward-compatni buzmaslik.
