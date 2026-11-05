module.exports = {
  preset: '@react-native/jest-preset',
  // 웹과 같이 쓰는 데이터 코드 — metro.config.js·tsconfig.json과 같은 별칭
  moduleNameMapper: {
    '^@xtool-core/(.*)$': '<rootDir>/../../packages/xtool-core/src/$1',
  },
};
