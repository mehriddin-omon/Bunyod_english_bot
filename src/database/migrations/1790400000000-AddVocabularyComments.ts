import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * LUG'AT IZOHLARI — talabalar yozadigan mnemonika / misol gap / yangi ma'no taklifi,
 * like'lar va xabarlar (`vocabulary_comments`, `vocabulary_comment_likes`,
 * `vocabulary_comment_reports`).
 *
 * Izoh inglizcha SO'ZGA (`word_key`) bog'lanadi, juftlikka emas — lug'at almashtirilib
 * juftlik o'chsa ham izoh qoladi (`pair_id` shunda NULL bo'ladi).
 * Development'da TypeORM `synchronize` jadvallarni o'zi yaratadi; bu migratsiya production uchun.
 * Idempotent: IF NOT EXISTS bilan.
 */
export class AddVocabularyComments1790400000000 implements MigrationInterface {
  name = 'AddVocabularyComments1790400000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS "vocabulary_comments" (
        "id"              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id"         uuid         NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "word_key"        varchar(120) NOT NULL,
        "word_text"       varchar(120) NOT NULL,
        "kind"            varchar(16)  NOT NULL,
        "body"            text         NOT NULL,
        "meaning_text"    varchar(160),
        "meaning_key"     varchar(160),
        "pair_id"         uuid         REFERENCES "vocabulary_relations"("id") ON DELETE SET NULL,
        "status"          varchar(16)  NOT NULL DEFAULT 'active',
        "like_count"      int          NOT NULL DEFAULT 0,
        "coins_awarded"   int          NOT NULL DEFAULT 0,
        "report_count"    int          NOT NULL DEFAULT 0,
        "pinned"          boolean      NOT NULL DEFAULT false,
        "moderation_note" varchar(200),
        "created_at"      timestamptz  NOT NULL DEFAULT now(),
        "updated_at"      timestamptz  NOT NULL DEFAULT now()
      )
    `);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_vocab_comments_word_status" ON "vocabulary_comments" ("word_key", "status")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_vocab_comments_user_word" ON "vocabulary_comments" ("user_id", "word_key")`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "vocabulary_comment_likes" (
        "id"         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        "comment_id" uuid        NOT NULL REFERENCES "vocabulary_comments"("id") ON DELETE CASCADE,
        "user_id"    uuid        NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_vocab_comment_likes" ON "vocabulary_comment_likes" ("comment_id", "user_id")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_vocab_comment_likes_user" ON "vocabulary_comment_likes" ("user_id")`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "vocabulary_comment_reports" (
        "id"         uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
        "comment_id" uuid         NOT NULL REFERENCES "vocabulary_comments"("id") ON DELETE CASCADE,
        "user_id"    uuid         NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "reason"     varchar(200),
        "resolved"   boolean      NOT NULL DEFAULT false,
        "created_at" timestamptz  NOT NULL DEFAULT now(),
        "updated_at" timestamptz  NOT NULL DEFAULT now()
      )
    `);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_vocab_comment_reports" ON "vocabulary_comment_reports" ("comment_id", "user_id")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "vocabulary_comment_reports"`);
    await q.query(`DROP TABLE IF EXISTS "vocabulary_comment_likes"`);
    await q.query(`DROP TABLE IF EXISTS "vocabulary_comments"`);
  }
}
