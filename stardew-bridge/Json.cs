using System.Globalization;
using System.Text;

namespace StardewHelperBridge
{
    /// <summary>
    /// Минимальная сборка JSON без внешних библиотек: мод пишет два небольших
    /// файла, тянуть ради этого зависимость незачем.
    /// </summary>
    internal static class Json
    {
        public static string Quote(string? s)
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

        /// <summary>
        /// Число или null. Именно null, а не ноль: у части узелков поля
        /// с числом слотов нет вовсе, и ноль там читался бы как «слотов нет».
        /// </summary>
        public static string Int(string? s)
            => int.TryParse(s, NumberStyles.Integer, CultureInfo.InvariantCulture, out int v)
                ? v.ToString(CultureInfo.InvariantCulture)
                : "null";
    }
}
