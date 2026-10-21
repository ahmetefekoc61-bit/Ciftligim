using System.Globalization;
using System.Text.Json;
using Microsoft.Extensions.Caching.Memory;

namespace Ciftligim.Api.Tkgm;

public record TkgmItem(int Id, string Name);

public record TkgmParcel(
    int? NeighborhoodId, string Province, string District, string Neighborhood,
    int BlockNo, int ParcelNo, decimal? AreaM2, string? Quality, string? Locality, string? Sheet,
    JsonElement? Geometry, double? CenterLat, double? CenterLon);

public class TkgmException(string message) : Exception(message);

// TKGM Parsel Sorgu sitesinin kullandığı servis. Resmi/açık bir API DEĞİL:
//  - Yalnızca kullanıcı bir parseli istediğinde, tek tek sorgulanır (toplu tarama yapılmaz).
//  - İl/ilçe/mahalle listeleri bellekte saklanır, aynı şey tekrar sorulmaz.
//  - Servis değişir ya da erişimi keserse uygulama elle girişle çalışmaya devam eder.
public class TkgmClient(HttpClient http, IMemoryCache cache, ILogger<TkgmClient> log)
{
    public const string BaseUrl = "https://cbsapi.tkgm.gov.tr/megsiswebapi.v3.1/api/";

    // İl listesi Parsel Sorgu sitesinin statik dosyasından gelir (il kimlikleri plaka kodu DEĞİL)
    public const string ProvinceListUrl = "https://parselsorgu.tkgm.gov.tr/app/modules/administrativeQuery/data/ilListe.json";

    public Task<List<TkgmItem>> GetProvinces() => GetList(ProvinceListUrl, "tkgm:il");

    public Task<List<TkgmItem>> GetDistricts(int provinceId) =>
        GetList($"idariYapi/ilceListe/{provinceId}", $"tkgm:ilce:{provinceId}");

    public Task<List<TkgmItem>> GetNeighborhoods(int districtId) =>
        GetList($"idariYapi/mahalleListe/{districtId}", $"tkgm:mahalle:{districtId}");

    public async Task<TkgmParcel> GetParcel(int neighborhoodId, int blockNo, int parcelNo)
    {
        using var doc = await Get($"parsel/{neighborhoodId}/{blockNo}/{parcelNo}");
        return ParseParcel(doc.RootElement, neighborhoodId);
    }

    public async Task<TkgmParcel> GetParcelAt(double lat, double lon)
    {
        var la = lat.ToString(CultureInfo.InvariantCulture);
        var lo = lon.ToString(CultureInfo.InvariantCulture);
        using var doc = await Get($"parsel/{la}/{lo}/");
        return ParseParcel(doc.RootElement, null);
    }

    // ------------------------------------------------------------------ iç işler

    private async Task<List<TkgmItem>> GetList(string path, string cacheKey)
    {
        if (cache.TryGetValue(cacheKey, out List<TkgmItem>? cached) && cached is not null) return cached;

        using var doc = await Get(path);
        var list = new List<TkgmItem>();
        if (doc.RootElement.TryGetProperty("features", out var features))
        {
            foreach (var f in features.EnumerateArray())
            {
                if (!f.TryGetProperty("properties", out var p)) continue;
                var id = ReadInt(p, "id");
                var name = ReadString(p, "text") ?? ReadString(p, "ad") ?? ReadString(p, "name");
                if (id is not null && name is not null) list.Add(new TkgmItem(id.Value, name));
            }
        }
        list = list.OrderBy(i => i.Name, StringComparer.Create(new CultureInfo("tr-TR"), false)).ToList();
        cache.Set(cacheKey, list, TimeSpan.FromDays(7));
        return list;
    }

    private async Task<JsonDocument> Get(string path)
    {
        HttpResponseMessage res;
        try
        {
            res = await http.GetAsync(path);
        }
        catch (Exception e) when (e is HttpRequestException or TaskCanceledException)
        {
            log.LogWarning(e, "TKGM erişilemedi: {Path}", path);
            throw new TkgmException("TKGM servisine ulaşılamadı. İnternet bağlantısını kontrol edin ya da bilgileri elle girin.");
        }

        var body = await res.Content.ReadAsStringAsync();
        JsonDocument? doc = null;
        try { doc = JsonDocument.Parse(body); } catch (JsonException) { }

        var message = doc is not null && doc.RootElement.ValueKind == JsonValueKind.Object
            ? ReadString(doc.RootElement, "Message") ?? ReadString(doc.RootElement, "message")
            : null;

        if (!res.IsSuccessStatusCode || doc is null || message is not null)
        {
            doc?.Dispose();
            log.LogWarning("TKGM {Status} {Path}: {Body}", (int)res.StatusCode, path, body.Length > 300 ? body[..300] : body);
            throw new TkgmException(message is not null
                ? $"TKGM: {message}"
                : $"TKGM sorgusu başarısız oldu ({(int)res.StatusCode}). Bilgileri elle girebilirsiniz.");
        }
        return doc;
    }

    private static TkgmParcel ParseParcel(JsonElement root, int? neighborhoodId)
    {
        if (ReadString(root, "type") != "Feature" || !root.TryGetProperty("properties", out var p))
            throw new TkgmException("TKGM'den beklenmeyen yanıt geldi; parsel bulunamamış olabilir.");

        JsonElement? geometry = root.TryGetProperty("geometry", out var g) && g.ValueKind == JsonValueKind.Object
            ? g.Clone() : null;

        double? lat = null, lon = null;
        if (geometry is { } geo && geo.TryGetProperty("coordinates", out var coords))
        {
            // Polygon: [[[lon,lat],...]] / MultiPolygon: [[[[lon,lat],...]]] → ilk halkanın ortalaması
            var ring = coords;
            while (ring.ValueKind == JsonValueKind.Array && ring.GetArrayLength() > 0
                   && ring[0].ValueKind == JsonValueKind.Array && ring[0][0].ValueKind == JsonValueKind.Array)
                ring = ring[0];
            var pts = ring.EnumerateArray()
                .Where(c => c.ValueKind == JsonValueKind.Array && c.GetArrayLength() >= 2)
                .Select(c => (Lon: c[0].GetDouble(), Lat: c[1].GetDouble()))
                .ToList();
            if (pts.Count > 0) { lat = pts.Average(x => x.Lat); lon = pts.Average(x => x.Lon); }
        }

        return new TkgmParcel(
            ReadInt(p, "mahalleId") ?? neighborhoodId,
            ReadString(p, "ilAd") ?? "",
            ReadString(p, "ilceAd") ?? "",
            ReadString(p, "mahalleAd") ?? "",
            ReadInt(p, "adaNo") ?? 0,
            ReadInt(p, "parselNo") ?? 0,
            ParseArea(p.TryGetProperty("alan", out var a) ? a : default),
            ReadString(p, "nitelik"),
            ReadString(p, "mevkii") ?? ReadString(p, "mevki"),
            ReadString(p, "pafta"),
            geometry, lat, lon);
    }

    private static string? ReadString(JsonElement e, string name) =>
        e.ValueKind == JsonValueKind.Object && e.TryGetProperty(name, out var v)
            ? v.ValueKind switch
            {
                JsonValueKind.String => string.IsNullOrWhiteSpace(v.GetString()) ? null : v.GetString()!.Trim(),
                JsonValueKind.Number => v.GetRawText(),
                _ => null,
            }
            : null;

    private static int? ReadInt(JsonElement e, string name)
    {
        var s = ReadString(e, name);
        return int.TryParse(s, NumberStyles.Integer, CultureInfo.InvariantCulture, out var n) ? n : null;
    }

    // "4483.39", "4483,39", "4.483,39" ya da sayı
    private static decimal? ParseArea(JsonElement v)
    {
        if (v.ValueKind == JsonValueKind.Number && v.TryGetDecimal(out var d)) return d > 0 ? d : null;
        if (v.ValueKind != JsonValueKind.String) return null;
        var s = v.GetString()?.Trim() ?? "";
        if (s.Contains(',') && s.Contains('.'))
            s = s.LastIndexOf(',') > s.LastIndexOf('.') ? s.Replace(".", "").Replace(',', '.') : s.Replace(",", "");
        else if (s.Contains(','))
            s = s.Replace(',', '.');
        return decimal.TryParse(s, NumberStyles.Number, CultureInfo.InvariantCulture, out var r) && r > 0 ? r : null;
    }
}
