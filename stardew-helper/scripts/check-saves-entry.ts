// Проверочный прогон парсера сохранений: читает реальные сейвы и печатает,
// что именно он из них понял. Ничего не меняет.
import { DEFAULT_ROOT, listSaves } from '../electron/saves';
import { ROOMS } from '../src/data/bundles';

const roots = process.argv.slice(2);
if (!roots.length) roots.push(DEFAULT_ROOT);

const byId = new Map<string, string>();
for (const r of ROOMS) for (const b of r.bundles) byId.set(b.id, b.name);

const saves = listSaves(roots);
console.log('папок с сейвами:', roots.join(' | '));
console.log('найдено сохранений:', saves.length);
console.log('');

for (const s of saves) {
  console.log('─'.repeat(70));
  console.log(`${s.farmName}  (${s.playerName})  —  ${['весна', 'лето', 'осень', 'зима'][s.season]}, день ${s.day}, год ${s.year}`);
  console.log(`  версия игры: ${s.gameVersion ?? 'не указана'}   id: ${s.id}`);
  if (!s.bundlesSupported) {
    console.log(`  ИМПОРТ ОТКЛЮЧЁН: ${s.unsupportedReason}`);
    continue;
  }
  console.log(`  сдано предметов: ${s.donatedCount}   закрыто узелков: ${s.completedBundles}`);
  if (s.skipped.length) console.log(`  ПРОПУЩЕНО (другой состав): ${s.skipped.map((i) => byId.get(i)).join(', ')}`);
  for (const [id, idx] of Object.entries(s.progress)) {
    console.log(`    ${byId.get(id)}: ${idx.length} шт  [${idx.join(', ')}]`);
  }
  const paid = Object.entries(s.vault).filter(([, v]) => v).map(([k]) => k);
  if (paid.length) console.log(`    Сейф оплачено: ${paid.join(', ')}`);
}
