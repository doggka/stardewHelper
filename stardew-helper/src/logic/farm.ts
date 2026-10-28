import type { FarmState, Item } from '../types';
import { S } from '../state';

/**
 * Подсказка по цепочке «постройка → животное → сердечки» с учётом того,
 * что на ферме уже есть.
 *
 * Смысл: совет про уже сделанное — это шум. «Элитный хлев + свинья» при
 * построенном хлеве и купленной свинье не говорит ничего, зато прячет
 * настоящую причину, по которой трюфеля до сих пор нет.
 *
 * Показываем первый невыполненный шаг. Когда выполнены все — говорим,
 * что мешает на самом деле.
 */

/**
 * Порог «высоких сердечек» для крупных продуктов. Дружба в игре 0–1000.
 * Точного числа игра не обещает: крупный продукт выпадает тем чаще, чем
 * выше дружба и настроение. Поэтому порог грубый и текст об этом честен —
 * «мало сердечек», а не «нужно ровно столько».
 */
const HEARTS_OK = 800;

const BARN_RU = ['', 'хлев', 'большой хлев', 'элитный хлев'];
const COOP_RU = ['', 'курятник', 'большой курятник', 'элитный курятник'];

export function farmState(): FarmState | null {
  return S.save?.farm ?? null;
}

/**
 * Что сказать про предмет с цепочкой. null — цепочки нет либо состояние
 * фермы неизвестно, и тогда остаётся прежний текст из данных.
 */
/**
 * Цепочка собрана целиком: постройка есть, животное есть, сердечек хватает.
 * Пока не собрана — показываем советы про подготовку; когда собрана, они
 * только мешают.
 *
 * Про ферму ничего не знаем — считаем, что не собрана: совет лишним быть
 * не перестанет, а вот промолчать там, где надо копить деньги, хуже.
 */
export function needDone(it: Item): boolean {
  const need = it.need;
  const f = farmState();
  if (!need) return true;
  if (!f) return false;

  // как и в needHint: есть животное — значит постройка под него уже есть
  const mine = need.animal
    ? f.animals.filter((a) => need.animal!.indexOf(a.type) >= 0)
    : [];
  if (!mine.length) {
    if (need.barn && f.barn < need.barn) return false;
    if (need.coop && f.coop < need.coop) return false;
    if (need.animal) return false;
    return true;
  }
  if (need.hearts && !mine.some((a) => a.hearts >= HEARTS_OK)) return false;
  return true;
}

export function needHint(it: Item): string | null {
  const need = it.need;
  const f = farmState();
  if (!need || !f) return null;

  // Животное проверяем первым, постройку — только если животного нет.
  // Иначе выходит глупость: шерсть дают и овца (элитный хлев), и кролик
  // (элитный курятник), и при живом кролике мы требовали построить хлев.
  const mine = need.animal
    ? f.animals.filter((a) => need.animal!.indexOf(a.type) >= 0)
    : [];

  if (!mine.length) {
    if (need.barn && f.barn < need.barn) return 'нужен ' + BARN_RU[need.barn];
    if (need.coop && f.coop < need.coop) return 'нужен ' + COOP_RU[need.coop];
    if (need.animal) {
      // без «нужна/нужен»: род у животных разный, а подставлять его
      // по строке — лишний код ради десяти подсказок
      return 'постройка есть, не хватает: ' + (need.animalRu ?? 'живность');
    }
    return need.then ?? null;
  }

  if (need.hearts) {
    const best = mine.reduce((a, b) => (b.hearts > a.hearts ? b : a));
    if (best.hearts < HEARTS_OK) {
      return (need.animalRu ?? 'животному') + ': мало сердечек, гладь и корми каждый день';
    }
  }

  return need.then ?? null;
}
