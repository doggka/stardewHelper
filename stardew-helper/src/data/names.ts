// items-data.js — 1605 названий предметов и страниц с ru-вики, выгружены со
// страниц-каталогов. Нужны только для поиска: отличать «не нужен для узелков»
// от «такого предмета нет». Файл большой и плоский, поэтому подключается как есть.
import './items-data.js';

declare global {
  interface Window {
    SDV_NAMES?: string[];
  }
}

export const SDV_NAMES: string[] = window.SDV_NAMES ?? [];
