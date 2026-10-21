using Npgsql;

namespace Ciftligim.Api.Data;

public static class DatabaseUrl
{
    // Neon/Render "postgresql://kullanici:sifre@host/veritabani?sslmode=require" biçimini
    // Npgsql'in anladığı "Host=...;Username=..." biçimine çevirir. Zaten öyleyse dokunmaz.
    public static string? Normalize(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return value;
        var v = value.Trim();
        if (!v.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase) &&
            !v.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase))
            return v;

        var uri = new Uri(v);
        var userInfo = uri.UserInfo.Split(':', 2);
        var b = new NpgsqlConnectionStringBuilder
        {
            Host = uri.Host,
            Port = uri.IsDefaultPort || uri.Port <= 0 ? 5432 : uri.Port,
            Username = Uri.UnescapeDataString(userInfo[0]),
            Password = userInfo.Length > 1 ? Uri.UnescapeDataString(userInfo[1]) : null,
            Database = Uri.UnescapeDataString(uri.AbsolutePath.TrimStart('/')),
            SslMode = SslMode.Require,
        };
        // Sorgu parametrelerinden yalnızca bilinenleri al (channel_binding gibi Npgsql'e özgü olmayanları atla)
        foreach (var part in uri.Query.TrimStart('?').Split('&', StringSplitOptions.RemoveEmptyEntries))
        {
            var kv = part.Split('=', 2);
            if (kv.Length == 2 && kv[0].Equals("sslmode", StringComparison.OrdinalIgnoreCase) &&
                Enum.TryParse<SslMode>(kv[1], true, out var mode))
                b.SslMode = mode;
        }
        return b.ConnectionString;
    }
}
