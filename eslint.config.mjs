import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactPlugin from 'eslint-plugin-react';
import reactNativePlugin from 'eslint-plugin-react-native';
import globals from 'globals';

export default tseslint.config(
  // 1. Global Ignores
  // Put this first. It replaces the old .eslintignore file.
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      'apps/mobile/.expo/**',
      'apps/mobile/android/**',
      'apps/mobile/ios/**',
    ],
  },

  // 2. Base Configuration (applies to all files)
  eslint.configs.recommended,
  ...tseslint.configs.recommended,

  // 3. Backend Configuration (Node.js & Express)
  {
    files: ['apps/backend/**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.node, // Gives you access to process, __dirname, etc.
      },
    },
    rules: {
      // Add or override specific backend rules here
      'no-console': 'off', // Usually fine to keep console logs in a Node backend
    },
  },

  // 4. Mobile Configuration (React Native)
  {
    files: ['apps/mobile/**/*.{ts,tsx}'],
    plugins: {
      react: reactPlugin,
      'react-native': reactNativePlugin,
    },
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals['react-native'], // Gives you access to React Native specific globals
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    settings: {
      react: {
        version: 'detect', // Automatically detects your React version
      },
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off', // Not needed for React 17+ / React Native
      'react-native/no-unused-styles': 'warn',
      'react-native/split-platform-components': 'off',
      'react-native/no-inline-styles': 'warn',
      'react-native/no-color-literals': 'warn',
    },
  },
);
