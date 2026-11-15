import { db } from './db';

// ─────────────────────────────────────────────────────────────────────────────
// Database Migrations
// Versioned schema migrations run at startup.
// ─────────────────────────────────────────────────────────────────────────────

export function runMigrations(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      applied_at INTEGER NOT NULL
    );
  `);

  const currentVersion = (db.prepare('SELECT MAX(version) as v FROM schema_version').get() as { v: number | null }).v ?? 0;

  const migrations: Array<{ version: number; sql: string }> = [
    {
      version: 1,
      sql: `
        CREATE TABLE IF NOT EXISTS telemetry (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          ts          INTEGER NOT NULL,
          mission_id  TEXT    NOT NULL DEFAULT 'ORBITRA',
          device_id   TEXT    NOT NULL DEFAULT 'esp8266-rx',
          sensor_id   TEXT    NOT NULL,
          field_key   TEXT    NOT NULL,
          value       REAL    NOT NULL,
          packet_no   INTEGER,
          quality     TEXT    NOT NULL DEFAULT 'ok'
        );

        CREATE INDEX IF NOT EXISTS idx_telemetry_sensor_field_ts
          ON telemetry(sensor_id, field_key, ts);

        CREATE INDEX IF NOT EXISTS idx_telemetry_ts
          ON telemetry(ts);

        CREATE INDEX IF NOT EXISTS idx_telemetry_mission
          ON telemetry(mission_id, ts);
      `,
    },
    {
      version: 2,
      sql: `
        CREATE TABLE IF NOT EXISTS layouts (
          id          TEXT    PRIMARY KEY,
          name        TEXT    NOT NULL,
          is_default  INTEGER NOT NULL DEFAULT 0,
          data        TEXT    NOT NULL,
          created_at  INTEGER NOT NULL,
          updated_at  INTEGER NOT NULL
        );
      `,
    },
  ];

  for (const migration of migrations) {
    if (migration.version > currentVersion) {
      console.log(`[DB] Applying migration v${migration.version}…`);
      db.exec(migration.sql);
      db.prepare('INSERT INTO schema_version (version, applied_at) VALUES (?, ?)').run(
        migration.version,
        Date.now()
      );
      console.log(`[DB] Migration v${migration.version} applied.`);
    }
  }

  console.log(`[DB] Schema at version ${migrations[migrations.length - 1]?.version ?? 0}`);
}
