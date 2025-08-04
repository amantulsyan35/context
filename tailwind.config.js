/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        inter: ['Inter', 'sans-serif'],
        book: ['Book', 'serif'],
        sans: ['Inter', ...defaultTheme.fontFamily.sans],
      },
      animation: {
        'fade-up': 'fadeUp 0.8s ease-out forwards',
      },
      keyframes: {
        fadeUp: {
          from: {
            opacity: '0',
            transform: 'translateY(20px)',
            filter: 'blur(10px)',
          },
          to: {
            opacity: '1',
            transform: 'translateY(0)',
            filter: 'blur(0)',
          },
        },
      },
    },
    
  },

  plugins: [require('tailwindcss-animate'), require('@tailwindcss/forms'),
  function({ addUtilities }) {
      const newUtilities = {
        '.animate-delay-200': {
          'animation-delay': '200ms',
        },
        '.animate-delay-400': {
          'animation-delay': '400ms',
        },
        '.animate-delay-600': {
          'animation-delay': '600ms',
        },
      }
      addUtilities(newUtilities)
    }

  ],
};
