import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/css-variable-graph/' : '/',
  server: {
    port: 3000,
    open: true
  },
  test: {
    environment: 'node',
    globals: true
  }
});
