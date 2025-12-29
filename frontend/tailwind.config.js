/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Calming wellness color palette
        calm: {
          50: '#f0f9f4',
          100: '#d9f2e3',
          200: '#b5e3ca',
          300: '#84ceaa',
          400: '#51b485',
          500: '#2f9968',
          600: '#217a52',
          700: '#1c6144',
          800: '#1a4d38',
          900: '#16402f',
        },
        serenity: {
          50: '#f5f7fa',
          100: '#ebeef5',
          200: '#d2dae8',
          300: '#aab9d4',
          400: '#7c93bb',
          500: '#5c74a3',
          600: '#485d88',
          700: '#3b4c6f',
          800: '#34415d',
          900: '#2e394f',
        },
        warmth: {
          50: '#fdf8f3',
          100: '#faefe3',
          200: '#f4dcc5',
          300: '#ecc49e',
          400: '#e2a474',
          500: '#da8a52',
          600: '#cc7347',
          700: '#aa5c3c',
          800: '#884b36',
          900: '#6e3f2e',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'breathe': 'breathe 4s ease-in-out infinite',
      },
      keyframes: {
        breathe: {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.05)' },
        }
      }
    },
  },
  plugins: [],
}
