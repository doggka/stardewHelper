// Собирает check-saves-entry.ts и запускает его.
// Нужен, чтобы проверять разбор сохранений без запуска всего приложения.
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

const out = path.join(os.tmpdir(), 'sdv-check-saves.cjs');
await build({
  entryPoints: ['scripts/check-saves-entry.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  outfile: out,
  logLevel: 'warning',
});

const { createRequire } = await import('node:module');
const require = createRequire(pathToFileURL(out));
require(out);
fs.rmSync(out, { force: true });
