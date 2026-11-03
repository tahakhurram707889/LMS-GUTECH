import { defineConfig } from 'vitest/config';
import { reactResolution } from './react-resolution';
export default defineConfig({
  esbuild: { jsx: 'automatic' },
  resolve: reactResolution,
  test: {
    server: { deps: { inline: true } },
    deps: { optimizer: { web: { enabled: true, include: ['react', 'react-dom', 'react-dom/client', 'react-router-dom', '@tanstack/react-query', 'lucide-react'] } } },
    environment: 'jsdom', setupFiles: ['./tests/setup.ts'], include: ['tests/**/*.test.{ts,tsx}'],
  },
});
