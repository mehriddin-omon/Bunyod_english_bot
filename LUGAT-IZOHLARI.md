# Lug'at izohlari (talaba mnemonika / gap / yangi ma'no)

- Izoh INGLIZCHA SO'ZGA bog'lanadi (`word_key`), ma'no (`meaning_key`) — ixtiyoriy yorliq (o'zbekcha tarjima matni). Lug'at almashtirilsa izoh yo'qolmaydi.
- Turlari: `mnemonic` · `sentence` · `meaning` (yangi ma'no taklifi — teacher tasdiqlamaguncha `pending`, like/coin hisoblanmaydi).
- Coin: 10 like = +1, 100 like = +1, 1000 like = +1 … cheklovsiz. Kalit `vcomment:<id>:t<k>` (XpSource.vocabulary_comment), bir martalik.
- Bitta talaba bitta izohga 1 marta like; o'ziga like yo'q; mehmon (guest) faqat o'qiydi.
- Limitlar: so'zga 2 ta izoh, kuniga 20 ta, 200 belgi, havola yo'q. 3 ta ochiq xabar → avtomatik yashirish.
- Teacher: `/teacher/vocabulary/comments` (tab: meanings|reports|pinned|hidden), approve {mode:'new_pair'|'attach', translation?, lessonId?} — `lessonId` yo'q bo'lsa «erkin lug'at».
- Student API: `vocabulary/comments` (preview, mine, list, create, update, delete, like, report).
- Migratsiya: `1790400000000-AddVocabularyComments` — production'da `npm run migration:run`.
- Frontend: `/teacher/vocab-comments`; ilova: `WordCommentsScreen`, `MyCommentsScreen`, `WordCommentsPreview` (VocabSession kartasi orqa tomoni).
