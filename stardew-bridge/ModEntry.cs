using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using StardewModdingAPI;
using StardewModdingAPI.Events;
using StardewValley;

namespace StardewHelperBridge
{
    /// <summary>
    /// Единственная задача мода — выгрузить список товаров странствующей торговки
    /// в файл, чтобы его прочитало приложение Stardew Helper.
    ///
    /// Предсказать этот список снаружи нельзя: игра генерирует его на лету,
    /// а в 1.6 ещё и новым генератором случайных чисел. Зато изнутри игры он
    /// просто лежит готовым объектом — читаем и записываем, без всякой магии.
    ///
    /// Мод ничего не меняет в игре. Только читает и пишет свой файл.
    /// </summary>
    public class ModEntry : Mod
    {
        private const string OutFile = "state.json";

        public override void Entry(IModHelper helper)
        {
            helper.Events.GameLoop.DayStarted += (_, _) => Dump("day-started");
            helper.Events.GameLoop.SaveLoaded += (_, _) => Dump("save-loaded");
            // магазин открыли — ассортимент точно актуален
            helper.Events.Display.MenuChanged += (_, e) =>
            {
                if (e.NewMenu is StardewValley.Menus.ShopMenu) Dump("shop-opened");
            };
        }

        private void Dump(string reason)
        {
            try
            {
                if (!Context.IsWorldReady)
                    return;

                var items = ReadCartStock(out bool present);
                var json = BuildJson(reason, present, items);

                string path = Path.Combine(this.Helper.DirectoryPath, OutFile);
                File.WriteAllText(path, json, new UTF8Encoding(false));
                this.Monitor.Log($"Записал {items.Count} товаров торговки ({reason}).", LogLevel.Trace);
            }
            catch (Exception ex)
            {
                // Мод не должен ронять игру из-за своей вспомогательной задачи
                this.Monitor.Log($"Не смог выгрузить ассортимент: {ex.Message}", LogLevel.Warn);
            }
        }

        /// <summary>
        /// Содержимое повозки на сегодня. Пусто, если торговки нет.
        ///
        /// В 1.6 магазины переехали на данные: ассортимент собирает
        /// ShopBuilder по идентификатору магазина. У повозки он — "Traveler"
        /// (Game1.shop_travelingCart).
        /// </summary>
        private List<(string Name, int Price, int Stock)> ReadCartStock(out bool present)
        {
            var result = new List<(string, int, int)>();
            present = false;

            if (Game1.getLocationFromName("Forest") is not StardewValley.Locations.Forest forest)
                return result;

            present = forest.travelingMerchantDay;
            if (!present)
                return result;

            var stock = StardewValley.Internal.ShopBuilder.GetShopStock(Game1.shop_travelingCart);
            if (stock == null)
                return result;

            foreach (var entry in stock)
            {
                var item = entry.Key;
                if (item == null)
                    continue;

                result.Add((item.DisplayName ?? item.Name, entry.Value.Price, entry.Value.Stock));
            }

            return result;
        }

        private string BuildJson(string reason, bool present, List<(string Name, int Price, int Stock)> items)
        {
            var sb = new StringBuilder();
            sb.Append('{');
            sb.Append("\"writtenBy\":\"StardewHelperBridge\",");
            sb.Append($"\"reason\":{Quote(reason)},");
            sb.Append($"\"saveId\":{Quote(Game1.uniqueIDForThisGame.ToString())},");
            sb.Append($"\"day\":{Game1.dayOfMonth},");
            sb.Append($"\"season\":{Quote(Game1.currentSeason)},");
            sb.Append($"\"year\":{Game1.year},");
            sb.Append($"\"weather\":{Quote(Game1.isRaining ? "rain" : "sun")},");
            sb.Append($"\"cartPresent\":{(present ? "true" : "false")},");
            sb.Append("\"cart\":[");
            for (int i = 0; i < items.Count; i++)
            {
                if (i > 0) sb.Append(',');
                sb.Append('{');
                sb.Append($"\"name\":{Quote(items[i].Name)},");
                sb.Append($"\"price\":{items[i].Price},");
                sb.Append($"\"stock\":{items[i].Stock}");
                sb.Append('}');
            }
            sb.Append("]}");
            return sb.ToString();
        }

        /// <summary>Экранирование строки для JSON — без внешних библиотек.</summary>
        private static string Quote(string? s)
        {
            if (s == null) return "null";
            var sb = new StringBuilder("\"");
            foreach (char c in s)
            {
                switch (c)
                {
                    case '"': sb.Append("\\\""); break;
                    case '\\': sb.Append("\\\\"); break;
                    case '\n': sb.Append("\\n"); break;
                    case '\r': sb.Append("\\r"); break;
                    case '\t': sb.Append("\\t"); break;
                    default:
                        if (c < 0x20) sb.Append("\\u").Append(((int)c).ToString("x4"));
                        else sb.Append(c);
                        break;
                }
            }
            return sb.Append('"').ToString();
        }
    }
}
