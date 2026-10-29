import { GUIDES, guideById } from '../data/guides';
import { S } from '../state';
import { belongings } from '../logic/have';
import { esc } from '../ui/html';

/**
 * Экран выжимки. Текст статичный, но снаряжение сверяется с сундуками:
 * вики не знает, что у тебя уже лежит, а это и есть половина ответа на
 * вопрос «готов ли я идти».
 */
export function renderGuide(): string {
  const g = guideById(S.guide) ?? GUIDES[0];
  if (!g) return '<p class="empty">Выжимок пока нет.</p>';

  // Переключатель появляется, только когда есть из чего выбирать:
  // ряд из одной кнопки выглядит как недоделка.
  const pick = GUIDES.length > 1
    ? '<div class="gpick">' + GUIDES.map((x) =>
      '<button data-guide="' + x.id + '"' + (x.id === g.id ? ' class="on"' : '') + '>'
      + esc(x.name) + '</button>').join('') + '</div>'
    : '';

  const blocks = g.blocks.map((b) =>
    '<h3>' + esc(b.title) + '</h3><ul class="note notelist">'
    + b.lines.map((l) => '<li>' + esc(l) + '</li>').join('') + '</ul>').join('');

  return pick + '<div class="panel"><h2 class="room">' + esc(g.name) + '</h2>'
    + '<p class="note">' + esc(g.lead) + '</p>'
    + blocks + kitHTML(g.kit) + '</div>';
}

function kitHTML(kit?: { name: string; ru: string; why: string }[]): string {
  if (!kit || !kit.length) return '';
  const b = belongings();

  const rows = kit.map((k) => {
    const have = b ? b.items.filter((i) => i.name === k.name)
      .reduce((a, i) => a + i.qty, 0) : null;
    const state = b === null ? '<span class="kq dim">—</span>'
      : have ? '<span class="kq ok">' + have + '</span>'
      : '<span class="kq no">нет</span>';
    return '<li class="granged"><span class="gname">' + esc(k.ru) + '</span>'
      + '<span class="gcat">' + esc(k.why) + '</span>' + state + '</li>';
  }).join('');

  return '<h3>Что взять</h3><ul class="flat">' + rows + '</ul>'
    + (b ? '' : '<p class="note">Сундуки не прочитаны — выбери сейв, '
      + 'и будет видно, чего не хватает.</p>');
}
