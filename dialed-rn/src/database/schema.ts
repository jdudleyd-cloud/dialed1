// Expo SQLite schema — executed in order on first launch

export const CREATE_TABLES: string[] = [
  `CREATE TABLE IF NOT EXISTS plastics (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    manufacturer      TEXT NOT NULL,
    plastic_name      TEXT NOT NULL,
    durability_index  REAL NOT NULL CHECK(durability_index BETWEEN 0.0 AND 1.0),
    UNIQUE(manufacturer, plastic_name)
  )`,

  `CREATE TABLE IF NOT EXISTS discs_master (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    brand       TEXT NOT NULL,
    model       TEXT NOT NULL,
    speed       REAL NOT NULL,
    glide       REAL NOT NULL,
    turn        REAL NOT NULL,
    fade        REAL NOT NULL,
    stability   TEXT NOT NULL CHECK(stability IN ('Overstable','Understable','Neutral')),
    plastic_id  INTEGER NOT NULL REFERENCES plastics(id),
    UNIQUE(brand, model, plastic_id)
  )`,

  `CREATE TABLE IF NOT EXISTS user_inventory (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    disc_master_id  INTEGER NOT NULL REFERENCES discs_master(id),
    plastic_id      INTEGER NOT NULL REFERENCES plastics(id),
    weight          REAL NOT NULL,
    color           TEXT NOT NULL DEFAULT '#ffffff',
    custom_label    TEXT,
    throw_count     INTEGER NOT NULL DEFAULT 0,
    impact_events   INTEGER NOT NULL DEFAULT 0,
    current_turn    REAL NOT NULL,
    current_fade    REAL NOT NULL,
    wear_index      REAL NOT NULL DEFAULT 0.0 CHECK(wear_index BETWEEN 0.0 AND 1.0),
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS rounds (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    course_key     TEXT NOT NULL,
    started_at     TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at   TEXT,
    total_strokes  INTEGER,
    vs_ai_active   INTEGER NOT NULL DEFAULT 0
  )`,

  `CREATE TABLE IF NOT EXISTS throws (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    round_id              INTEGER REFERENCES rounds(id),
    inventory_id          INTEGER NOT NULL REFERENCES user_inventory(id),
    hole_number           INTEGER NOT NULL,
    course_key            TEXT NOT NULL,
    throw_type            TEXT NOT NULL CHECK(throw_type IN ('backhand','forehand','sidearm','tomahawk')),
    wind_condition        TEXT NOT NULL CHECK(wind_condition IN ('calm','light','moderate','strong')),
    wind_relation         TEXT CHECK(wind_relation IN ('headwind','tailwind','cross_left','cross_right')),
    measured_distance_ft  REAL NOT NULL,
    expected_distance_ft  REAL NOT NULL,
    lateral_offset_ft     REAL NOT NULL DEFAULT 0,
    is_severe_impact      INTEGER NOT NULL DEFAULT 0,
    tee_lat               REAL,
    tee_lon               REAL,
    landing_lat           REAL,
    landing_lon           REAL,
    created_at            TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS schema_migrations (
    version     INTEGER PRIMARY KEY,
    applied_at  TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
]
