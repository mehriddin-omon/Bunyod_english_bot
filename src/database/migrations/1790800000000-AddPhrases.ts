import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * KUN IBORASI (2026-11): Bosh sahifadagi karusel.
 * - `phrases`              — o'qituvchi yuklagan ibora (matn + ixtiyoriy rasm/video)
 * - `phrase_likes`         — IBORA like'i (bitta o'quvchi 1 marta)
 * - `phrase_comments`      — «qay holatda ishlatgansiz?» javoblari
 * - `phrase_comment_likes` — IZOH like'i (ibora like'idan alohida sanoq)
 * Development'da `synchronize: true` o'zi yaratadi; bu production uchun.
 */
export class AddPhrases1790800000000 implements MigrationInterface {
  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS "phrases" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "text" varchar(200) NOT NULL,
        "transcription" varchar(200),
        "meaning_uz" varchar(400) NOT NULL,
        "examples" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "image_url" varchar,
        "video_url" varchar,
        "video_duration_sec" integer,
        "status" varchar(16) NOT NULL DEFAULT 'draft',
        "publish_at" timestamptz NOT NULL DEFAULT now(),
        "like_count" integer NOT NULL DEFAULT 0,
        "comment_count" integer NOT NULL DEFAULT 0,
        "created_by" uuid,
        CONSTRAINT "PK_phrases" PRIMARY KEY ("id"),
        CONSTRAINT "FK_phrases_author" FOREIGN KEY ("created_by")
          REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    await q.query(
      `CREATE INDEX IF NOT EXISTS "IDX_phrases_status_publish" ON "phrases" ("status", "publish_at")`,
    );

    await q.query(`
      CREATE TABLE IF NOT EXISTS "phrase_likes" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "phrase_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        CONSTRAINT "PK_phrase_likes" PRIMARY KEY ("id"),
        CONSTRAINT "FK_phrase_likes_phrase" FOREIGN KEY ("phrase_id")
          REFERENCES "phrases"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_phrase_likes_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await q.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_phrase_likes_unique" ON "phrase_likes" ("phrase_id", "user_id")`,
    );
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_phrase_likes_user" ON "phrase_likes" ("user_id")`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "phrase_comments" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "phrase_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "body" text NOT NULL,
        "status" varchar(16) NOT NULL DEFAULT 'active',
        "like_count" integer NOT NULL DEFAULT 0,
        "report_count" integer NOT NULL DEFAULT 0,
        CONSTRAINT "PK_phrase_comments" PRIMARY KEY ("id"),
        CONSTRAINT "FK_phrase_comments_phrase" FOREIGN KEY ("phrase_id")
          REFERENCES "phrases"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_phrase_comments_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    // Kartadagi izoh: like kamayish bo'yicha, teng bo'lsa eng avval yozilgani
    await q.query(
      `CREATE INDEX IF NOT EXISTS "IDX_phrase_comments_top" ON "phrase_comments" ("phrase_id", "status", "like_count")`,
    );
    await q.query(
      `CREATE INDEX IF NOT EXISTS "IDX_phrase_comments_user" ON "phrase_comments" ("user_id")`,
    );

    await q.query(`
      CREATE TABLE IF NOT EXISTS "phrase_comment_likes" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "comment_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        CONSTRAINT "PK_phrase_comment_likes" PRIMARY KEY ("id"),
        CONSTRAINT "FK_phrase_comment_likes_comment" FOREIGN KEY ("comment_id")
          REFERENCES "phrase_comments"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_phrase_comment_likes_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await q.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_phrase_comment_likes_unique" ON "phrase_comment_likes" ("comment_id", "user_id")`,
    );
    await q.query(
      `CREATE INDEX IF NOT EXISTS "IDX_phrase_comment_likes_user" ON "phrase_comment_likes" ("user_id")`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "phrase_comment_likes"`);
    await q.query(`DROP TABLE IF EXISTS "phrase_comments"`);
    await q.query(`DROP TABLE IF EXISTS "phrase_likes"`);
    await q.query(`DROP TABLE IF EXISTS "phrases"`);
  }
}
