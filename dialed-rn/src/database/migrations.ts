// Database migrations — run once on first launch, idempotent
// Each migration has a version number; already-applied versions are skipped.

import type { SQLiteDatabase } from 'expo-sqlite'

export const CURRENT_SCHEMA_VERSION = 2

// ─── Plastic durability seed data ─────────────────────────────────────────────
// durability_index: 0.0–1.0. Higher = plastic holds factory specs longer.
// Values derived from community wear data + manufacturer specs.

const PLASTIC_SEED: Array<{ manufacturer: string; plastic_name: string; durability_index: number }> = [
  // Innova
  { manufacturer: 'Innova', plastic_name: 'Champion',    durability_index: 0.95 },
  { manufacturer: 'Innova', plastic_name: 'Star',        durability_index: 0.88 },
  { manufacturer: 'Innova', plastic_name: 'GStar',       durability_index: 0.86 },
  { manufacturer: 'Innova', plastic_name: 'Halo Star',   durability_index: 0.90 },
  { manufacturer: 'Innova', plastic_name: 'DX',          durability_index: 0.60 },
  { manufacturer: 'Innova', plastic_name: 'R-Pro',       durability_index: 0.65 },
  { manufacturer: 'Innova', plastic_name: 'Blizzard',    durability_index: 0.70 },
  // Discraft
  { manufacturer: 'Discraft', plastic_name: 'Z Line',    durability_index: 0.93 },
  { manufacturer: 'Discraft', plastic_name: 'Big Z',     durability_index: 0.90 },
  { manufacturer: 'Discraft', plastic_name: 'ESP',       durability_index: 0.87 },
  { manufacturer: 'Discraft', plastic_name: 'Z Lite',    durability_index: 0.84 },
  { manufacturer: 'Discraft', plastic_name: 'Titanium',  durability_index: 0.91 },
  { manufacturer: 'Discraft', plastic_name: 'Pro D',     durability_index: 0.62 },
  { manufacturer: 'Discraft', plastic_name: 'Putter Line', durability_index: 0.58 },
  // Latitude 64
  { manufacturer: 'Latitude 64', plastic_name: 'Opto',   durability_index: 0.92 },
  { manufacturer: 'Latitude 64', plastic_name: 'Gold',   durability_index: 0.85 },
  { manufacturer: 'Latitude 64', plastic_name: 'Base',   durability_index: 0.58 },
  // Dynamic Discs
  { manufacturer: 'Dynamic Discs', plastic_name: 'Lucid', durability_index: 0.91 },
  { manufacturer: 'Dynamic Discs', plastic_name: 'Fuzion', durability_index: 0.86 },
  { manufacturer: 'Dynamic Discs', plastic_name: 'Classic', durability_index: 0.61 },
  // Axiom / MVP
  { manufacturer: 'Axiom', plastic_name: 'Neutron',      durability_index: 0.94 },
  { manufacturer: 'Axiom', plastic_name: 'Plasma',       durability_index: 0.89 },
  { manufacturer: 'MVP',   plastic_name: 'Neutron',      durability_index: 0.94 },
  { manufacturer: 'MVP',   plastic_name: 'Eclipse',      durability_index: 0.91 },
]

export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  const applied = await getAppliedVersion(db)
  if (applied >= CURRENT_SCHEMA_VERSION) return

  if (applied < 1) {
    await migration1_seedPlastics(db)
    await markApplied(db, 1)
  }

  if (applied < 2) {
    await migration2_seedDefaultBag(db)
    await markApplied(db, 2)
  }
}

async function getAppliedVersion(db: SQLiteDatabase): Promise<number> {
  try {
    const row = await db.getFirstAsync<{ version: number }>(
      'SELECT MAX(version) AS version FROM schema_migrations'
    )
    return row?.version ?? 0
  } catch {
    return 0
  }
}

async function markApplied(db: SQLiteDatabase, version: number): Promise<void> {
  await db.runAsync(
    'INSERT OR IGNORE INTO schema_migrations (version) VALUES (?)',
    version
  )
}

// Migration 1: seed plastic durability table
async function migration1_seedPlastics(db: SQLiteDatabase): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (const p of PLASTIC_SEED) {
      await db.runAsync(
        `INSERT OR IGNORE INTO plastics (manufacturer, plastic_name, durability_index)
         VALUES (?, ?, ?)`,
        p.manufacturer, p.plastic_name, p.durability_index
      )
    }
  })
}

// Migration 2: seed the default 14-disc Discraft bag into user_inventory
// These mirror the Phase 1 discData.js defaults.
async function migration2_seedDefaultBag(db: SQLiteDatabase): Promise<void> {
  const defaultBag = [
    { brand: 'Discraft', model: 'Buzzz',      speed: 5,  glide: 4, turn: -1, fade: 1, stability: 'Neutral',     plastic: 'ESP',    weight: 177, color: '#f5a623', label: 'Buzzz' },
    { brand: 'Discraft', model: 'Buzzz OS',   speed: 5,  glide: 4, turn: 0,  fade: 3, stability: 'Overstable',  plastic: 'Z Line', weight: 177, color: '#4a90d9', label: 'Buzzz OS' },
    { brand: 'Discraft', model: 'Zone',        speed: 4,  glide: 3, turn: 0,  fade: 3, stability: 'Overstable',  plastic: 'Z Line', weight: 173, color: '#d0021b', label: 'Zone' },
    { brand: 'Discraft', model: 'Aviar',       speed: 2,  glide: 3, turn: 0,  fade: 1, stability: 'Neutral',     plastic: 'Pro D',  weight: 175, color: '#ffffff', label: 'Aviar' },
    { brand: 'Discraft', model: 'Surge SS',    speed: 11, glide: 5, turn: -3, fade: 2, stability: 'Understable', plastic: 'ESP',    weight: 173, color: '#7ed321', label: 'Surge SS' },
    { brand: 'Discraft', model: 'Nuke',        speed: 13, glide: 5, turn: -1, fade: 3, stability: 'Overstable',  plastic: 'ESP',    weight: 173, color: '#ff6b35', label: 'Nuke' },
    { brand: 'Discraft', model: 'Avenger SS',  speed: 10, glide: 5, turn: -3, fade: 2, stability: 'Understable', plastic: 'Z Line', weight: 175, color: '#9b59b6', label: 'Avenger SS' },
    { brand: 'Discraft', model: 'Force',       speed: 12, glide: 5, turn: 0,  fade: 3, stability: 'Overstable',  plastic: 'Z Line', weight: 174, color: '#2ecc71', label: 'Force' },
    { brand: 'Discraft', model: 'Undertaker',  speed: 9,  glide: 5, turn: -1, fade: 2, stability: 'Neutral',     plastic: 'ESP',    weight: 176, color: '#1abc9c', label: 'Undertaker' },
    { brand: 'Discraft', model: 'Predator',    speed: 9,  glide: 4, turn: 0,  fade: 3, stability: 'Overstable',  plastic: 'Z Line', weight: 173, color: '#e74c3c', label: 'Predator' },
    { brand: 'Discraft', model: 'Flick',       speed: 7,  glide: 4, turn: 0,  fade: 4, stability: 'Overstable',  plastic: 'Z Line', weight: 175, color: '#f39c12', label: 'Flick' },
    { brand: 'Discraft', model: 'Stratus',     speed: 10, glide: 6, turn: -2, fade: 2, stability: 'Understable', plastic: 'ESP',    weight: 170, color: '#3498db', label: 'Stratus' },
    { brand: 'Discraft', model: 'Comet',       speed: 4,  glide: 5, turn: -2, fade: 1, stability: 'Understable', plastic: 'Z Line', weight: 176, color: '#95a5a6', label: 'Comet' },
    { brand: 'Discraft', model: 'Banger GT',   speed: 2,  glide: 3, turn: 0,  fade: 2, stability: 'Overstable',  plastic: 'Pro D',  weight: 175, color: '#27ae60', label: 'Banger GT' },
  ]

  await db.withTransactionAsync(async () => {
    for (const disc of defaultBag) {
      // Look up plastic_id
      const plastic = await db.getFirstAsync<{ id: number }>(
        `SELECT id FROM plastics WHERE manufacturer = 'Discraft' AND plastic_name = ?`,
        disc.plastic
      )
      if (!plastic) continue

      // Upsert into discs_master
      await db.runAsync(
        `INSERT OR IGNORE INTO discs_master (brand, model, speed, glide, turn, fade, stability, plastic_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        disc.brand, disc.model, disc.speed, disc.glide, disc.turn, disc.fade, disc.stability, plastic.id
      )

      const master = await db.getFirstAsync<{ id: number }>(
        `SELECT id FROM discs_master WHERE brand = ? AND model = ? AND plastic_id = ?`,
        disc.brand, disc.model, plastic.id
      )
      if (!master) continue

      await db.runAsync(
        `INSERT OR IGNORE INTO user_inventory
           (disc_master_id, plastic_id, weight, color, custom_label, current_turn, current_fade)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        master.id, plastic.id, disc.weight, disc.color, disc.label, disc.turn, disc.fade
      )
    }
  })
}
