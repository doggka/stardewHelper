// Полная сборка: окно (Vite) + процессы Electron (esbuild).
import fs from 'node:fs';
import path from 'node:path';
import { build as viteBuild } from 'vite';
import { buildElectron } from './build-electron.mjs';

/**
 * Запущенная portable-копия держит release/Stardew Helper.exe открытым.
 * electron-builder в этом случае не падает, а печатает «output file is
 * locked for writing (maybe by virus scanner)» и ждёт разблокировки —
 * молча и бесконечно. Трижды это стоило по пятнадцать минут, причём
 * подсказка про антивирус уводит не туда: держит само приложение.
 *
 * Проверяем до сборки и падаем сразу, с понятным текстом.
 */
function checkExeFree() {
  const exe = path.join('release', 'Stardew Helper.exe');
  if (!fs.existsSync(exe)) return;
  try {
    // переименование в себя же: на Windows не проходит, если файл открыт,
    // и при этом ничего не меняет, если свободен
    fs.renameSync(exe, exe);
  } catch {
    console.error('\n  Файл занят: ' + exe);
    console.error('  Скорее всего запущена сама программа — закрой её и повтори.');
    console.error('  Посмотреть, кто держит:');
    console.error('    Get-Process | Where-Object { $_.Path -like "*Stardew Helper*" }');
    console.error('  Либо собрать мимо занятого файла:');
    console.error('    npm.cmd run dist -- --config.directories.output=release2\n');
    process.exit(1);
  }
}

checkExeFree();
await viteBuild({ configFile: 'vite.config.ts' });
await buildElectron();
console.log('готово: dist/ и dist-electron/');
