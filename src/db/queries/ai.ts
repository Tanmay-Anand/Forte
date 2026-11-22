import { sqlite } from '../client';
import { newId } from '@/lib/id';
import { bumpRevision } from '@/lib/db-hooks';

/**
 * Claude's replies, kept with the session they are about.
 *
 * On the default route Forte never talks to Claude itself: the person shares
 * a brief to the Claude app, and may paste the reply back here. Those rows
 * are provider 'pasted'. Deleting a session deletes its reply (ON DELETE
 * CASCADE).
 */
export const PROMPT_VERSION = 1;

export type SavedReply = { id: string; content: string; created_at: number };

export function getSessionReply(sessionId: string): SavedReply | null {
  return (
    sqlite.getFirstSync<SavedReply>(
      `SELECT id, content, created_at FROM ai_analyses
        WHERE kind = 'session' AND session_id = ? AND status = 'ok';`,
      [sessionId],
    ) ?? null
  );
}

export function saveSessionReply(sessionId: string, content: string): void {
  const text = content.trim();
  if (!text) return;
  const now = Date.now();
  sqlite.runSync(
    `INSERT INTO ai_analyses (id, kind, session_id, status, provider, prompt_version, content,
                              created_at, updated_at)
     VALUES (?, 'session', ?, 'ok', 'pasted', ?, ?, ?, ?)
     ON CONFLICT(session_id) WHERE kind = 'session'
       DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at;`,
    [newId('ai_'), sessionId, PROMPT_VERSION, text, now, now],
  );
  bumpRevision();
}

export function deleteSessionReply(sessionId: string): void {
  sqlite.runSync(`DELETE FROM ai_analyses WHERE kind = 'session' AND session_id = ?;`, [sessionId]);
  bumpRevision();
}

/** Settings → Claude analysis → Delete saved replies. */
export function deleteAllReplies(): void {
  sqlite.runSync(`DELETE FROM ai_analyses;`);
  bumpRevision();
}

export function countReplies(): number {
  return sqlite.getFirstSync<{ n: number }>(`SELECT COUNT(*) AS n FROM ai_analyses;`)?.n ?? 0;
}
