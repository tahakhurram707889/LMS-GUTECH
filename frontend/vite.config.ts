import { defineConfig,loadEnv } from 'vite';
import { fileURLToPath } from 'node:url';
import { reactResolution } from './react-resolution';
export default defineConfig(({mode})=>{
  const port=Number(loadEnv(mode,process.cwd(),'VITE_').VITE_PORT??5173);
  if(!Number.isInteger(port)||port<1||port>65535)throw new Error('VITE_PORT must be a valid port number');
  return {
  esbuild: { jsx: 'automatic' },
  resolve: { ...reactResolution, alias: { ...reactResolution.alias, '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: { host: '127.0.0.1', port, strictPort: true },
  build: {
    rollupOptions: { output: { manualChunks: {
      react: ['react', 'react-dom', 'react-router-dom'],
      query: ['@tanstack/react-query'],
      realtime: ['@supabase/supabase-js'],
    } } },
  },
};});
