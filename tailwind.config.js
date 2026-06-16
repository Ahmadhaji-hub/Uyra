/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        display: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      colors: {
        'uyra-black': '#050505',
        'uyra-white': '#f8f8f8',
        'uyra-gray': {
          100: '#e8e8e8',
          200: '#c4c4c4',
          300: '#a0a0a0',
          400: '#7a7a7a',
          500: '#555555',
          600: '#3a3a3a',
          700: '#2a2a2a',
          800: '#1a1a1a',
          900: '#0f0f0f',
        },
      },
      animation: {
        'fade-up': 'fadeUp 0.8s ease forwards',
        'fade-in': 'fadeIn 1s ease forwards',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      backgroundImage: {
        'radial-fade': 'radial-gradient(ellipse at center, rgba(255,255,255,0.03) 0%, transparent 70%)',
      },
    },
  },
  plugins: [],
}
