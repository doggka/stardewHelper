using System;
using System.Collections.Generic;
using System.IO;
using Microsoft.Xna.Framework;
using Microsoft.Xna.Framework.Graphics;
using StardewValley;

namespace StardewHelperBridge
{
    /// <summary>
    /// Выгрузка иконок предметов в PNG.
    ///
    /// Зачем: приложению нужны картинки для сетки слотов, а рисовать свои
    /// мы не будем. Спрайты лежат в Content/*.xnb и напрямую не читаются,
    /// но изнутри игры ItemRegistry отдаёт и текстуру, и прямоугольник
    /// спрайта. Тот же приём, что со справочником узелков.
    ///
    /// Пишем один раз на версию игры, рядом со справочником. Приложение
    /// обязано работать и без этих файлов: мод есть не у всех.
    /// </summary>
    internal static class Icons
    {
        /// <summary>
        /// Сохраняет иконки для перечисленных id. Возвращает, сколько вышло.
        /// Чего не нашлось — просто пропускаем: лучше часть картинок, чем
        /// сорванная выгрузка целиком.
        /// </summary>
        public static int Dump(IEnumerable<string> itemIds, string dir)
        {
            Directory.CreateDirectory(dir);
            int ok = 0;

            foreach (string id in itemIds)
            {
                try
                {
                    var data = ItemRegistry.GetData(id);
                    var tex = data?.GetTexture();
                    if (tex == null)
                        continue;

                    // offset 0, спрайт по умолчанию: вариантов у предмета нет
                    var rect = data.GetSourceRect(0, null);
                    string path = Path.Combine(dir, Safe(id) + ".png");
                    using var cut = Crop(tex, rect);
                    using var file = File.Create(path);
                    cut.SaveAsPng(file, cut.Width, cut.Height);
                    ok++;
                }
                catch
                {
                    // битый id не должен обрывать остальные
                }
            }

            return ok;
        }

        /// <summary>
        /// Вырезает прямоугольник в отдельную текстуру: спрайт лежит в общем
        /// листе, целиком его сохранять бессмысленно.
        /// </summary>
        private static Texture2D Crop(Texture2D sheet, Rectangle rect)
        {
            var pixels = new Color[rect.Width * rect.Height];
            sheet.GetData(0, rect, pixels, 0, pixels.Length);
            var cut = new Texture2D(sheet.GraphicsDevice, rect.Width, rect.Height);
            cut.SetData(pixels);
            return cut;
        }

        /// <summary>id вроде «(O)128» содержит скобки — в имени файла им не место.</summary>
        private static string Safe(string id)
        {
            var chars = id.ToCharArray();
            for (int i = 0; i < chars.Length; i++)
            {
                if (!char.IsLetterOrDigit(chars[i]))
                    chars[i] = '_';
            }
            return new string(chars);
        }
    }
}
