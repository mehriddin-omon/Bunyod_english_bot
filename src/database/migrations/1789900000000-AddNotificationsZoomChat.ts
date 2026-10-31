import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 1.2.0 (2026-11): bildirishnomalar (push + teacher xabari), onlayn (Zoom) darslar, guruh chati.
 *
 * Development'da `synchronize` o'zi yaratadi; bu production uchun.
 * Idempotent: IF NOT EXISTS bilan — qayta ishga tushsa xato bermaydi.
 */
export class AddNotificationsZoomChat1789900000000 implements MigrationInterface {
  public async up(q: QueryRunner): Promise<void> {
    const base = `"id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`;

    // ── Bildirishnomalar ─────────────────────────────────────────────────────
    await q.query(`
      CREATE TABLE IF NOT EXISTS "push_tokens" (
        ${base},
        "user_id" uuid NOT NULL,
        "token" character varying NOT NULL,
        "platform" character varying NOT NULL DEFAULT 'android',
        "app_build" integer,
        "is_active" boolean NOT NULL DEFAULT true,
        "last_seen_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_push_tokens" PRIMARY KEY ("id"),
        CONSTRAINT "FK_push_tokens_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_push_tokens_token" ON "push_tokens" ("token")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_push_tokens_user_active" ON "push_tokens" ("user_id", "is_active")`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "notification_broadcasts" (
        ${base},
        "sender_id" uuid NOT NULL,
        "title" character varying(120) NOT NULL,
        "body" text NOT NULL,
        "audience" jsonb NOT NULL,
        "action" jsonb,
        "status" character varying NOT NULL DEFAULT 'draft',
        "scheduled_at" TIMESTAMP WITH TIME ZONE,
        "sent_at" TIMESTAMP WITH TIME ZONE,
        "recipient_count" integer NOT NULL DEFAULT 0,
        "push_count" integer NOT NULL DEFAULT 0,
        CONSTRAINT "PK_notification_broadcasts" PRIMARY KEY ("id"),
        CONSTRAINT "FK_notification_broadcasts_sender" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE
      )`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_broadcasts_sender_created" ON "notification_broadcasts" ("sender_id", "created_at")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_broadcasts_status_scheduled" ON "notification_broadcasts" ("status", "scheduled_at")`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "notification_preferences" (
        "user_id" uuid NOT NULL,
        "teacher_messages" boolean NOT NULL DEFAULT true,
        "online_lessons" boolean NOT NULL DEFAULT true,
        "group_chat" boolean NOT NULL DEFAULT true,
        "chat_muted_until" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notification_preferences" PRIMARY KEY ("user_id"),
        CONSTRAINT "FK_notification_preferences_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )`);

    await q.query(`ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "sender_id" uuid`);
    await q.query(`ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "broadcast_id" uuid`);
    await q.query(`ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "action" jsonb`);
    await q.query(`ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "push_status" character varying NOT NULL DEFAULT 'none'`);
    await q.query(`ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "opened_at" TIMESTAMP WITH TIME ZONE`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_notifications_broadcast" ON "notifications" ("broadcast_id")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_notifications_user_created" ON "notifications" ("user_id", "created_at")`);

    await q.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "chat_rules_accepted_at" TIMESTAMP WITH TIME ZONE`);

    // ── Onlayn (Zoom) darslar ────────────────────────────────────────────────
    await q.query(`
      CREATE TABLE IF NOT EXISTS "online_lessons" (
        ${base},
        "teacher_id" uuid NOT NULL,
        "topic" character varying(200) NOT NULL,
        "starts_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "duration_min" integer NOT NULL DEFAULT 90,
        "audience" jsonb NOT NULL,
        "schedule_id" uuid,
        "zoom_meeting_id" character varying,
        "zoom_uuid" character varying,
        "join_url" text NOT NULL,
        "passcode" character varying,
        "settings" jsonb NOT NULL,
        "reminders" jsonb NOT NULL DEFAULT '[60,10,0]',
        "reminders_sent" jsonb NOT NULL DEFAULT '[]',
        "recording_visibility" character varying NOT NULL DEFAULT 'invited',
        "status" character varying NOT NULL DEFAULT 'scheduled',
        "started_at" TIMESTAMP WITH TIME ZONE,
        "ended_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_online_lessons" PRIMARY KEY ("id"),
        CONSTRAINT "FK_online_lessons_teacher" FOREIGN KEY ("teacher_id") REFERENCES "users"("id") ON DELETE CASCADE
      )`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_online_lessons_teacher_start" ON "online_lessons" ("teacher_id", "starts_at")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_online_lessons_status_start" ON "online_lessons" ("status", "starts_at")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_online_lessons_zoom" ON "online_lessons" ("zoom_meeting_id")`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "online_lesson_invitees" (
        ${base},
        "lesson_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "join_clicked_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_online_lesson_invitees" PRIMARY KEY ("id"),
        CONSTRAINT "FK_ol_invitees_lesson" FOREIGN KEY ("lesson_id") REFERENCES "online_lessons"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_ol_invitees_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_ol_invitees_lesson_user" ON "online_lesson_invitees" ("lesson_id", "user_id")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_ol_invitees_user" ON "online_lesson_invitees" ("user_id")`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "online_lesson_attendance" (
        ${base},
        "lesson_id" uuid NOT NULL,
        "user_id" uuid,
        "display_name" character varying NOT NULL,
        "participant_key" character varying,
        "join_time" TIMESTAMP WITH TIME ZONE NOT NULL,
        "leave_time" TIMESTAMP WITH TIME ZONE,
        "duration_sec" integer NOT NULL DEFAULT 0,
        CONSTRAINT "PK_online_lesson_attendance" PRIMARY KEY ("id"),
        CONSTRAINT "FK_ol_attendance_lesson" FOREIGN KEY ("lesson_id") REFERENCES "online_lessons"("id") ON DELETE CASCADE
      )`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_ol_attendance_lesson" ON "online_lesson_attendance" ("lesson_id")`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "online_lesson_recordings" (
        ${base},
        "lesson_id" uuid NOT NULL,
        "zoom_uuid" character varying,
        "zoom_file_id" character varying,
        "size_bytes" bigint NOT NULL DEFAULT 0,
        "duration_sec" integer NOT NULL DEFAULT 0,
        "status" character varying NOT NULL DEFAULT 'zoom_processing',
        "storage_kind" character varying,
        "storage_key" character varying,
        "copied_at" TIMESTAMP WITH TIME ZONE,
        "zoom_deleted_at" TIMESTAMP WITH TIME ZONE,
        "attempts" integer NOT NULL DEFAULT 0,
        "error" text,
        CONSTRAINT "PK_online_lesson_recordings" PRIMARY KEY ("id"),
        CONSTRAINT "FK_ol_recordings_lesson" FOREIGN KEY ("lesson_id") REFERENCES "online_lessons"("id") ON DELETE CASCADE
      )`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_ol_recordings_lesson" ON "online_lesson_recordings" ("lesson_id")`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "recording_views" (
        ${base},
        "recording_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "position_sec" integer NOT NULL DEFAULT 0,
        "completed" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_recording_views" PRIMARY KEY ("id"),
        CONSTRAINT "FK_recording_views_recording" FOREIGN KEY ("recording_id") REFERENCES "online_lesson_recordings"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_recording_views_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_recording_views_rec_user" ON "recording_views" ("recording_id", "user_id")`);

    // ── Guruh chati ──────────────────────────────────────────────────────────
    await q.query(`
      CREATE TABLE IF NOT EXISTS "group_chats" (
        ${base},
        "group_id" uuid NOT NULL,
        "is_enabled" boolean NOT NULL DEFAULT true,
        "teacher_only" boolean NOT NULL DEFAULT false,
        "pinned_message_id" uuid,
        CONSTRAINT "PK_group_chats" PRIMARY KEY ("id"),
        CONSTRAINT "FK_group_chats_group" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE
      )`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_group_chats_group" ON "group_chats" ("group_id")`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "chat_messages" (
        ${base},
        "chat_id" uuid NOT NULL,
        "sender_id" uuid NOT NULL,
        "body" text NOT NULL,
        "reply_to_id" uuid,
        "client_id" character varying,
        "edited_at" TIMESTAMP WITH TIME ZONE,
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        "deleted_by" uuid,
        CONSTRAINT "PK_chat_messages" PRIMARY KEY ("id"),
        CONSTRAINT "FK_chat_messages_chat" FOREIGN KEY ("chat_id") REFERENCES "group_chats"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_chat_messages_sender" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE
      )`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_chat_messages_chat_created" ON "chat_messages" ("chat_id", "created_at")`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "chat_reads" (
        ${base},
        "chat_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "last_read_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        CONSTRAINT "PK_chat_reads" PRIMARY KEY ("id"),
        CONSTRAINT "FK_chat_reads_chat" FOREIGN KEY ("chat_id") REFERENCES "group_chats"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_chat_reads_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_chat_reads_chat_user" ON "chat_reads" ("chat_id", "user_id")`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "chat_restrictions" (
        ${base},
        "chat_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "muted_until" TIMESTAMP WITH TIME ZONE NOT NULL,
        "created_by" uuid NOT NULL,
        CONSTRAINT "PK_chat_restrictions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_chat_restrictions_chat" FOREIGN KEY ("chat_id") REFERENCES "group_chats"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_chat_restrictions_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_chat_restrictions_chat_user" ON "chat_restrictions" ("chat_id", "user_id")`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "chat_reports" (
        ${base},
        "chat_id" uuid NOT NULL,
        "message_id" uuid NOT NULL,
        "reporter_id" uuid NOT NULL,
        "reason" character varying,
        "status" character varying NOT NULL DEFAULT 'open',
        "resolved_by" uuid,
        CONSTRAINT "PK_chat_reports" PRIMARY KEY ("id"),
        CONSTRAINT "FK_chat_reports_chat" FOREIGN KEY ("chat_id") REFERENCES "group_chats"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_chat_reports_message" FOREIGN KEY ("message_id") REFERENCES "chat_messages"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_chat_reports_reporter" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE CASCADE
      )`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_chat_reports_message_reporter" ON "chat_reports" ("message_id", "reporter_id")`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "chat_user_blocks" (
        ${base},
        "user_id" uuid NOT NULL,
        "blocked_user_id" uuid NOT NULL,
        CONSTRAINT "PK_chat_user_blocks" PRIMARY KEY ("id"),
        CONSTRAINT "FK_chat_user_blocks_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_chat_user_blocks_blocked" FOREIGN KEY ("blocked_user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_chat_user_blocks_pair" ON "chat_user_blocks" ("user_id", "blocked_user_id")`);

    // Mavjud guruhlarga chat
    await q.query(`INSERT INTO "group_chats" ("group_id") SELECT "id" FROM "groups" ON CONFLICT DO NOTHING`);
  }

  public async down(q: QueryRunner): Promise<void> {
    for (const t of [
      'chat_user_blocks',
      'chat_reports',
      'chat_restrictions',
      'chat_reads',
      'chat_messages',
      'group_chats',
      'recording_views',
      'online_lesson_recordings',
      'online_lesson_attendance',
      'online_lesson_invitees',
      'online_lessons',
      'notification_preferences',
      'notification_broadcasts',
      'push_tokens',
    ]) {
      await q.query(`DROP TABLE IF EXISTS "${t}"`);
    }
    await q.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "chat_rules_accepted_at"`);
    for (const c of ['sender_id', 'broadcast_id', 'action', 'push_status', 'opened_at']) {
      await q.query(`ALTER TABLE "notifications" DROP COLUMN IF EXISTS "${c}"`);
    }
  }
}
