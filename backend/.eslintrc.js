/**
 * ESLint Configuration for Memory Safety and Performance
 * Helps prevent common memory leaks and performance issues
 */

module.exports = {
  env: {
    node: true,
    es2021: true,
    jest: true
  },
  extends: [
    'eslint:recommended'
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  rules: {
    // Memory leak prevention
    'no-unused-vars': ['warn', { 
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_'
    }],
    'no-unreachable': 'error',
    'no-unreachable-loop': 'error',
    
    // Async/await best practices
    'require-await': 'warn',
    'no-return-await': 'error',
    'prefer-promise-reject-errors': 'error',
    
    // Resource cleanup
    'no-async-promise-executor': 'error',
    'no-promise-executor-return': 'error',
    
    // Performance
    'no-await-in-loop': 'warn',
    'no-constant-condition': 'error',
    'no-loop-func': 'error',
    
    // Code quality
    'no-console': 'off', // Allow console for server logging
    'no-debugger': 'error',
    'no-var': 'error',
    'prefer-const': 'warn',
    'prefer-arrow-callback': 'warn',
    
    // Error handling
    'no-throw-literal': 'error',
    'prefer-promise-reject-errors': 'error',
    
    // Best practices
    'eqeqeq': ['error', 'always'],
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    'no-proto': 'error',
    
    // Memory management
    'no-caller': 'error',
    'no-extend-native': 'error',
    'no-extra-bind': 'error',
    'no-iterator': 'error',
    'no-labels': 'error',
    'no-lone-blocks': 'error',
    'no-new': 'error',
    'no-new-wrappers': 'error',
    'no-useless-call': 'error',
    'no-useless-concat': 'error',
    'no-with': 'error'
  }
};
