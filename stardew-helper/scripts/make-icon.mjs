// Собирает build/icon.ico из build/icon-256.png.
// ICO начиная с Vista умеет хранить PNG как есть, поэтому достаточно
// приписать к файлу заголовок из 22 байт — внешние утилиты не нужны.
import fs from 'node:fs';
import path from 'node:path';

const dir = path.join(process.cwd(), 'build');
const png = fs.readFileSync(path.join(dir, 'icon-256.png'));

const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // 1 = иконка
header.writeUInt16LE(1, 4); // одна картинка

const entry = Buffer.alloc(16);
entry.writeUInt8(0, 0); // ширина: 0 означает 256
entry.writeUInt8(0, 1); // высота: тоже 256
entry.writeUInt8(0, 2); // палитра не используется
entry.writeUInt8(0, 3); // reserved
entry.writeUInt16LE(1, 4); // плоскости
entry.writeUInt16LE(32, 6); // бит на пиксель
entry.writeUInt32LE(png.length, 8);
entry.writeUInt32LE(header.length + entry.length, 12);

fs.writeFileSync(path.join(dir, 'icon.ico'), Buffer.concat([header, entry, png]));
console.log('build/icon.ico готов,', png.length, 'байт картинки');
