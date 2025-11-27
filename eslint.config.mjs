import typescriptEslint from '@typescript-eslint/eslint-plugin';
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import reactCompiler from 'eslint-plugin-react-compiler';
import { defineConfig } from 'eslint/config';


export default defineConfig([
  {
    extends: [...nextCoreWebVitals],

    plugins: {
      '@typescript-eslint': typescriptEslint,
      'react-compiler': reactCompiler,
    },

    rules: {
      'no-console': [
        'error',
        {
          allow: ['error', 'info', 'warn'],
        },
      ],

      '@typescript-eslint/consistent-type-imports': 'error',
      'react-compiler/react-compiler': 'error',
    },
  },
]);
