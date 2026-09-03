module.exports = {
  root: true,
  env: {
    es6: true,
    node: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: ['tsconfig.json', 'tsconfig.dev.json'],
    sourceType: 'module',
  },
  ignorePatterns: [
    '/lib/**/*',
    '/generated/**/*',
  ],
  plugins: ['@typescript-eslint', 'import'],
  rules: {
    'no-control-regex': 'off',
    'quotes': 'off',
    'semi': 'off',
    'object-curly-spacing': 'off',
    'import/no-unresolved': 0,
    'indent': 'off',
    'operator-linebreak': 'off',
    'require-jsdoc': 'off',
    'valid-jsdoc': 'off',
    '@typescript-eslint/no-unused-expressions': 'off',
  },
};