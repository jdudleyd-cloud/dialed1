/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // existing tokens — values swapped, names preserved (no JSX changes needed)
        'broadcast-black':  '#1a1d18',
        'broadcast-yellow': '#FFD400',
        'broadcast-red':    '#c44a3a',
        'broadcast-cyan':   '#c4a890',
        // new palette tokens
        'paper':       '#f0ead8',
        'ink':         '#1a1d18',
        'signal':      '#FFD400',
        'peach-dust':  '#c4a890',
        'red-live':    '#c44a3a',
        'mono-label':  '#5a5440',
        'mute':        '#8a8472',
        'surface':     '#2a2820',
        'surface-2':   '#f7f1de',
        'sage':        '#c2d4bc',
        'blush':       '#f0b4b0',
      },
      fontFamily: {
        // saira remapped to Bricolage Grotesque — font-saira classes work unchanged
        'saira':   ['Bricolage Grotesque', 'system-ui', 'sans-serif'],
        'display': ['Bricolage Grotesque', 'system-ui', 'sans-serif'],
        'slab':    ['Roboto Slab', 'Georgia', 'serif'],
        'body':    ['Switzer', 'system-ui', 'sans-serif'],
        'mono':    ['JetBrains Mono', 'SF Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
