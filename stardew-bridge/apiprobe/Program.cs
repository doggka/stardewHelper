// Служебная утилита: печатает реальные сигнатуры нужных членов из сборки игры.
// Нужна, чтобы не угадывать API, которое между 1.5 и 1.6 переименовали.
using System;
using System.Linq;
using System.Reflection;

string dll = args.Length > 0
    ? args[0]
    : @"F:\SteamLibrary\steamapps\common\Stardew Valley\Stardew Valley.dll";

var asm = Assembly.LoadFrom(dll);

void Dump(string typeName, params string[] members)
{
    var t = asm.GetTypes().FirstOrDefault(x => x.FullName == typeName || x.Name == typeName);
    if (t == null) { Console.WriteLine($"ТИП НЕ НАЙДЕН: {typeName}"); return; }
    Console.WriteLine($"=== {t.FullName}");
    foreach (var name in members)
    {
        var any = false;
        foreach (var m in t.GetMembers(BindingFlags.Public | BindingFlags.NonPublic
                                       | BindingFlags.Static | BindingFlags.Instance))
        {
            if (!m.Name.Contains(name, StringComparison.OrdinalIgnoreCase)) continue;
            any = true;
            if (m is MethodInfo mi)
                Console.WriteLine($"  {mi.ReturnType.Name} {mi.Name}("
                    + string.Join(", ", mi.GetParameters().Select(p => $"{p.ParameterType.Name} {p.Name}")) + ")");
            else if (m is FieldInfo fi)
                Console.WriteLine($"  field {fi.FieldType.Name} {fi.Name}"
                    + (fi.IsLiteral ? $" = {fi.GetRawConstantValue()}" : ""));
            else if (m is PropertyInfo pi)
                Console.WriteLine($"  prop {pi.PropertyType.Name} {pi.Name}");
        }
        if (!any) Console.WriteLine($"  (ничего по «{name}»)");
    }
}

// --- что уже используется модом ---
Dump("StardewValley.Internal.ShopBuilder", "GetShopStock");
Dump("StardewValley.Game1", "shop_travelingCart");
Dump("StardewValley.Locations.Forest", "travelingMerchant");
Dump("StardewValley.ItemStockInformation", "Price", "Stock");

// --- справочник: состав узелков и названия предметов ---
Dump("StardewValley.Game1", "bundleData", "objectData", "cropData", "netWorldState");
// типы ищутся и по короткому имени — полные пространства имён между версиями ездят
Dump("NetWorldState", "Bundle");
Dump("ObjectData", "DisplayName", "Category");
Dump("CropData", "DaysInPhase", "Season", "HarvestItem");
Dump("ParsedItemData", "DisplayName", "ItemId", "Category");
Dump("StardewValley.TokenizableStrings.TokenParser", "ParseText");
Dump("StardewValley.ItemRegistry", "GetData", "Create");

// --- сводка дня: полив, удача, погода на завтра, живность ---
Dump("StardewValley.TerrainFeatures.HoeDirt", "state", "needsWatering", "crop");
Dump("StardewValley.Game1", "dailyLuck", "weatherForTomorrow", "getFarm");
Dump("StardewValley.Farm", "animals", "buildings");
Dump("FarmAnimal", "friendship", "type", "isBaby", "wasPet");
Dump("StardewValley.Farmer", "DailyLuck", "dailyLuck", "LuckLevel");
Dump("FarmerTeam", "Luck");
Dump("ParsedItemData", "GetTexture", "GetSourceRect", "SpriteIndex");

// --- ярмарка: как игра считает очки выставки ---
Dump("StardewValley.Utility", "Grange", "getGrange");
Dump("StardewValley.Event", "grange", "Grange");
Dump("StardewValley.Object", "getCategoryName", "sellToStorePrice", "Category");
Dump("StardewValley.Farmer", "artisan", "tiller", "rancher", "agriculturist");
