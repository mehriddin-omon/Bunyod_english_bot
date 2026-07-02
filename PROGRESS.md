# Backend Code Review — To'liq Hisobot va Vazifalar

> **Umumiy baho: 63 / 100**
> **Sana:** 2026-07-02 · **Stack:** NestJS 11 · TypeORM 0.3 · PostgreSQL · TypeScript 5.7
> **Tekshirilgan:** 153 fayl / ~11 700 qator (`src/`)

Bu fayl loyihaning holatini baholaydi va har bir muammo uchun **to'g'ridan-to'g'ri ishlatsa bo'ladigan prompt** beradi. Promptni AI agentga yoki dasturchiga topshirish mumkin.

---

## 1. Umumiy baho: 63/100

**Asoslash:** Arxitektura NestJS konvensiyalariga mos, modullar toza ajratilgan, global guard + interceptor pattern to'g'ri qurilgan. Auth qatlami (bcrypt + refresh token rotation + startupda env validatsiya) mustahkam. Lekin **xavfsizlikda jiddiy teshiklar** bor (path traversal, rate limiting yo'q, upload'da role tekshiruvi yo'q), **DB tranzaksiyalari umuman ishlatilmagan**, va bir nechta endpoint **soxta/hardcoded ma'lumot** qaytaradi. Testlar 0 ta.

| Mezon | Ball | Izoh |
|-------|------|------|
| Arxitektura | 20/25 | Modul ajratish yaxshi, lekin 967-qatorli servis, `dto: any` |
| Xavfsizlik | 6/20 | Path traversal, rate limiting yo'q, upload role yo'q, 20GB limit |
| Ma'lumot to'g'riligi | 6/15 | Monitoring/statistics stub qaytaradi |
| Tip xavfsizligi | 7/10 | 9 ta `as any`, `Object.assign(entity, dto)` |
| Error handling | 12/15 | GlobalExceptionFilter yaxshi ishlangan |
| Testlar | 0/10 | Birorta spec yo'q |
| Hujjatlashtirish | 12/15 | README bor, `.env.sample` bor, Swagger yo'q |

---

## 2. ✅ Yaxshi qilingan narsalar

- **Env validatsiya startupda** — `config/config.service.ts:29-39`. Majburiy o'zgaruvchi yo'q bo'lsa `process.exit(1)`. To'g'ri yondashuv.
- **Global JWT guard + RolesGuard** `APP_GUARD` orqali — `guard/jwt/jwt.module.ts:24-31`. Barcha endpoint default himoyalangan, `@Public()` bilan ochiladi.
- **bcrypt + refresh token rotation** — `auth.service.ts:60,77`. Refresh token hash qilinib saqlanadi, har login/refreshda yangilanadi.
- **GlobalExceptionFilter** PG xato kodlarini (`23505`, `23503`) tarjima qiladi — `filters/global-exception.filter.ts:31-39`.
- **ValidationPipe** `whitelist + forbidNonWhitelisted` — `app.service.ts:40-47`. Ortiqcha maydonlar rad etiladi.
- **helmet + CORS** sozlangan — `app.service.ts:25-26`.
- **SRS algoritmi** matematik jihatdan izchil — `vocabulary.service.ts:15-27`.
- **TTS fire-and-forget** ichki `try/catch` bilan `null` qaytaradi — HTTP javobni bloklamaydi (`tts.service.ts:29-33`).

---

## 3. 🔴 Kritik muammolar

### K1 — Path traversal: foydalanuvchi ixtiyoriy faylni o'chira oladi
- **Fayl:** `src/modules/upload/upload.controller.ts:45-54`
- **Xavf:** `oldUrl` request body'dan olinadi va `join(process.cwd(), relative)` bilan birlashtiriladi. `oldUrl = "/../../etc/passwd"` yoki `"../../src/main.ts"` yuborilsa, server o'z fayllarini o'chirishi mumkin.
- **Prompt:**
```
upload.controller.ts dagi deleteOldFile funksiyasini path traversal'dan himoyala.
oldPath ni tozalab, faqat process.cwd()/uploads/ ichidagi fayllarni o'chirishga ruxsat ber:
1. path.normalize() qil
2. path.resolve(uploadsDir, filename) natijasi uploadsDir bilan boshlanishini tekshir
   (resolved.startsWith(uploadsDir + path.sep)) — aks holda o'chirmasdan qaytar
3. faqat fayl nomini (path.basename) ishlat, to'liq yo'lni emas
Barcha 4 ta update endpoint (audio/image/video/document) shu himoyadan foydalanishini ta'minla.
```

### K2 — Video upload limiti 20 GB (DoS / disk to'ldirish)
- **Fayl:** `src/modules/upload/upload.controller.ts:145,164` → `20 * 1024 * 1024 * 1024`
- **Xavf:** Bitta so'rov 20 GB fayl yuklashi mumkin — disk to'lib server o'ladi. Aftidan `20 * 1024 * 1024` (20 MB) mo'ljallangan, `* 1024` ortiqcha.
- **Prompt:**
```
upload.controller.ts da video uchun fileSize limitini 20 * 1024 * 1024 * 1024 (20GB) dan
oqilona qiymatga tushir (masalan 200 * 1024 * 1024 = 200MB). uploadVideo va updateVideo
ikkalasida ham tuzat. Limitlarni fayl boshida const sifatida markazlashtir:
const MAX_VIDEO = 200*1024*1024; const MAX_IMAGE = 5*1024*1024; MAX_AUDIO=50MB; MAX_DOC=20MB.
```

### K3 — Upload endpointlarida rol tekshiruvi yo'q
- **Fayl:** `src/modules/upload/upload.controller.ts:37` (`@Controller('upload')` — hech qanday `@Roles`)
- **Xavf:** Global JWT guard tufayli login shart, lekin **istalgan rol** (oddiy student ham) audio/video/hujjat yuklay oladi. Faqat teacher/admin yuklashi kerak edi.
- **Prompt:**
```
upload.controller.ts ga class darajasida @Roles(Role.teacher, Role.admin) qo'sh
(roles.decorator dan). Shunda faqat o'qituvchi va admin fayl yuklay oladi.
Agar student ham avatar yuklashi kerak bo'lsa, faqat /upload/image ni alohida ruxsat bilan qoldir.
```

### K4 — Rate limiting yo'q (brute-force login)
- **Fayl:** `src/modules/auth/auth.controller.ts` (throttler o'rnatilmagan — `package.json` da `@nestjs/throttler` yo'q)
- **Xavf:** Login endpointiga cheksiz urinish mumkin — parolni brute-force qilish real.
- **Prompt:**
```
@nestjs/throttler o'rnat va sozla:
1. npm i @nestjs/throttler
2. app.module.ts ga ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]) qo'sh
3. APP_GUARD sifatida ThrottlerGuard ni ro'yxatga ol
4. auth.controller.ts dagi login va register endpointlariga
   @Throttle({ default: { limit: 5, ttl: 60000 } }) qo'sh (daqiqada 5 urinish)
```

### K5 — DB tranzaksiyalari umuman ishlatilmagan (yetim yozuvlar)
- **Fayl:** `src/modules/auth/auth.service.ts:41-61` (register)
- **Xavf:** `register` avval `user` saqlaydi, keyin alohida `gamification` saqlaydi. Ikkinchisi xato bersa — gamification'siz yetim user qoladi. `grep -rn "transaction" src/modules` → **0 natija**.
- **Prompt:**
```
auth.service.ts dagi register metodini DataSource.transaction ichiga o'ra.
User yaratish + UserGamification yaratish + refreshToken saqlash — hammasi bitta
tranzaksiyada bo'lsin, biror bosqich yiqilsa hammasi rollback bo'lsin.
DataSource ni konstruktorga inject qil (@InjectDataSource). Xuddi shu pattern'ni
vocabulary.service.ts createPair/deletePair va progress bilan gamification birga
yozadigan joylarga ham qo'lla.
```

### K6 — Endpointlar soxta (hardcoded) ma'lumot qaytaradi
- **Fayl:** `src/modules/statistics/statistics.service.ts:134-150` (`cefr_level:'B1'`, skills `pct: 88` hardcoded), `src/modules/monitoring/monitoring.service.ts:98` (`avg_score: 84`, `weekly_activity: []`)
- **Xavf:** Frontend/mobil ilova haqiqiy bo'lmagan statistikani foydalanuvchiga ko'rsatadi. Ishonchni yo'qotadi, "ishlayapti" degan yolg'on taassurot beradi.
- **Prompt:**
```
statistics.service.ts getMyStats va monitoring.service.ts getGroupMonitoring dagi
hardcoded qiymatlarni (cefr B1, skills pct, avg_score 84, weekly_activity []) haqiqiy
hisob-kitobga almashtir:
- skills pct larni lesson_progress va quiz natijalaridan hisobla
- cefr_level ni umumiy o'rtacha balldan chiqar (mapping funksiya yoz)
- weekly_activity ni oxirgi 7 kunlik daily_tracking dan to'ldir
Agar hozircha real hisoblab bo'lmasa, hech bo'lmasa qiymatlarni null qaytar va
javob shaklida "computed: false" flag qo'y, frontend "ma'lumot yo'q" ko'rsatsin.
```

---

## 4. 🟡 O'rta muammolar

### O1 — N+1 query monitoring va gamification'da
- **Fayl:** `src/modules/monitoring/monitoring.service.ts` (student har biri uchun alohida so'rov)
- **Prompt:**
```
monitoring.service.ts da har student uchun alohida bajarilayotgan so'rovlarni
bitta batch so'rovga birlashtir: userId lar ro'yxatini yig'ib, In([...ids]) bilan
bitta findda olib, keyin xotirada Map bo'yicha guruhlab chiqar. gamification.service
leaderboard'da ham xuddi shunday qil.
```

### O2 — `dto: any` — validatsiyasiz body
- **Fayl:** `src/modules/teacher-lessons/blocks.controller.ts:59,78,106,115,125` va `blocks.service.ts:213,236,304`
- **Prompt:**
```
blocks.controller.ts va blocks.service.ts dagi barcha `dto: any` larni
to'g'ri DTO class'larga almashtir (SaveReadingDto, SaveListeningDto, UpdateQuestionDto).
Har biriga class-validator dekoratorlarini qo'y (@IsString, @IsArray, @ValidateNested).
ValidationPipe allaqachon global, shuning uchun DTO qo'yilishi bilan validatsiya ishlaydi.
```

### O3 — `Object.assign(entity, dto)` — nazoratsiz maydon yozish
- **Fayl:** `src/modules/teacher-lessons/blocks.service.ts:240`, `src/modules/statistics/statistics.service.ts:168`
- **Prompt:**
```
blocks.service.ts:240 va statistics.service.ts:168 dagi Object.assign(entity, dto)
ni aniq maydon tayinlashga almashtir (faqat kerakli, ruxsat etilgan maydonlar).
Bu mijoz id/created_at kabi maydonlarni ustidan yozib yuborishining oldini oladi.
```

### O4 — 967-qatorli servis (SRP buzilishi)
- **Fayl:** `src/modules/vocabulary/vocabulary.service.ts` (967 qator)
- **Prompt:**
```
vocabulary.service.ts (967 qator) ni mas'uliyat bo'yicha bo'l:
- VocabularyCrudService (word/pair CRUD)
- VocabularySessionService (session yaratish/yakunlash, SRS logikasi)
- VocabularyProgressService (progress hisoblash)
Modulda hammasini provider qilib, controller kerakligini inject qilsin.
```

### O5 — Production CORS origini validatsiyasiz
- **Fayl:** `src/config/config.service.ts:62-65` — `FRONTEND_URL` bo'sh bo'lsa `origin: []` (hamma bloklanadi)
- **Prompt:**
```
config.service.ts da production CORS uchun FRONTEND_URL ni requiredVariables ro'yxatiga
NODE_ENV=production bo'lganda majburiy qil. Bo'sh bo'lsa startupda ogohlantirish log qil,
chunki origin:[] barcha frontendni bloklaydi va "nega ishlamayapti" deb vaqt ketadi.
```

---

## 5. 🟠 Jamoa tushunarliligini yomonlashtiradigan narsalar

### J1 — Testlar umuman yo'q
- **Fayl:** butun `src/` (0 ta `.spec.ts`)
- **Prompt:**
```
Kamida kritik oqimlarga unit test yoz (Jest allaqachon sozlangan):
- auth.service.spec.ts: register duplicate username, login wrong password, refresh invalid token
- progress.service.spec.ts: assertLessonAccessible gating logikasi
- vocabulary SRS: computeVocabStatus chegara holatlari
Mock repository bilan (getRepositoryToken) yoz.
```

### J2 — Aralash til va `entitys` typo
- **Fayl:** `src/common/core/entitys/` (to'g'risi `entities`), xato xabarlari uzbek+ingliz aralash
- **Prompt:**
```
entitys papkasini entities ga qayta nomla va barcha importlarni yangila.
Xato xabarlarini bitta tilga (uzbek) keltir. Bu faqat kosmetik, lekin yangi
dasturchi uchun tushunarlilikni oshiradi.
```

### J3 — Swagger yo'q
- **Prompt:**
```
@nestjs/swagger o'rnat, app.service.ts da SwaggerModule.setup('api/docs', ...) qo'sh.
DTO larga @ApiProperty qo'y. Bu frontend/mobil jamoaga API ni hujjatsiz o'rganish
o'rniga /api/docs dan ko'rish imkonini beradi.
```

### J4 — Shubhali paketlar
- **Fayl:** `package.json:37,40` — `"env": "^0.0.2"`, `"nest": "^0.1.6"` (ishlatilmaydigan/noto'g'ri paketlar)
- **Prompt:**
```
package.json dan "env" (0.0.2) va "nest" (0.1.6) paketlarini olib tashla —
bular ishlatilmaydi (dotenv va @nestjs/* alohida bor). npm uninstall env nest.
```

---

## 6. Bajarilishi kerak bo'lgan ishlar (muhimlik tartibida)

| # | Vazifa | Fayl:Qator | Vaqt | Baho ta'siri |
|---|--------|-----------|------|-------------|
| 1 | Path traversal himoyasi | `upload.controller.ts:45` | 30 daq | +6 |
| 2 | Video 20GB → 200MB limit | `upload.controller.ts:145,164` | 10 daq | +3 |
| 3 | Upload'ga `@Roles` | `upload.controller.ts:37` | 15 daq | +3 |
| 4 | Rate limiting (throttler) | `auth.controller.ts` | 1 soat | +5 |
| 5 | Register'ni transaction'ga o'rash | `auth.service.ts:41` | 1 soat | +4 |
| 6 | Monitoring/statistics stub → real | `statistics.service.ts:134`, `monitoring.service.ts:98` | 6 soat | +5 |
| 7 | N+1 → batch | `monitoring.service.ts` | 2 soat | +3 |
| 8 | `dto: any` → DTO class | `blocks.controller.ts`, `blocks.service.ts` | 3 soat | +3 |
| 9 | `Object.assign` → aniq assign | `blocks.service.ts:240` | 1 soat | +2 |
| 10 | vocabulary.service bo'lish | `vocabulary.service.ts` | 3 soat | +2 |
| 11 | Prod CORS validatsiya | `config.service.ts:62` | 20 daq | +1 |
| 12 | Kritik unit testlar | yangi | 1 kun | +5 |
| 13 | Swagger | `app.service.ts` | 2 soat | +2 |
| 14 | `env`/`nest` paket olib tashlash | `package.json` | 5 daq | +1 |

## 7. Qanday bahoga yetish mumkin?

- **Hozir:** 63/100
- **Kritiklar (#1-6) tuzatilsa:** ~79/100 (~1 kun)
- **O'rtalar (#7-11) tuzatilsa:** ~87/100 (~2 kun)
- **Testlar + docs (#12-14) tuzatilsa:** ~95/100 (~1 hafta)
