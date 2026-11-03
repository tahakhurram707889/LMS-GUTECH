import { createRequire } from 'node:module';
import { dirname } from 'node:path';

// Resolve from the workspace root so hoisted libraries and the SPA share React.
// An older frontend/node_modules must not introduce a second hook dispatcher.
const workspaceRequire = createRequire(new URL('../package.json', import.meta.url));
export const reactResolution = {
  dedupe: ['react', 'react-dom'],
  alias: {
    react: dirname(workspaceRequire.resolve('react/package.json')),
    'react-dom': dirname(workspaceRequire.resolve('react-dom/package.json')),
  },
};
