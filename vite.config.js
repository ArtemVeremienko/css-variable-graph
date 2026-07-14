import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.GITHUB_REPOSITORY ? `/${process.env.GITHUB_REPOSITORY.split('/')[1]}/` : '/',
  server: {
    port: 3000,
    open: true
  },
  test: {
    environment: 'node',
    globals: true
  }
});
