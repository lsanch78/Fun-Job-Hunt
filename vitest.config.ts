import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@effjobhunt/shared/search_profile': path.resolve(
        __dirname,
        'packages/shared/src/search_profile.ts'
      ),
      '@effjobhunt/shared': path.resolve(__dirname, 'packages/shared/src/resume.ts'),
    },
  },
  test: {
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    environment: 'node',
    passWithNoTests: true,
  },
});
