// Disc database — brand → type → disc[] with verified flight numbers
// Used to auto-populate the Add Disc form in BagTab

export const DISC_BRANDS = [
  'Discraft', 'Innova', 'Latitude 64', 'Dynamic Discs', 'Kastaplast',
  'MVP Disc Sports', 'Axiom Discs', 'Discmania', 'Gateway', 'Prodigy',
  'Westside Discs', 'Infinite Discs', 'Vibram', 'Lightning', 'Other',
]

export const BRAND_PLASTICS = {
  'Discraft':        ['Z', 'ESP', 'Big Z', 'Jawbreaker', 'Cryztal', 'SuperColor', 'Titanium', 'Rubber'],
  'Innova':          ['Champion', 'Star', 'Pro', 'GStar', 'DX', 'Blizzard', 'R-Pro', 'XT', 'Color Glow'],
  'Latitude 64':     ['Opto', 'Retool', 'Lucid', 'Moonshine', 'Gold', 'Zero'],
  'Dynamic Discs':   ['Lucid', 'Lucid Air', 'Classic', 'Classic Soft', 'Fuzion', 'Fuzion Orbit'],
  'Kastaplast':      ['K1', 'K1 Soft', 'K3', 'K3 Glow'],
  'MVP Disc Sports': ['Neutron', 'Proton', 'Cosmic Neutron', 'Total Atomic'],
  'Axiom Discs':     ['Neutron', 'Proton', 'Fission', 'Plasma'],
  'Discmania':       ['C-Line', 'P-Line', 'S-Line', 'Swirly S-Line', 'Active'],
  'Gateway':         ['Firm', 'Sure-Grip', 'Wizard', 'SS', 'Diamond', 'Platinum'],
  'Prodigy':         ['400', '400G', '300', '300 Soft', 'F-Model', 'D-Model'],
  'Westside Discs':  ['BT', 'VIP', 'Tournament', 'Origio'],
}

// disc: { name, speed, glide, turn, fade }
export const DISC_DATABASE = {
  'Discraft': {
    'Distance Driver': [
      { name: 'Nuke',        speed: 13, glide: 5, turn: -1, fade: 3 },
      { name: 'Nuke OS',     speed: 13, glide: 5, turn:  0, fade: 4 },
      { name: 'Nuke SS',     speed: 13, glide: 5, turn: -3, fade: 3 },
      { name: 'Crank',       speed: 13, glide: 5, turn: -2, fade: 2 },
      { name: 'Crank SS',    speed: 13, glide: 5, turn: -3, fade: 2 },
      { name: 'Zeus',        speed: 12, glide: 5, turn: -1, fade: 3 },
      { name: 'Anax',        speed: 12, glide: 5, turn: -1, fade: 2 },
      { name: 'Force',       speed: 12, glide: 5, turn:  0, fade: 3 },
      { name: 'Avenger SS',  speed: 10, glide: 5, turn: -3, fade: 1 },
      { name: 'Surge SS',    speed: 10, glide: 5, turn: -3, fade: 2 },
      { name: 'Undertaker',  speed: 10, glide: 5, turn: -2, fade: 2 },
      { name: 'Thrasher',    speed: 12, glide: 5, turn: -2, fade: 3 },
      { name: 'Heat',        speed: 9,  glide: 6, turn: -3, fade: 1 },
    ],
    'Fairway Driver': [
      { name: 'Vulture',  speed: 10, glide: 5, turn: -2, fade: 2 },
      { name: 'Hades',    speed:  9, glide: 6, turn: -3, fade: 1 },
      { name: 'Tern',     speed:  9, glide: 6, turn: -3, fade: 2 },
      { name: 'Sol',      speed:  8, glide: 6, turn: -3, fade: 2 },
      { name: 'Passion',  speed:  9, glide: 5, turn: -2, fade: 2 },
      { name: 'Flick',    speed:  9, glide: 4, turn:  1, fade: 4 },
      { name: 'Drone',    speed:  8, glide: 3, turn: -1, fade: 4 },
    ],
    'Midrange': [
      { name: 'Buzzz',     speed: 5, glide: 4, turn: -1, fade: 1 },
      { name: 'Buzzz OS',  speed: 5, glide: 4, turn:  0, fade: 3 },
      { name: 'Buzzz SS',  speed: 5, glide: 5, turn: -2, fade: 1 },
      { name: 'Zone',      speed: 4, glide: 3, turn:  0, fade: 3 },
      { name: 'Meteor',    speed: 5, glide: 5, turn: -3, fade: 0 },
      { name: 'Malta',     speed: 5, glide: 5, turn:  0, fade: 3 },
      { name: 'Wasp',      speed: 5, glide: 3, turn:  0, fade: 3 },
      { name: 'Stalker',   speed: 7, glide: 5, turn: -1, fade: 2 },
      { name: 'Comet',     speed: 4, glide: 5, turn: -2, fade: 1 },
    ],
    'Putter': [
      { name: 'Banger GT',   speed: 2, glide: 3, turn:  0, fade: 1 },
      { name: 'Challenger',  speed: 2, glide: 3, turn:  0, fade: 1 },
      { name: 'Luna',        speed: 3, glide: 3, turn:  0, fade: 2 },
      { name: 'Roach',       speed: 2, glide: 4, turn:  0, fade: 0 },
      { name: 'Fierce',      speed: 3, glide: 3, turn: -1, fade: 1 },
      { name: 'Magnet',      speed: 2, glide: 4, turn: -2, fade: 0 },
    ],
  },

  'Innova': {
    'Distance Driver': [
      { name: 'Boss',        speed: 13, glide: 5, turn: -1, fade: 3 },
      { name: 'Destroyer',   speed: 12, glide: 5, turn: -1, fade: 3 },
      { name: 'Wraith',      speed: 11, glide: 5, turn: -1, fade: 3 },
      { name: 'Shryke',      speed: 13, glide: 6, turn: -2, fade: 2 },
      { name: 'Corvette',    speed: 14, glide: 6, turn: -1, fade: 2 },
      { name: 'Tern',        speed: 12, glide: 6, turn: -3, fade: 2 },
      { name: 'Thunderbird', speed: 11, glide: 5, turn:  0, fade: 3 },
      { name: 'Teebird3',    speed: 11, glide: 5, turn: -1, fade: 3 },
      { name: 'Sidewinder',  speed:  9, glide: 5, turn: -3, fade: 1 },
      { name: 'Valkyrie',    speed:  9, glide: 4, turn: -3, fade: 2 },
      { name: 'Katana',      speed: 13, glide: 5, turn: -4, fade: 3 },
      { name: 'Blizzard Boss', speed: 14, glide: 5, turn: -2, fade: 3 },
      { name: 'Groove',      speed: 8,  glide: 6, turn: -4, fade: 0 },
    ],
    'Fairway Driver': [
      { name: 'Teebird',     speed: 7, glide: 5, turn:  0, fade: 2 },
      { name: 'Leopard',     speed: 7, glide: 5, turn: -2, fade: 1 },
      { name: 'Leopard3',    speed: 7, glide: 5, turn: -2, fade: 1 },
      { name: 'Tee Devil',   speed: 12, glide: 5, turn: -1, fade: 2 },
      { name: 'Firebird',    speed: 9, glide: 3, turn:  0, fade: 4 },
      { name: 'Phantom',     speed: 9, glide: 5, turn: -1, fade: 2 },
      { name: 'Banshee',     speed: 9, glide: 5, turn: -2, fade: 2 },
      { name: 'Mamba',       speed: 11, glide: 6, turn: -5, fade: 1 },
    ],
    'Midrange': [
      { name: 'Roc3',    speed: 5, glide: 4, turn:  0, fade: 3 },
      { name: 'Mako3',   speed: 5, glide: 5, turn:  0, fade: 0 },
      { name: 'Avitar',  speed: 5, glide: 4, turn:  0, fade: 2 },
      { name: 'Rhyno',   speed: 4, glide: 3, turn:  0, fade: 4 },
      { name: 'Atlas',   speed: 5, glide: 5, turn:  0, fade: 1 },
      { name: 'Gator',   speed: 5, glide: 4, turn:  0, fade: 4 },
      { name: 'Ogre',    speed: 5, glide: 4, turn: -2, fade: 2 },
      { name: 'Shark',   speed: 4, glide: 4, turn: -1, fade: 2 },
      { name: 'Stingray', speed: 4, glide: 5, turn: -2, fade: 1 },
    ],
    'Putter': [
      { name: 'Aviar',       speed: 2, glide: 3, turn:  0, fade: 1 },
      { name: 'Aviar P&A',   speed: 2, glide: 3, turn:  0, fade: 1 },
      { name: 'Aviar3',      speed: 3, glide: 3, turn:  0, fade: 2 },
      { name: 'KC Pro Aviar', speed: 2, glide: 3, turn:  0, fade: 1 },
      { name: 'Birdie',      speed: 2, glide: 4, turn:  0, fade: 1 },
      { name: 'Colt',        speed: 3, glide: 3, turn: -1, fade: 1 },
    ],
  },

  'Latitude 64': {
    'Distance Driver': [
      { name: 'Missilen',    speed: 14, glide: 5, turn: -1, fade: 3 },
      { name: 'Ballista Pro', speed: 14, glide: 5, turn: -1, fade: 3 },
      { name: 'River',       speed: 9,  glide: 7, turn: -1, fade: 0 },
      { name: 'Exodus',      speed: 11, glide: 5, turn: -2, fade: 3 },
      { name: 'Rive',        speed: 12, glide: 6, turn: -1, fade: 2 },
      { name: 'Saint Pro',   speed: 11, glide: 6, turn: -1, fade: 2 },
    ],
    'Fairway Driver': [
      { name: 'Saint',       speed: 8,  glide: 6, turn: -1, fade: 2 },
      { name: 'Officer',     speed: 7,  glide: 5, turn:  0, fade: 2 },
      { name: 'Compass',     speed: 7,  glide: 5, turn:  0, fade: 1 },
      { name: 'Explorer',    speed: 9,  glide: 5, turn: -1, fade: 2 },
    ],
    'Midrange': [
      { name: 'Claymore',    speed: 7,  glide: 5, turn:  0, fade: 2 },
      { name: 'Jade',        speed: 5,  glide: 5, turn: -2, fade: 1 },
      { name: 'Fuse',        speed: 5,  glide: 6, turn: -1, fade: 0 },
    ],
    'Putter': [
      { name: 'Pure',        speed: 2,  glide: 3, turn:  0, fade: 0 },
      { name: 'Keystone',    speed: 3,  glide: 3, turn: -1, fade: 1 },
      { name: 'Mercy',       speed: 2,  glide: 3, turn:  0, fade: 1 },
    ],
  },

  'Dynamic Discs': {
    'Distance Driver': [
      { name: 'Trespass',    speed: 12, glide: 5, turn: -1, fade: 3 },
      { name: 'Felon',       speed: 11, glide: 5, turn: -2, fade: 3 },
      { name: 'Freedom',     speed: 11, glide: 5, turn: -3, fade: 2 },
      { name: 'Escape',      speed: 9,  glide: 5, turn: -2, fade: 2 },
    ],
    'Fairway Driver': [
      { name: 'Sheriff',     speed: 9,  glide: 5, turn:  0, fade: 3 },
      { name: 'Sergeant',    speed: 7,  glide: 4, turn:  0, fade: 3 },
      { name: 'EMAC Truth',  speed: 7,  glide: 4, turn:  0, fade: 2 },
    ],
    'Midrange': [
      { name: 'Verdict',     speed: 5,  glide: 4, turn:  0, fade: 3 },
      { name: 'Truth',       speed: 5,  glide: 5, turn: -1, fade: 1 },
      { name: 'Witness',     speed: 5,  glide: 5, turn: -1, fade: 2 },
    ],
    'Putter': [
      { name: 'Warden',      speed: 2,  glide: 4, turn:  0, fade: 1 },
      { name: 'Deputy',      speed: 2,  glide: 4, turn: -1, fade: 1 },
      { name: 'Judge',       speed: 2,  glide: 4, turn:  0, fade: 1 },
    ],
  },

  'Kastaplast': {
    'Distance Driver': [
      { name: 'Rask',        speed: 14, glide: 5, turn: -2, fade: 3 },
      { name: 'Falk',        speed: 10, glide: 5, turn: -2, fade: 2 },
      { name: 'Lots',        speed: 13, glide: 6, turn: -1, fade: 2 },
    ],
    'Fairway Driver': [
      { name: 'Gote',        speed: 9,  glide: 5, turn:  0, fade: 2 },
      { name: 'Vass',        speed: 8,  glide: 6, turn: -1, fade: 1 },
    ],
    'Midrange': [
      { name: 'Kaxe',        speed: 6,  glide: 4, turn:  0, fade: 2 },
      { name: 'Kaxe Z',      speed: 6,  glide: 4, turn:  0, fade: 3 },
    ],
    'Putter': [
      { name: 'Berg',        speed: 1,  glide: 1, turn:  0, fade: 2 },
      { name: 'Grym',        speed: 3,  glide: 4, turn:  0, fade: 1 },
    ],
  },

  'MVP Disc Sports': {
    'Distance Driver': [
      { name: 'Octane',      speed: 13, glide: 5, turn: -1, fade: 3 },
      { name: 'Photon',      speed: 12, glide: 5, turn: -0.5, fade: 2.5 },
      { name: 'Catalyst',    speed: 12, glide: 5, turn: -1, fade: 2 },
    ],
    'Fairway Driver': [
      { name: 'Signal',      speed: 9,  glide: 5, turn: -1, fade: 2 },
      { name: 'Servo',       speed: 8,  glide: 5, turn: -2, fade: 2 },
    ],
    'Midrange': [
      { name: 'Relay',       speed: 6,  glide: 5, turn: -1, fade: 1 },
      { name: 'Matrix',      speed: 5,  glide: 5, turn: -1, fade: 2 },
    ],
    'Putter': [
      { name: 'Atom',        speed: 2,  glide: 3, turn:  0, fade: 1 },
      { name: 'Anode',       speed: 2,  glide: 4, turn:  0, fade: 0 },
    ],
  },

  'Discmania': {
    'Distance Driver': [
      { name: 'PD2',         speed: 13, glide: 5, turn:  0, fade: 4 },
      { name: 'PD',          speed: 10, glide: 4, turn:  0, fade: 3 },
      { name: 'FD3',         speed: 12, glide: 5, turn: -1, fade: 3 },
      { name: 'DD3',         speed: 12, glide: 5, turn: -0.5, fade: 3 },
    ],
    'Fairway Driver': [
      { name: 'FD',          speed: 7,  glide: 6, turn: -1, fade: 1 },
      { name: 'FD2',         speed: 9,  glide: 5, turn: -1, fade: 2 },
      { name: 'CD',          speed: 9,  glide: 5, turn: -1, fade: 2 },
    ],
    'Midrange': [
      { name: 'MD3',         speed: 5,  glide: 4, turn:  0, fade: 2 },
      { name: 'MD5',         speed: 5,  glide: 6, turn: -1, fade: 1 },
      { name: 'TD',          speed: 9,  glide: 5, turn: -2, fade: 2 },
    ],
    'Putter': [
      { name: 'P2',          speed: 2,  glide: 3, turn:  0, fade: 1 },
      { name: 'P1x',         speed: 2,  glide: 3, turn:  0, fade: 1 },
    ],
  },

  'Gateway': {
    'Midrange': [
      { name: 'Wizard',      speed: 2,  glide: 3, turn:  0, fade: 2 },
      { name: 'Diamond',     speed: 4,  glide: 5, turn: -2, fade: 1 },
    ],
    'Putter': [
      { name: 'Wizard',      speed: 2,  glide: 3, turn:  0, fade: 2 },
      { name: 'Illusion',    speed: 2,  glide: 4, turn: -1, fade: 1 },
      { name: 'Deuce',       speed: 2,  glide: 3, turn:  0, fade: 1 },
    ],
  },

  'Prodigy': {
    'Distance Driver': [
      { name: 'D1',          speed: 12, glide: 5, turn:  0, fade: 3 },
      { name: 'D2',          speed: 12, glide: 5, turn: -1, fade: 3 },
      { name: 'D3',          speed: 12, glide: 5, turn: -2, fade: 2 },
      { name: 'D5',          speed: 11, glide: 5, turn: -3, fade: 2 },
    ],
    'Fairway Driver': [
      { name: 'F5',          speed: 7,  glide: 5, turn:  0, fade: 2 },
      { name: 'F3',          speed: 10, glide: 5, turn: -1, fade: 3 },
    ],
    'Midrange': [
      { name: 'M4',          speed: 5,  glide: 5, turn: -1, fade: 2 },
      { name: 'M3',          speed: 5,  glide: 5, turn:  0, fade: 3 },
    ],
    'Putter': [
      { name: 'PA-3',        speed: 3,  glide: 3, turn:  0, fade: 1 },
      { name: 'PA-5',        speed: 2,  glide: 4, turn: -1, fade: 0 },
    ],
  },
}

// Returns all discs for a given brand + type combo, sorted by name
export function getDiscsForBrandType(brand, type) {
  return (DISC_DATABASE[brand]?.[type] || []).sort((a, b) => a.name.localeCompare(b.name))
}

// Returns all types that have discs for a given brand
export function getTypesForBrand(brand) {
  const db = DISC_DATABASE[brand]
  if (!db) return []
  return Object.keys(db).filter(t => db[t]?.length > 0)
}

// Returns disc data by brand + name (for auto-fill)
export function findDisc(brand, name) {
  const db = DISC_DATABASE[brand]
  if (!db) return null
  for (const type of Object.keys(db)) {
    const found = db[type].find(d => d.name === name)
    if (found) return { ...found, type }
  }
  return null
}
