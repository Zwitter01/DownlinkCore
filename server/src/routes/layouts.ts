import { Router, Request, Response } from 'express';
import { db } from '../storage/db';

// ─────────────────────────────────────────────────────────────────────────────
// Layouts Routes — persist dashboard layouts server-side (backup)
// ─────────────────────────────────────────────────────────────────────────────

export const layoutsRouter = Router();

layoutsRouter.get('/', (_req: Request, res: Response) => {
  const rows = db.prepare('SELECT * FROM layouts ORDER BY created_at ASC').all();
  res.json({ layouts: rows });
});

layoutsRouter.post('/', (req: Request, res: Response) => {
  const { id, name, is_default, data } = req.body as {
    id: string; name: string; is_default: boolean; data: unknown;
  };
  if (!id || !name || data === undefined) {
    res.status(400).json({ error: 'id, name, and data are required' });
    return;
  }
  const now = Date.now();
  db.prepare(`
    INSERT INTO layouts (id, name, is_default, data, created_at, updated_at)
    VALUES (@id, @name, @is_default, @data, @created_at, @updated_at)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      is_default = excluded.is_default,
      data = excluded.data,
      updated_at = excluded.updated_at
  `).run({
    id, name,
    is_default: is_default ? 1 : 0,
    data: JSON.stringify(data),
    created_at: now,
    updated_at: now,
  });
  res.json({ ok: true });
});

layoutsRouter.delete('/:id', (req: Request, res: Response) => {
  db.prepare('DELETE FROM layouts WHERE id = ?').run(req.params['id']);
  res.json({ ok: true });
});
