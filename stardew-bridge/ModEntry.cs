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
        private const string CatalogFile = "catalog.json";

        public override void Entry(IModHelper helper)
        {
            helper.Events.GameLoop.DayStarted += (_, _) => Dump("day-started");
            helper.Events.GameLoop.SaveLoaded += (_, _) =>
            {
                Dump("save-loaded");
                // справочник зависит от сейва (узелки могут быть перемешаны)
                // и от версии игры, поэтому пишем его при загрузке сейва
                DumpCatalog();
            };
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

                var items = ReadCartStock(out bool present, out bool flag);
                var json = BuildJson(reason, present, flag, items);

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

        private void DumpCatalog()
        {
            try
            {
                if (!Context.IsWorldReady)
                    return;

                string path = Path.Combine(this.Helper.DirectoryPath, CatalogFile);
                File.WriteAllText(path, Catalog.Build(), new UTF8Encoding(false));
                this.Monitor.Log("Записал справочник узелков.", LogLevel.Trace);
            }
            catch (Exception ex)
            {
                this.Monitor.Log($"Не смог выгрузить справочник: {ex.Message}", LogLevel.Warn);
            }
        }

        /// <summary>
        /// Содержимое повозки на сегодня. Пусто, если торговки нет.
        ///
        /// В 1.6 магазины переехали на данные: ассортимент собирает
        /// ShopBuilder по идентификатору магазина. У повозки он — "Traveler"
        /// (Game1.shop_travelingCart).
        /// </summary>
        private List<(string Name, int Price, int Stock)> ReadCartStock(out bool present, out bool flag)
        {
            var result = new List<(string, int, int)>();
            present = false;
            flag = false;

            if (Game1.getLocationFromName("Forest") is not StardewValley.Locations.Forest forest)
                return result;

            // Источник правды — вычисляемый метод, а не поле travelingMerchantDay.
            // Поле кэшируется и обновляется игрой в свой момент, поэтому в момент
            // нашего чтения оно может хранить ещё вчерашнее значение: приложение
            // один раз уже показало торговку в понедельник.
            flag = forest.travelingMerchantDay;
            present = forest.ShouldTravelingMerchantVisitToday();
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

        private string BuildJson(string reason, bool present, bool flag, List<(string Name, int Price, int Stock)> items)
        {
            var sb = new StringBuilder();
            sb.Append('{');
            sb.Append("\"writtenBy\":\"StardewHelperBridge\",");
            sb.Append($"\"reason\":{Json.Quote(reason)},");
            sb.Append($"\"saveId\":{Json.Quote(Game1.uniqueIDForThisGame.ToString())},");
            sb.Append($"\"day\":{Game1.dayOfMonth},");
            sb.Append($"\"season\":{Json.Quote(Game1.currentSeason)},");
            sb.Append($"\"year\":{Game1.year},");
            sb.Append($"\"weather\":{Json.Quote(Game1.isRaining ? "rain" : "sun")},");
            sb.Append($"\"luck\":{DayInfo.Luck().ToString("0.###", System.Globalization.CultureInfo.InvariantCulture)},");
            sb.Append($"\"weatherTomorrow\":{Json.Quote(DayInfo.WeatherTomorrow())},");
            sb.Append($"\"needWater\":{DayInfo.NeedWater()},");
            sb.Append($"\"cartPresent\":{(present ? "true" : "false")},");
            // кэшированное поле игры рядом с вычисленным: если они разойдутся,
            // это станет видно прямо в файле, а не останется невидимым
            sb.Append($"\"cartFlag\":{(flag ? "true" : "false")},");
            sb.Append("\"cart\":[");
            for (int i = 0; i < items.Count; i++)
            {
                if (i > 0) sb.Append(',');
                sb.Append('{');
                sb.Append($"\"name\":{Json.Quote(items[i].Name)},");
                sb.Append($"\"price\":{items[i].Price},");
                sb.Append($"\"stock\":{items[i].Stock}");
                sb.Append('}');
            }
            sb.Append("]}");
            return sb.ToString();
        }

    }
}
