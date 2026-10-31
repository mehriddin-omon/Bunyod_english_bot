import * as dotenv from 'dotenv';
dotenv.config();
import { Client } from 'pg';
import { VOCAB_SETS_SQL } from './vocab-sets.sql';

/**
 * `vocab_visible` funksiyasi va to'plam jadvali dev'da (migratsiya ishlamagan bo'lsa ham) bo'lsin.
 * Idempotent; TypeORM synchronize'dan KEYIN chaqiriladi (ustunlar entity'dan yaratilgan bo'ladi).
 */
export async function ensureVocabSets(): Promise<void> {
  const client = new Client({ connectionString: process.env.DB_URL });
  try {
    await client.connect();
    for (const sql of VOCAB_SETS_SQL) await client.query(sql);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[ensureVocabSets]', (e as Error).message);
  } finally {
    await client.end().catch(() => undefined);
  }
}
