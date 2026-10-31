ALTER TABLE growth_channels ADD COLUMN platform TEXT NOT NULL DEFAULT 'telegram';
ALTER TABLE growth_channels ADD COLUMN access_status TEXT NOT NULL DEFAULT 'needs_review';
ALTER TABLE growth_channels ADD COLUMN access_evidence TEXT;
ALTER TABLE growth_posts ADD COLUMN published_url TEXT;
ALTER TABLE growth_posts ADD COLUMN status_evidence TEXT;
ALTER TABLE growth_posts ADD COLUMN updated_at TEXT;
CREATE TABLE IF NOT EXISTS growth_history (
 id INTEGER PRIMARY KEY AUTOINCREMENT, channel_id TEXT NOT NULL,
 post_id TEXT, status TEXT NOT NULL, evidence TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
