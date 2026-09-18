export default {
  preset: 'jest-expo',
  testMatch: ['**/__tests__/**/*.test.ts'],
  // Keep Expo's native-module transforms and include Immer's React Native ESM entry.
  transformIgnorePatterns: [
    '/node_modules/(?!(.pnpm|immer|react-native|@react-native|@react-native-community|expo|@expo|@expo-google-fonts|react-navigation|@react-navigation|@sentry/react-native|native-base))',
    '/node_modules/react-native-reanimated/plugin/',
  ],
  moduleNameMapper: {
    '^@opensell/shared$': '<rootDir>/../../packages/shared/src/index.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
