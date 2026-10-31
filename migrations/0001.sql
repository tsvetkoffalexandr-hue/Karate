CREATE TABLE leads (
 id TEXT PRIMARY KEY, language TEXT NOT NULL DEFAULT 'ru', step TEXT NOT NULL DEFAULT 'consent',
 parent TEXT, age INTEGER, contact TEXT, consent_at TEXT, status TEXT NOT NULL DEFAULT 'new',
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE slots (id TEXT PRIMARY KEY, starts_at TEXT NOT NULL, capacity INTEGER NOT NULL CHECK(capacity>0), label TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1);
CREATE TABLE bookings (lead_id TEXT PRIMARY KEY REFERENCES leads(id), slot_id TEXT NOT NULL REFERENCES slots(id), created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));
CREATE INDEX bookings_slot ON bookings(slot_id);
CREATE TRIGGER booking_capacity BEFORE INSERT ON bookings BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM slots WHERE id=NEW.slot_id AND active=1 AND starts_at>strftime('%Y-%m-%dT%H:%M:%fZ','now')) THEN RAISE(ABORT,'slot_unavailable') END;
 SELECT CASE WHEN (SELECT COUNT(*) FROM bookings WHERE slot_id=NEW.slot_id)>=(SELECT capacity FROM slots WHERE id=NEW.slot_id) THEN RAISE(ABORT,'slot_full') END;
END;
CREATE TABLE updates (id INTEGER PRIMARY KEY, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));
CREATE TABLE outbox (id INTEGER PRIMARY KEY AUTOINCREMENT, update_id INTEGER NOT NULL UNIQUE REFERENCES updates(id), chat_id TEXT NOT NULL, payload TEXT NOT NULL, sent_at TEXT, attempts INTEGER NOT NULL DEFAULT 0);
CREATE TABLE events (id INTEGER PRIMARY KEY AUTOINCREMENT, agent TEXT NOT NULL, action TEXT NOT NULL, outcome TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));
CREATE INDEX events_recent ON events(created_at);
CREATE TABLE budget (day TEXT PRIMARY KEY, count INTEGER NOT NULL);
