-- ============================================================
-- FULL DATABASE RESET — barcha tablelarni o'chiradi
-- TypeORM synchronize qayta yaratadi
-- ============================================================

-- Foreign key constraintlarni vaqtincha o'chirish
SET session_replication_role = replica;

-- Barcha public tablelarni o'chirish
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public'
    ) LOOP
        EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
        RAISE NOTICE 'Dropped table: %', r.tablename;
    END LOOP;
END
$$;

-- Foreign key constraintlarni qayta yoqish
SET session_replication_role = DEFAULT;

SELECT 'Reset muvaffaqiyatli yakunlandi' AS status;
