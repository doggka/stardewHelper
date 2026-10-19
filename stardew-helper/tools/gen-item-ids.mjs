/**
 * Генератор таблицы «наш предмет → itemId из игры».
 *
 *   node tools/gen-item-ids.mjs [путь к catalog.json]
 *
 * Зачем таблица, а не сверка по названию на лету: отображаемые имена в игре
 * не уникальны. id 182 и 174 оба называются «Большое яйцо», и сверка по
 * названию перепутала бы коричневое с белым. Плюс таблица коммитится, и
 * приложению после этого не нужен ни мод, ни запущенная игра.
 *
 * Если сопоставить удалось не всё — файл не пишется вовсе. Пропущенный id
 * превратится в «у тебя этого нет» ровно тогда, когда предмет лежит
 * в сундуке, а это хуже, чем отсутствие функции целиком.
 */
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, '..', 'src', 'data', 'itemIds.ts');
const DEFAULT_CATALOG =
  'F:\\SteamLibrary\\steamapps\\common\\Stardew Valley\\Mods\\StardewHelperBridge\\catalog.json';

/** Уточнения в скобках — наши, в игре их нет: «Большое яйцо (коричневое)». */
const norm = (s) => String(s ?? '')
  .toLowerCase().replace(/ё/g, 'е')
  .replace(/\s*\([^)]*\)\s*/g, ' ')
  .replace(/\s+/g, ' ').trim();

async function loadRooms() {
  const tmp = path.join(here, '.bundles.tmp.mjs');
  await build({
    entryPoints: [path.join(here, '..', 'src', 'data', 'bundles.ts')],
    outfile: tmp, bundle: true, format: 'esm', platform: 'node', logLevel: 'silent',
  });
  const mod = await import(pathToFileURL(tmp).href);
  fs.rmSync(tmp, { force: true });
  return mod.ROOMS;
}

async function main() {
  const file = process.argv[2] || DEFAULT_CATALOG;
  if (!fs.existsSync(file)) {
    console.error('Справочника нет: ' + file);
    console.error('Он появляется после того, как игра один раз запущена с модом.');
    process.exit(2);
  }
  const cat = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\ufeff/, ''));
  const rooms = await loadRooms();

  const byKey = new Map();
  cat.bundles.forEach((b) => {
    const n = parseInt(String(b.key).split('/')[1], 10);
    if (!Number.isNaN(n)) byKey.set(n, b);
  });

  const map = {};         // наш id предмета → itemId игры
  const byPosition = [];  // где пришлось решать по позиции
  const failed = [];

  rooms.forEach((r) => {
    if (r.vault) return;
    r.bundles.forEach((b) => {
      const g = byKey.get(b.saveKey);
      if (!g || !b.items) return;

      const used = new Set();
      b.items.forEach((it, i) => {
        const ourId = b.id + ':' + i;
        const want = norm(it.n);
        const hits = g.items
          .map((x, j) => ({ x, j }))
          .filter(({ x, j }) => !used.has(j) && norm(x.name) === want);

        if (!hits.length) {
          failed.push(b.name + ' → «' + it.n + '» (' + ourId + ')');
          return;
        }
        // при нескольких одинаковых именах берём первый свободный по порядку:
        // наш состав идёт в том же порядке, что и состав в игре
        const pick = hits[0];
        used.add(pick.j);
        map[ourId] = pick.x.id;
        if (hits.length > 1) byPosition.push(b.name + ' → «' + it.n + '» = id ' + pick.x.id);
      });
    });
  });

  const total = Object.keys(map).length;
  console.log('Игра ' + cat.gameVersion + ', язык ' + cat.language);
  console.log('Сопоставлено: ' + total);
  if (byPosition.length) {
    console.log('\nПо позиции (в игре одинаковые названия):');
    byPosition.forEach((s) => console.log('  ' + s));
  }
  if (failed.length) {
    console.log('\nНе сопоставлено — файл НЕ записан:');
    failed.forEach((s) => console.log('  ' + s));
    process.exit(1);
  }

  const lines = Object.keys(map).sort().map((k) => "  '" + k + "': '" + map[k] + "',");
  fs.writeFileSync(OUT,
    '/* Сгенерировано tools/gen-item-ids.mjs — руками не править.\n'
    + ' *\n'
    + ' * Наш предмет узелка → itemId из игры. Ключ нужен потому, что\n'
    + ' * отображаемые имена в игре не уникальны: id 182 и 174 оба\n'
    + ' * называются «Большое яйцо». По названию сундуки сверять нельзя.\n'
    + ' *\n'
    + ' * Источник: игра ' + cat.gameVersion + ', язык ' + cat.language + '.\n'
    + ' * Перегенерировать после обновления игры:\n'
    + ' *   node tools/gen-item-ids.mjs\n'
    + ' */\n'
    + 'export const ITEM_IDS: Record<string, string> = {\n'
    + lines.join('\n') + '\n};\n',
    'utf8');
  console.log('\nЗаписано: ' + path.relative(process.cwd(), OUT));
}

main();
