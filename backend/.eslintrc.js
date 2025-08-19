module.exports = {
  root: true,
  env: {
    node: true,
    jest: true,
    es2022: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    sourceType: 'module',
    ecmaVersion: 2022,
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  ignorePatterns: [
    '.eslintrc.js', 
    'dist/', 
    'node_modules/', 
    '*.config.js',
    'migrations/',
    'seeds/',
  ],
  rules: {
    // TypeScript specific rules
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': ['error', { 
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
    }],
    '@typescript-eslint/no-var-requires': 'error',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    
    // General rules
    'no-console': 'warn',
    'prefer-const': 'error',
    'no-unused-vars': 'off', // Use TypeScript version instead
  },
};