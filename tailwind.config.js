/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // "Concierge Engineering" tokens — deep Serena forest, brass, warm paper
        forest: { 50: '#EEF5F0', 100: '#DCEBE1', 200: '#B9D6C3', 300: '#8DB89C', 400: '#5E9874', 500: '#3B7A5A', 600: '#2A6247', 700: '#1F4D38', 800: '#173D2C', 900: '#133426', 950: '#0D231A' },
        gold: { 50: '#FBF7EE', 100: '#F5EBD3', 200: '#EBD7A9', 300: '#DDBF7F', 400: '#C9A464', 500: '#B58F4E', 600: '#A6823F', 700: '#8A6A2E', 800: '#6B4F1D', 900: '#553E18' },
        ivory: { 50: '#FBF9F4', 100: '#F4F0E6', 200: '#ECE5D4', 300: '#E4DCC8' },
        ink: { 400: '#8D8676', 500: '#7A7464', 600: '#6B6556', 700: '#3D3A31', 800: '#26241F', 900: '#15201A' },
      },
      fontFamily: {
        serif: ['"Instrument Serif"', 'Georgia', 'serif'],
        sans: ['"Geist Sans"', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['"Geist Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      borderRadius: { '2xl': '1.125rem', '3xl': '1.5rem' },
      boxShadow: {
        card: '0 1px 0 rgba(16,41,31,0.03), 0 12px 24px -18px rgba(16,41,31,0.28)',
        lift: '0 2px 4px rgba(16,41,31,0.04), 0 24px 40px -24px rgba(16,41,31,0.40)',
      },
      keyframes: {
        rise: { from: { opacity: '0', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'none' } },
        pop: { from: { opacity: '0', transform: 'scale(.97)' }, to: { opacity: '1', transform: 'none' } },
      },
      animation: { rise: 'rise .45s cubic-bezier(.2,.7,.2,1) backwards', pop: 'pop .22s cubic-bezier(.2,.7,.2,1) backwards' },
    },
  },
  plugins: [],
};
