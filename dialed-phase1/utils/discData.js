// Default bag — user's actual discs with verified flight numbers
// All fields are editable by the user in BagTab
export const DISC_DATA = [
  {
    id: 1,
    name: 'Avenger SS',
    customLabel: '',
    manufacturer: 'Discraft',
    type: 'Distance Driver',
    plastic: 'Z',
    speed: 10, glide: 5, turn: -3, fade: 1,
    stability: 'Understable',
    weight: 171,
    color: '#ff6b35',
    purchaseDate: '',
    photos: [],
  },
  {
    id: 2,
    name: 'Nuke',
    customLabel: '',
    manufacturer: 'Discraft',
    type: 'Distance Driver',
    plastic: 'ESP',
    speed: 13, glide: 5, turn: -1, fade: 3,
    stability: 'Overstable',
    weight: 173,
    color: '#ff4444',
    purchaseDate: '',
    photos: [],
  },
  {
    id: 3,
    name: 'Nuke SS',
    customLabel: '',
    manufacturer: 'Discraft',
    type: 'Distance Driver',
    plastic: 'Z',
    speed: 13, glide: 5, turn: -3, fade: 3,
    stability: 'Understable',
    weight: 173,
    color: '#ff8800',
    purchaseDate: '',
    photos: [],
  },
  {
    id: 4,
    name: 'Crank SS',
    customLabel: '',
    manufacturer: 'Discraft',
    type: 'Distance Driver',
    plastic: 'Z',
    speed: 13, glide: 5, turn: -3, fade: 2,
    stability: 'Understable',
    weight: 173,
    color: '#ffcc00',
    purchaseDate: '',
    photos: [],
  },
  {
    id: 5,
    name: 'Corvette',
    customLabel: '',
    manufacturer: 'Innova',
    type: 'Distance Driver',
    plastic: 'Champion',
    speed: 14, glide: 6, turn: -1, fade: 2,
    stability: 'Stable',
    weight: 172,
    color: '#cc0000',
    purchaseDate: '',
    photos: [],
  },
  {
    id: 6,
    name: 'Shryke',
    customLabel: '',
    manufacturer: 'Innova',
    type: 'Distance Driver',
    plastic: 'Champion',
    speed: 13, glide: 6, turn: -2, fade: 2,
    stability: 'Stable',
    weight: 173,
    color: '#9933ff',
    purchaseDate: '',
    photos: [],
  },
  {
    id: 7,
    name: 'Tee Devil',
    customLabel: '',
    manufacturer: 'Innova',
    type: 'Distance Driver',
    plastic: 'Champion',
    speed: 12, glide: 5, turn: -1, fade: 2,
    stability: 'Stable',
    weight: 173,
    color: '#cc3300',
    purchaseDate: '',
    photos: [],
  },
  {
    id: 8,
    name: 'Buzzz',
    customLabel: '',
    manufacturer: 'Discraft',
    type: 'Midrange',
    plastic: 'ESP',
    speed: 5, glide: 4, turn: -1, fade: 1,
    stability: 'Stable',
    weight: 177,
    color: '#00cc44',
    purchaseDate: '',
    photos: [],
  },
  {
    id: 9,
    name: 'Roc3',
    customLabel: '',
    manufacturer: 'Innova',
    type: 'Midrange',
    plastic: 'Champion',
    speed: 5, glide: 4, turn: 0, fade: 3,
    stability: 'Overstable',
    weight: 180,
    color: '#0066ff',
    purchaseDate: '',
    photos: [],
  },
  {
    id: 10,
    name: 'Avitar',
    customLabel: '',
    manufacturer: 'Innova',
    type: 'Midrange',
    plastic: 'Champion',
    speed: 5, glide: 4, turn: 0, fade: 2,
    stability: 'Stable',
    weight: 175,
    color: '#00aaff',
    purchaseDate: '',
    photos: [],
  },
  {
    id: 11,
    name: 'Wizard',
    customLabel: '',
    manufacturer: 'Gateway',
    type: 'Putter',
    plastic: 'Firm',
    speed: 2, glide: 3, turn: 0, fade: 2,
    stability: 'Stable',
    weight: 174,
    color: '#ffffff',
    purchaseDate: '',
    photos: [],
  },
  {
    id: 12,
    name: 'Banger GT',
    customLabel: '',
    manufacturer: 'Discraft',
    type: 'Putter',
    plastic: 'Jawbreaker',
    speed: 2, glide: 3, turn: 0, fade: 1,
    stability: 'Stable',
    weight: 173,
    color: '#ffeb3b',
    purchaseDate: '',
    photos: [],
  },
]

export function loadBag() {
  if (typeof window === 'undefined') return DISC_DATA
  try {
    const saved = localStorage.getItem('dialed_bag')
    if (saved) return JSON.parse(saved)
  } catch {}
  // First load — seed with defaults
  saveBag(DISC_DATA)
  return DISC_DATA
}

export function saveBag(bag) {
  if (typeof window === 'undefined') return
  localStorage.setItem('dialed_bag', JSON.stringify(bag))
}

export function nextDiscId(bag) {
  return bag.length > 0 ? Math.max(...bag.map(d => d.id)) + 1 : 1
}

export function deriveStability(turn, fade) {
  const net = (fade || 0) + (turn || 0)
  if (net >= 2) return 'Overstable'
  if (net <= -1) return 'Understable'
  return 'Stable'
}

export const EMPTY_DISC = {
  name: '',
  customLabel: '',
  manufacturer: '',
  type: 'Distance Driver',
  plastic: '',
  speed: 7, glide: 5, turn: -1, fade: 2,
  stability: 'Stable',
  weight: 175,
  color: '#ffeb3b',
  purchaseDate: '',
  photos: [],
}

export const DISC_TYPES = ['Distance Driver', 'Fairway Driver', 'Midrange', 'Putter']
