module.exports = {
  preset: '@react-native/jest-preset',
  transform: {
    '^.+\\.(js|mjs|ts|tsx)$': 'babel-jest',
  },
  transformIgnorePatterns: [
    'node_modules/.pnpm/(?!(?:@react-native\\+[^@]+|@react-navigation\\+[^@]+|@tanstack\\+react-query|react-native[^@]*)@)',
    'node_modules/(?!\\.pnpm|((jest-)?react-native[^/]*|@react-native(-community)?|@react-navigation|@tanstack)/)',
  ],
};
