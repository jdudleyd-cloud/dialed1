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
        'broadcast-black': '#0a0a0a',
        'broadcast-yellow': '#ffeb3b',
        'broadcast-red': '#ff4444',
        'broadcast-cyan': '#00d4ff',
      },
      fontFamily: {
        'saira': ['Saira Condensed', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
