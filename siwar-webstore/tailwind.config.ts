import type { Config } from 'tailwindcss'

export default {
  content: [
    './components/**/*.{vue,js,ts}',
    './layouts/**/*.vue',
    './pages/**/*.vue',
    './app.vue',
    './app/**/*.vue',
    './plugins/**/*.{js,ts}',
    './nuxt.config.{js,ts}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#F5F9EC',
          100: '#E8F3D4',
          200: '#D2E8AC',
          300: '#B8DC7E',
          400: '#A0D153',
          500: '#8DC63F', // Brand Primary Green
          600: '#6A9A28', // Primary Hover
          700: '#4E731B',
          800: '#344F12',
          900: '#19240E', // Brand Deep Olive
        },
        gold: {
          50: '#FAF6ED',
          100: '#F3E3B6', // Pale Shimmer Accent
          200: '#E7CC87',
          300: '#DBB76A',
          400: '#CBA158', // Primary Gold Metallic
          500: '#B0883D',
          600: '#8C6527', // Bronze Text / Dark Accent
          700: '#68481A',
        },
        surface: {
          canvas: '#FAFAF7',
          card: '#FFFFFF',
          border: '#E6E5DC',
        },
      }
    },
  },
  plugins: [
    require('daisyui'),
  ],
  daisyui: {
    themes: [
      {
        light: {
          "primary": "#8DC63F",
          "primary-content": "#ffffff",
          "secondary": "#CBA158",
          "secondary-content": "#ffffff",
          "accent": "#6A9A28",
          "base-100": "#FAFAF7",
          "base-200": "#FFFFFF",
          "base-300": "#E6E5DC",
          "neutral": "#19240E",
          "neutral-content": "#ffffff",
        },
        dark: {
          "primary": "#8DC63F",
          "primary-content": "#19240E",
          "secondary": "#DBB76A",
          "secondary-content": "#19240E",
          "accent": "#A0D153",
          "base-100": "#19240E",
          "base-200": "#344F12",
          "base-300": "#4E731B",
          "neutral": "#FAFAF7",
          "neutral-content": "#19240E",
        }
      }
    ],
  },
} satisfies Config
