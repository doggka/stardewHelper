using System;
using System.Collections.Generic;
using System.Text;
using StardewValley;

namespace StardewHelperBridge
{
    /// <summary>
    /// Выгрузка справочника: состав узелков этого сейва и русские названия
    /// предметов.
    ///
    /// Зачем изнутри игры, а не из её файлов: в Content/Data всё лежит в .xnb,
    /// напрямую не читается. Распаковщик добавил бы внешнюю утилиту, копию
    /// данных в сборке и привязку к версии игры. Изнутри то же самое доступно
    /// готовым объектом, на языке игры и той версии, что реально установлена.
    ///
    /// Справочник даёт приложению только ключ и название. Где добывать,
    /// предупреждения и план по сезонам остаются на стороне приложения —
    /// их в игре нет и быть не может.
    /// </summary>
    internal static class Catalog
    {
        /// <summary>
        /// Состав узелков вместе с сырой строкой, из которой он разобран.
        ///
        /// Формат строки между версиями менялся, поэтому `raw` сохраняем
        /// всегда: если разбор окажется неверным, это будет видно по данным,
        /// а не по молчаливо неправильному результату.
        /// </summary>
        public static string Build()
        {
            var sb = new StringBuilder();
            sb.Append('{');
            sb.Append("\"writtenBy\":\"StardewHelperBridge\",");
            sb.Append($"\"gameVersion\":{Json.Quote(Game1.version)},");
            sb.Append($"\"language\":{Json.Quote(Language())},");
            sb.Append($"\"saveId\":{Json.Quote(Game1.uniqueIDForThisGame.ToString())},");
            sb.Append("\"bundles\":[");

            var data = Game1.netWorldState?.Value?.BundleData;
            if (data != null)
            {
                bool first = true;
                foreach (var pair in data)
                {
                    if (!first) sb.Append(',');
                    first = false;
                    AppendBundle(sb, pair.Key, pair.Value);
                }
            }

            sb.Append("]}");
            return sb.ToString();
        }

        private static void AppendBundle(StringBuilder sb, string key, string raw)
        {
            // ключ — "Комната/номер", значение — поля через «/»
            var slash = key.IndexOf('/');
            var room = slash > 0 ? key.Substring(0, slash) : key;
            var parts = raw.Split('/');

            sb.Append('{');
            sb.Append($"\"key\":{Json.Quote(key)},");
            sb.Append($"\"room\":{Json.Quote(room)},");
            sb.Append($"\"raw\":{Json.Quote(raw)},");
            sb.Append($"\"nameEn\":{Json.Quote(Field(parts, 0))},");
            sb.Append($"\"reward\":{Json.Quote(Field(parts, 1))},");
            // число слотов необязательное: когда его нет, нужны все предметы
            sb.Append($"\"required\":{Json.Int(Field(parts, 4))},");
            sb.Append($"\"displayName\":{Json.Quote(Field(parts, 6))},");
            sb.Append("\"items\":[");

            // предметы идут тройками «id количество качество»
            var items = Field(parts, 2).Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);
            bool first = true;
            for (int i = 0; i + 2 < items.Length; i += 3)
            {
                if (!first) sb.Append(',');
                first = false;
                sb.Append('{');
                sb.Append($"\"id\":{Json.Quote(items[i])},");
                sb.Append($"\"qty\":{Json.Int(items[i + 1])},");
                sb.Append($"\"quality\":{Json.Int(items[i + 2])},");
                sb.Append($"\"name\":{Json.Quote(DisplayName(items[i]))}");
                sb.Append('}');
            }

            sb.Append("]}");
        }

        /// <summary>Русское название предмета по его идентификатору.</summary>
        private static string? DisplayName(string itemId)
        {
            try
            {
                return ItemRegistry.GetData(itemId)?.DisplayName;
            }
            catch
            {
                // неизвестный id не должен обрывать выгрузку всего справочника
                return null;
            }
        }

        private static string Field(IReadOnlyList<string> parts, int i)
            => i < parts.Count ? parts[i] : string.Empty;

        private static string Language()
        {
            try
            {
                return LocalizedContentManager.CurrentLanguageCode.ToString();
            }
            catch
            {
                return "unknown";
            }
        }
    }
}
