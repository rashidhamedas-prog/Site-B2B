import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1B5C4A',
          light: '#2D7A5F',
          dark: '#124035',
          50: '#EEF5F2',
          100: '#D5E9E2',
          200: '#AACFC0',
          300: '#80B59E',
          400: '#559A7B',
          500: '#1B5C4A',
          600: '#164A3B',
          700: '#11392D',
          800: '#0C271E',
          900: '#061610',
        },
        secondary: {
          DEFAULT: '#C9A84C',
          light: '#E5C97C',
          dark: '#A88530',
          50: '#FBF6E9',
          100: '#F6EDD3',
          200: '#EEDBA7',
          300: '#E5C97C',
          400: '#DDB850',
          500: '#C9A84C',
          600: '#A88530',
          700: '#7E6324',
          800: '#544218',
          900: '#2A210C',
        },
        success: '#16A34A',
        warning: '#D97706',
        error: '#DC2626',
        info: '#2563EB',
      },

      fontFamily: {
        sans: ['var(--font-vazirmatn)', 'Tahoma', 'Arial', 'sans-serif'],
        mono: ['Courier New', 'monospace'],
      },

      fontSize: {
        xs: ['0.75rem', { lineHeight: '1.5' }],
        sm: ['0.875rem', { lineHeight: '1.6' }],
        base: ['1rem', { lineHeight: '1.75' }],
        lg: ['1.125rem', { lineHeight: '1.75' }],
        xl: ['1.25rem', { lineHeight: '1.6' }],
        '2xl': ['1.5rem', { lineHeight: '1.5' }],
        '3xl': ['1.875rem', { lineHeight: '1.4' }],
        '4xl': ['2.25rem', { lineHeight: '1.3' }],
        '5xl': ['3rem', { lineHeight: '1.2' }],
      },

      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      },

      borderRadius: {
        sm: '4px',
        md: '8px',
        lg: '12px',
        xl: '16px',
        '2xl': '20px',
      },

      boxShadow: {
        sm: '0 1px 2px rgba(0,0,0,0.05)',
        md: '0 4px 6px rgba(0,0,0,0.07)',
        lg: '0 10px 15px rgba(0,0,0,0.10)',
        xl: '0 20px 25px rgba(0,0,0,0.10)',
        card: '0 2px 8px rgba(27,92,74,0.08)',
        'card-hover': '0 8px 24px rgba(27,92,74,0.15)',
      },

      backgroundImage: {
        'gradient-brand': 'linear-gradient(135deg, #1B5C4A 0%, #2D7A5F 100%)',
        'gradient-gold': 'linear-gradient(135deg, #A88530 0%, #E5C97C 100%)',
        'gradient-hero': 'linear-gradient(180deg, rgba(27,92,74,0.9) 0%, rgba(18,64,53,0.95) 100%)',
      },

      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.2s ease-in',
        'spin-slow': 'spin 3s linear infinite',
      },

      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
