/**
 * Проверка подсказок по состоянию фермы на настоящем сейве.
 *
 *   node tools/check-farm.mjs
 *
 * Печатает, что прочиталось из сейва и во что превращается цепочка
 * у каждого предмета. Нужна, чтобы убедиться: подсказка про уже
 * построенный хлев исчезла, а не превратилась во что-то другое.
 */
import { build } from 'esbuild';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

async function load(rel) {
  const tmp = path.join(here, '.f.' + path.basename(rel) + '.mjs');
  await build({
    entryPoints: [path.join(here, '..', rel)],
    outfile: tmp, bundle: true, format: 'esm', platform: 'node', logLevel: 'silent',
    external: ['node:fs', 'node:path', 'node:os'],
  });
  const mod = await import(pathToFileURL(tmp).href);
  fs.rmSync(tmp, { force: true });
  return mod;
}

const { listSaves, DEFAULT_ROOT } = await load('electron/saves.ts');
const { ROOMS } = await load('src/data/bundles.ts');

const saves = listSaves([DEFAULT_ROOT]);
if (!saves.length) { console.error('Сейвов нет'); process.exit(2); }
const s = saves.find((x) => x.farmName === 'Пивзавод') ?? saves[0];

console.log('Сейв: ' + s.farmName + ', ' + s.day + ' '
  + ['весна', 'лето', 'осень', 'зима'][s.season] + ', год ' + s.year);
console.log('Погода: сегодня ' + s.weather + ', завтра ' + s.weatherTomorrow
  + ' · удача ' + s.luck);
console.log('Хлев: ' + s.farm.barn + ', курятник: ' + s.farm.coop
  + ', теплица: ' + (s.farm.greenhouse ? 'есть' : 'нет'));

const byType = {};
s.farm.animals.forEach((a) => {
  if (!byType[a.type]) byType[a.type] = { n: 0, best: 0 };
  byType[a.type].n++;
  byType[a.type].best = Math.max(byType[a.type].best, a.hearts);
});
console.log('Живность:');
for (const t of Object.keys(byType)) {
  console.log('  ' + t + ' ×' + byType[t].n + ', лучшая дружба ' + byType[t].best + '/1000');
}

// повторяем логику needHint на прочитанном состоянии
const HEARTS_OK = 800;
const BARN_RU = ['', 'хлев', 'большой хлев', 'элитный хлев'];
const COOP_RU = ['', 'курятник', 'большой курятник', 'элитный курятник'];
function hint(need, f) {
  if (need.barn && f.barn < need.barn) return 'нужен ' + BARN_RU[need.barn];
  if (need.coop && f.coop < need.coop) return 'нужен ' + COOP_RU[need.coop];
  if (need.animal) {
    const mine = f.animals.filter((a) => need.animal.includes(a.type));
    if (!mine.length) return 'постройка есть, не хватает: ' + (need.animalRu ?? 'живность');
    if (need.hearts) {
      const best = mine.reduce((a, b) => (b.hearts > a.hearts ? b : a));
      if (best.hearts < HEARTS_OK) {
        return (need.animalRu ?? 'животному') + ': мало сердечек, гладь и корми каждый день';
      }
    }
  }
  return need.then ?? '(нет текста)';
}

console.log('\nПодсказки:');
ROOMS.forEach((r) => r.bundles.forEach((b) => (b.items || []).forEach((it) => {
  if (!it.need) return;
  console.log('  ' + it.n);
  console.log('    было:  ' + it.c);
  console.log('    стало: ' + hint(it.need, s.farm));
})));
