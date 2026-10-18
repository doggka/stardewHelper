// Полная сборка: окно (Vite) + процессы Electron (esbuild).
import { build as viteBuild } from 'vite';
import { buildElectron } from './build-electron.mjs';

await viteBuild({ configFile: 'vite.config.ts' });
await buildElectron();
console.log('готово: dist/ и dist-electron/');
