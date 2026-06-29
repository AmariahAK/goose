import { defineConfig } from 'vite';

// https://vitejs.dev/config
export default defineConfig({
  define: {
    'process.env.GITHUB_OWNER': JSON.stringify(process.env.GITHUB_OWNER || 'aaif-goose'),
    'process.env.GITHUB_REPO': JSON.stringify(process.env.GITHUB_REPO || 'goose'),
    'process.env.GOOSE_BUNDLE_NAME': JSON.stringify(process.env.GOOSE_BUNDLE_NAME || 'Goose'),
    'process.env.GOOSE_DESKTOP_BACKEND': JSON.stringify(
      process.env.GOOSE_DESKTOP_BACKEND || 'goosed'
    ),
  },
});
