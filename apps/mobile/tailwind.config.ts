/** @type {import('tailwindcss').Config} */
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./App.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#2563EB',
        primaryForeground: '#FFFFFF',

        background: '#F9FAFB',
        surface: '#FFFFFF',

        text: '#111827',
        textSecondary: '#6B7280',

        border: '#E5E7EB',

        success: '#16A34A',
        warning: '#D97706',
        error: '#DC2626',
      },
    },

    borderRadius: {
      card: '16px',
    },

    zIndex: {
      modal: '100',
      toast: '200',
    },
  },
  plugins: [],
};

export default config;
