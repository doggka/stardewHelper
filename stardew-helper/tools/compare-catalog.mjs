/**
 * Сверка нашего состава узелков со справочником, который выгрузил мод.
 *
 * Запускать до того, как что-то переключать на новый источник: это проверка
 * сразу в обе стороны. Так мы уже один раз выяснили, что расхождение было
 * из-за версии игры, а не из-за перемешанных узелков.
 *
 *   node tools/compare-catalog.mjs [путь к catalog.json]
 *
 * Ничего не меняет, только печатает отчёт.
 */
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_CATALOG =
  'F:\\SteamLibrary\\steamapps\\common\\Stardew Valley\\Mods\\StardewHelperBridge\\catalog.json';

/** Названия сравниваем так же, как в приложении: регистр и ё не считаются. */
const norm = (s) => String(s ?? '').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();

async function loadOurBundles() {
  // bundles.ts — TypeScript, поэтому прогоняем через esbuild, который и так
  // стоит как зависимость vite. Отдельного тулчейна не заводим.
  const out = path.join(here, '.bundles.tmp.mjs');
  await build({
    entryPoints: [path.join(here, '..', 'src', 'data', 'bundles.ts')],
    outfile: out,
    bundle: true,
    format: 'esm',
    platform: 'node',
    logLevel: 'silent',
  });
  const mod = await import(pathToFileURL(out).href);
  fs.rmSync(out, { force: true });
  return mod.ROOMS;
}

function readCatalog(file) {
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\ufeff/, ''));
}

function ourBundleList(rooms) {
  const out = [];
  rooms.forEach((r) => {
    if (r.vault) return;
    r.bundles.forEach((b) => {
      if (b.saveKey === undefined) return;
      out.push(b);
    });
  });
  return out;
}

function main() {
  const file = process.argv[2] || DEFAULT_CATALOG;
  const cat = readCatalog(file);
  if (!cat) {
    console.log('Справочника нет: ' + file);
    console.log('Он появляется после того, как игра один раз запущена с модом.');
    process.exitCode = 2;
    return;
  }

  console.log('Справочник: игра ' + cat.gameVersion + ', язык ' + cat.language
    + ', сейв ' + cat.saveId + ', узелков ' + cat.bundles.length);
  console.log('');

  loadOurBundles().then((rooms) => {
    const ours = ourBundleList(rooms);
    const byKey = new Map();
    cat.bundles.forEach((b) => {
      const n = parseInt(String(b.key).split('/')[1], 10);
      if (!Number.isNaN(n)) byKey.set(n, b);
    });

    let same = 0;
    const problems = [];

    ours.forEach((b) => {
      const g = byKey.get(b.saveKey);
      if (!g) {
        problems.push('— ' + b.name + ' (saveKey ' + b.saveKey + '): в справочнике нет');
        return;
      }
      const lines = [];

      const need = g.required === null ? g.items.length : g.required;
      if (need !== b.slots) lines.push('слотов: у нас ' + b.slots + ', в игре ' + need);
      if (g.items.length !== (b.items || []).length) {
        lines.push('предметов: у нас ' + (b.items || []).length + ', в игре ' + g.items.length);
      }

      const gameNames = g.items.map((i) => norm(i.name));
      (b.items || []).forEach((it) => {
        if (gameNames.indexOf(norm(it.n)) < 0) {
          lines.push('нет совпадения по названию: «' + it.n + '»');
        }
      });

      if (lines.length) problems.push('— ' + b.name + ' [' + g.key + ']\n    ' + lines.join('\n    '));
      else same++;
    });

    const extra = [...byKey.keys()].filter((k) => !ours.some((b) => b.saveKey === k));

    console.log('Совпало полностью: ' + same + ' из ' + ours.length);
    if (extra.length) {
      console.log('Есть в игре, но нет у нас: ' + extra.map((k) => byKey.get(k).key).join(', '));
    }
    if (problems.length) {
      console.log('\nРасхождения:\n' + problems.join('\n'));
    } else {
      console.log('\nРасхождений нет.');
    }
  });
}

main();
