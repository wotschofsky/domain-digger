import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import reactCompiler from 'eslint-plugin-react-compiler';

export default [
  ...nextVitals,
  ...nextTs,
  {
    plugins: {
      'react-compiler': reactCompiler,
    },
    rules: {
      'no-console': ['error', { allow: ['error', 'info', 'warn'] }],
      '@typescript-eslint/consistent-type-imports': 'error',
      'react-compiler/react-compiler': 'error',

      // TODO: Temporary - convert these back to errors once fixed
      // These rules are set to warn temporarily and should be removed soon
      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/consistent-type-imports': 'warn',
      '@typescript-eslint/no-empty-object-type': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unsafe-function-type': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
];
