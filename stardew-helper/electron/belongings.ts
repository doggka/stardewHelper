import fs from 'node:fs';

/**
 * Что у игрока уже есть: в карманах, в сундуках и на грядках.
 *
 * Только чтение сейва, как и всё остальное. Мод для этого не нужен:
 * сейв переписывается при каждом сне и после альт-таба.
 *
 * Сверяем строго по itemId. По названию нельзя: отображаемые имена в игре
 * не уникальны — id 182 и 174 оба «Большое яйцо», и подсказка «у тебя это
 * есть» показала бы белое яйцо вместо коричневого.
 *
 * Разбор местами нарочно осторожный: лучше не заметить предмет, чем
 * сказать «он у тебя есть», когда его нет. Поэтому все сомнительные
 * случаи трактуются как «не нашли».
 */

export interface HeldItem {
  id: string;
  qty: number;
  quality: number;
  /** 'bag' — в карманах, иначе сундук */
  where: 'bag' | 'chest';
  loc?: string;
  x?: number;
  y?: number;
}

export interface GrowingCrop {
  id: string;
  loc: string;
  x: number;
  y: number;
  /** 0 — можно собирать уже сегодня */
  days: number;
}

export interface Belongings {
  items: HeldItem[];
  crops: GrowingCrop[];
}

/**
 * Поля предмета идут в начале его сериализации (category, name, itemId,
 * quality, stack), поэтому берём первое вхождение после позиции предмета.
 * Так не нужно разбирать вложенность: предмет внутри предмета
 * (например, в машине) до своих полей не дотянется.
 */
function fieldAfter(xml: string, from: number, name: string, limit = 2000): string | null {
  const m = new RegExp('<' + name + '>([^<]*)</' + name + '>').exec(xml.slice(from, from + limit));
  return m ? m[1] : null;
}

const num = (s: string | null, dflt = 0): number => {
  const v = parseInt(s ?? '', 10);
  return Number.isNaN(v) ? dflt : v;
};

/** Обычные предметы. Оружие и инструменты нумеруются отдельно и совпали бы по id. */
const OBJECT_ITEM = /<Item xsi:type="(?:Object|ColoredObject)">/g;

function readItems(xml: string, where: 'bag' | 'chest',
  loc?: string, x?: number, y?: number): HeldItem[] {
  const out: HeldItem[] = [];
  OBJECT_ITEM.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = OBJECT_ITEM.exec(xml))) {
    const at = m.index;
    const id = fieldAfter(xml, at, 'itemId');
    if (!id) continue;
    out.push({
      id,
      qty: num(fieldAfter(xml, at, 'stack'), 1),
      quality: num(fieldAfter(xml, at, 'quality')),
      where, loc, x, y,
    });
  }
  return out;
}

/** Имя самой локации, а не первого попавшегося NPC или сорняка внутри неё. */
function locationName(seg: string): string {
  const m = /<name>([^<]*)<\/name><waterColor>/.exec(seg);
  return m ? m[1] : '';
}

/**
 * Сколько дней до сбора. phaseDays — длительности фаз, последняя (99999)
 * означает «выросло». Остаток = сумма оставшихся фаз минус прожитое
 * в текущей.
 */
function daysLeft(crop: string): number {
  if (/<fullGrown>true<\/fullGrown>/.test(crop)) return 0;
  const block = /<phaseDays>([\s\S]*?)<\/phaseDays>/.exec(crop);
  if (!block) return 0;
  const days = [...block[1].matchAll(/<int>(-?\d+)<\/int>/g)].map((m) => parseInt(m[1], 10));
  const cur = num(/<currentPhase>(-?\d+)<\/currentPhase>/.exec(crop)?.[1] ?? null);
  const inPhase = num(/<dayOfCurrentPhase>(-?\d+)<\/dayOfCurrentPhase>/.exec(crop)?.[1] ?? null);
  if (cur >= days.length - 1) return 0;
  let sum = 0;
  for (let i = cur; i < days.length - 1; i++) sum += days[i];
  return Math.max(0, sum - inPhase);
}

function readCrops(seg: string, loc: string): GrowingCrop[] {
  const out: GrowingCrop[] = [];
  const re = /<crop>([\s\S]*?)<\/crop>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(seg))) {
    const id = /<indexOfHarvest>([^<]*)<\/indexOfHarvest>/.exec(m[1])?.[1];
    if (!id || id === '-1') continue;
    // координаты лежат в ключе перед самой грядкой
    const before = seg.lastIndexOf('<Vector2>', m.index);
    const v = before < 0 ? null : /<X>(-?\d+)<\/X><Y>(-?\d+)<\/Y>/.exec(seg.slice(before, before + 120));
    out.push({
      id, loc,
      x: v ? parseInt(v[1], 10) : -1,
      y: v ? parseInt(v[2], 10) : -1,
      days: daysLeft(m[1]),
    });
  }
  return out;
}

export function readBelongings(file: string): Belongings | null {
  let xml: string;
  try {
    xml = fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }

  const items: HeldItem[] = [];
  const crops: GrowingCrop[] = [];

  // карманы: блок игрока идёт до списка локаций
  const player = /<player>([\s\S]*?)<\/player>/.exec(xml);
  if (player) {
    const bag = /<items>([\s\S]*?)<\/items>/.exec(player[1]);
    if (bag) items.push(...readItems(bag[1], 'bag'));
  }

  // локации: у каждой свои сундуки и грядки
  const segs = xml.split(/(?=<GameLocation )/).slice(1);
  for (const seg of segs) {
    const loc = locationName(seg);
    crops.push(...readCrops(seg, loc));

    const chests = /<Object xsi:type="Chest">/g;
    let c: RegExpExecArray | null;
    while ((c = chests.exec(seg))) {
      const head = seg.slice(c.index, c.index + 3000);
      const tile = /<tileLocation><X>(-?\d+)<\/X><Y>(-?\d+)<\/Y><\/tileLocation>/.exec(head);
      const start = seg.indexOf('<items>', c.index);
      if (start < 0) continue;
      const end = seg.indexOf('</items>', start);
      if (end < 0) continue;
      items.push(...readItems(seg.slice(start, end), 'chest', loc,
        tile ? parseInt(tile[1], 10) : -1, tile ? parseInt(tile[2], 10) : -1));
    }
  }

  return { items, crops };
}
