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
    },
  },
];
