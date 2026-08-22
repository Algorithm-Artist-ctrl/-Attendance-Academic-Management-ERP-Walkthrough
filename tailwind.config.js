/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        vctm: {
          navy: {
            50: '#f0f4f8',
            100: '#d9e2ec',
            200: '#bcccdc',
            300: '#9fb3c8',
            400: '#829ab1',
            500: '#627d98',
            600: '#486581',
            700: '#334e68',
            800: '#1e3a5f', // primary brand navy
            900: '#0f2744',
            950: '#081729',
          },
          maroon: {
            50: '#fbf2f2',
            100: '#f7dfdf',
            500: '#b83232',
            600: '#9b2626',
            700: '#801f1f',
            800: '#6b1414',
            900: '#4a0b0b',
          },
          gold: {
            50: '#fefdf0',
            100: '#fdf9c8',
            400: '#f5c518',
            500: '#e5a50a',
            600: '#c68406',
          }
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
