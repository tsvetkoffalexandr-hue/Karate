CREATE TABLE IF NOT EXISTS growth_channels (
 id TEXT PRIMARY KEY, url TEXT NOT NULL, title TEXT NOT NULL, description TEXT DEFAULT '',
 source_url TEXT NOT NULL, score INTEGER DEFAULT 0, checked_at TEXT,
 permission_note TEXT, chat_id TEXT, enabled INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS growth_posts (
 id TEXT PRIMARY KEY, channel_id TEXT NOT NULL REFERENCES growth_channels(id),
 language TEXT NOT NULL, text TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft',
 scheduled_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 sent_at TEXT, message_id INTEGER, error TEXT
);
CREATE TABLE IF NOT EXISTS growth_runs (
 agent TEXT PRIMARY KEY, started_at TEXT, finished_at TEXT, status TEXT, detail TEXT
);
