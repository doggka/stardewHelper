// Сборка процессов Electron (main + preload) через esbuild.
// Вынесено отдельно, потому что их собирает не Vite: они исполняются в Node,
// а не в окне браузера.
import { build } from 'esbuild';

export async function buildElectron({ watch = false } = {}) {
  const common = {
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'cjs',
    outdir: 'dist-electron',
    outExtension: { '.js': '.cjs' },
    external: ['electron'],
    sourcemap: watch,
    logLevel: 'info',
  };

  await build({ ...common, entryPoints: { main: 'electron/main.ts' } });
  await build({ ...common, entryPoints: { preload: 'electron/preload.ts' } });
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}`) {
  await buildElectron();
}
