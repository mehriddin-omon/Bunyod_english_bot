# Frontend Promptlar (Lesson + Vocabulary)

Quyidagi promptlarni frontend AI ga ketma-ket yuboring.
Maqsad: hozircha faqat Lesson va Vocabulary qismini to'liq ishlaydigan holatga keltirish.

--------------------------------------------------

PROMPT 1: API layer va type larni tayyorlash

Siz Senior Frontend engineersiz. Menda backend tayyor va sizga aniq API contract beraman.
Vazifa: faqat Lesson va Vocabulary uchun production darajadagi API layer, type lar va query hook larni yozing.

Texnologiya:
- React + TypeScript
- TanStack Query
- Axios
- React Router
- Formik yoki React Hook Form (o'zingiz tanlang)

Asosiy talablar:
1) Base URL: http://localhost:2003/api/v1
2) Backend barcha javoblarni wrapper bilan qaytaradi:
   - statusCode: number
   - message: string
   - data: any
3) API client darajasida unwrap qiling:
   - agar response.data.data mavjud bo'lsa, o'shani qaytaring
   - xatoda message ni normalize qiling
4) Global auth token ishlating:
   - Authorization: Bearer <accessToken>
   - 401 bo'lsa refresh endpoint bilan access token yangilang va requestni 1 marta retry qiling
5) Strong typing:
   - Lesson, LessonStatus, VocabularyWord, VocabularyPair, VocabularyQuizQuestion

Endpointlar:
- POST /auth/login
  body: { username: string, password: string }
  data: { accessToken: string, refreshToken: string }

Lesson API (auth talab qiladi):
- POST /lesson/create
  body: { lesson_name: string }
- PUT /lesson/update
  body: { id: string, lesson_name: string, status: "draft" | "published" | "archived" }
- GET /lesson/all
  data: Lesson[]
- GET /lesson/:lesson_id/vocabulary
  data: VocabularyWord[]

Vocabulary API (hozir backendda public):
- POST /vocabulary/create
  body: {
    word: string,
    lang?: string,
    translation: string,
    example?: string,
    lesson_id?: string
  }
- POST /vocabulary/import-text
  body: { text: string, lesson_id?: string }
- GET /vocabulary/all
- GET /vocabulary/findVocabularyPairs
- GET /vocabulary/generateVocabularyQuiz

Muhim:
- Backend ba'zi joylarda null/undefined qaytarishi mumkin, defensive parser yozing.
- 4xx/5xx uchun yagona AppError model qiling.

Natija:
- src/api/client.ts
- src/api/auth.api.ts
- src/api/lesson.api.ts
- src/api/vocabulary.api.ts
- src/types/api.ts
- src/hooks/useLessons.ts
- src/hooks/useVocabulary.ts
- src/hooks/useAuth.ts

Oxirida qisqa changelog yozing: qaysi faylga nima qo'shdingiz.

--------------------------------------------------

PROMPT 2: Lesson management UI ni to'liq qilish

Siz Senior Frontend engineersiz.
API layer allaqachon tayyor deb hisoblang. Endi Lesson management UI ni to'liq yozing.

Maqsad:
- Lesson list sahifasi
- Lesson create form
- Lesson update modal (name + status)
- Lesson detail sahifasi: darsga biriktirilgan vocabulary ro'yxati

Sahifalar:
1) /lessons
   - GET /lesson/all bilan list
   - Har bir card: lesson_name, status, created_at
   - Actions: Edit, Open Vocabulary
2) /lessons/new
   - POST /lesson/create
   - Validatsiya: lesson_name required, min 3
3) /lessons/:id
   - GET /lesson/:lesson_id/vocabulary
   - Table: word, lang, example, order_index
4) Edit modal
   - PUT /lesson/update
   - status select: draft | published | archived

UX talablari:
- Loading skeleton
- Empty state
- Error state + retry
- Toast success/error
- Optimistic update yoki invalidate strategy
- Mobile responsive

Kod sifati:
- Reusable componentlar
- Feature-based folder structure
- Type-safe form va API
- No any

Natija:
- Routing config
- Lessons page componentlari
- Lesson form komponenti
- Lesson update modal
- Lesson detail vocabulary table

Oxirida:
- Qaysi endpointlar qayerda ishlatilganini punkt bilan yozing.

--------------------------------------------------

PROMPT 3: Vocabulary management + import + quiz UI

Siz Senior Frontend engineersiz.
API layer va Lesson UI bor deb hisoblang.
Endi Vocabulary modulini to'liq yakunlang.

Maqsad:
- Vocabulary list
- Single create form
- Bulk import text form
- Vocabulary pairs preview
- Vocabulary quiz preview

Sahifalar:
1) /vocabulary
   - GET /vocabulary/all
   - Filter: lang bo'yicha
   - Search: word bo'yicha client-side
2) /vocabulary/new
   - POST /vocabulary/create
   - fieldlar:
     - word (required)
     - lang (default: en)
     - translation (required, comma bilan bir nechta bo'lishi mumkin)
     - example (optional)
     - lesson_id (optional)
3) /vocabulary/import
   - POST /vocabulary/import-text
   - textarea input formati:
     - apple /aepel/ - olma
     - book - kitob
   - import natijasini jadvalda ko'rsating
4) /vocabulary/pairs
   - GET /vocabulary/findVocabularyPairs
   - ko'rinish: vocabulary_word -> translation_word
5) /vocabulary/quiz-preview
   - GET /vocabulary/generateVocabularyQuiz
   - har bir savol: question, options[], correct
   - reveal answer toggle

UX:
- Form validation
- Duplicate submitdan himoya
- Muvaffaqiyatli importdan keyin list yangilansin
- Xatolik matnini backend message dan chiqaring

Natija:
- Vocabulary page lar va route lar
- Form componentlar
- Quiz preview UI
- Query key larni tartibli nomlash

Oxirida:
- Manual test checklist yozing (kamida 10 ta punkt).

--------------------------------------------------

PROMPT 4: Frontend QA va acceptance

Siz Frontend QA + Refactor mode da ishlang.
Mavjud Lesson va Vocabulary featurelarni audit qiling va quyidagilarni bajaring:

1) Acceptance Criteria:
- Login ishlaydi va token saqlanadi
- Protected Lesson endpointlar Bearer bilan ishlaydi
- /lessons da list to'g'ri chiqadi
- Lesson create/update xatosiz ishlaydi
- /lessons/:id vocabulary ko'rsatadi
- Vocabulary create va import-text ishlaydi
- Pairs va Quiz preview endpointlari ishlaydi

2) Texnik talab:
- ESLint xatolari 0
- TypeScript error 0
- Dead code olib tashlansin
- Re-render optimizatsiyasi (kerak joyda memo/useMemo)

3) UX talab:
- Loading/Error/Empty state hamma asosiy ekranda bor
- Responsive 360px dan boshlab to'g'ri ishlaydi

Natija formati:
- Topilgan muammolar ro'yxati
- Qilingan fixlar ro'yxati
- Yakuniy "ready/not ready" status

--------------------------------------------------

Qisqa izoh:
- Backendda Lesson endpointlari auth talab qiladi.
- Vocabulary endpointlari hozircha public, lekin frontend baribir token bilan ishlashga tayyor bo'lsin.
- Hozir faqat Lesson + Vocabulary scope. Qolgan modullarni qo'shmang.
