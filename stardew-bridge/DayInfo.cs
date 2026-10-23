using System;
using StardewValley;
using StardewValley.TerrainFeatures;

namespace StardewHelperBridge
{
    /// <summary>
    /// Сводка дня: удача, погода на завтра, сколько грядок ждёт полива.
    ///
    /// Удачу и завтрашнюю погоду можно взять и из сейва — за день они не
    /// меняются. А вот полив из сейва брать нельзя: сейв переписывается
    /// только когда спишь, поэтому его ответ верен утром и становится
    /// враньём, как только польёшь руками. Поэтому считаем здесь, живьём.
    /// </summary>
    internal static class DayInfo
    {
        /// <summary>Удача дня, −0.1…0.1. Это то, что духи говорят по телевизору.</summary>
        public static double Luck()
        {
            try
            {
                return Game1.player?.DailyLuck ?? 0;
            }
            catch
            {
                return 0;
            }
        }

        public static string WeatherTomorrow()
        {
            try
            {
                return Game1.weatherForTomorrow ?? "Sun";
            }
            catch
            {
                return "Sun";
            }
        }

        /// <summary>
        /// Сколько грядок с посаженным ждёт полива.
        ///
        /// Считаем только там, где растёт: сухая земля без посева никому не
        /// мешает. Используем needsWatering() самой игры, а не разбор поля
        /// state — у него больше одного ненулевого значения, и угадывать,
        /// что они значат, незачем.
        /// </summary>
        public static int NeedWater()
        {
            int n = 0;
            try
            {
                foreach (var loc in Game1.locations)
                {
                    if (loc?.terrainFeatures == null)
                        continue;
                    foreach (var pair in loc.terrainFeatures.Pairs)
                    {
                        if (pair.Value is HoeDirt dirt && dirt.crop != null && dirt.needsWatering())
                            n++;
                    }
                }
            }
            catch
            {
                // частичный подсчёт лучше, чем сорванная выгрузка всего файла
            }
            return n;
        }
    }
}
