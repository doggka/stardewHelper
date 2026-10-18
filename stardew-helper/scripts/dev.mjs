// Режим разработки: поднимаем Vite, собираем процессы Electron, запускаем окно.
// Без concurrently и прочих зависимостей — всё в одном месте и видно, что происходит.
import { createServer } from 'vite';
import { spawn } from 'node:child_process';
import electronPath from 'electron';
import { buildElectron } from './build-electron.mjs';

const server = await createServer({ configFile: 'vite.config.ts' });
await server.listen();
const info = server.config.server;
const url = `http://localhost:${info.port}`;
console.log(`vite: ${url}`);

await buildElectron({ watch: true });

const child = spawn(electronPath, ['.'], {
  stdio: 'inherit',
  env: { ...process.env, VITE_DEV_SERVER_URL: url },
});

child.on('close', async () => {
  await server.close();
  process.exit(0);
});
