using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using Ciftligim.Api.Entities;
using Microsoft.Extensions.Caching.Memory;

namespace Ciftligim.Api.Auth;

// Şifre sıfırlama kodu: veritabanında saklanmaz.
// Kod = HMAC(gizli anahtar, kullanıcı + mevcut şifre özeti + 15 dakikalık zaman dilimi) → 6 hane.
// Şifre değişince eski kodlar kendiliğinden geçersiz olur; kod en fazla ~30 dakika geçerlidir.
public class PasswordResetService(IConfiguration config, IMemoryCache cache)
{
    private const long WindowSeconds = 15 * 60;
    private const int MaxAttempts = 5;

    private static long Bucket(DateTimeOffset t) => t.ToUnixTimeSeconds() / WindowSeconds;

    private string Code(User user, long bucket)
    {
        var key = JwtSettings.GetKey(config).Key;
        using var hmac = new HMACSHA256(key);
        var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes($"sifre-sifirlama|{user.Id}|{user.PasswordHash}|{bucket}"));
        var number = BitConverter.ToUInt32(hash, 0) % 1_000_000;
        return number.ToString("D6");
    }

    public string CreateCode(User user) => Code(user, Bucket(DateTimeOffset.UtcNow));

    // Aynı kullanıcıya en fazla dakikada bir kod gönderilsin
    public bool CanSend(User user)
    {
        var k = $"sifre-gonder:{user.Id}";
        if (cache.TryGetValue(k, out _)) return false;
        cache.Set(k, true, TimeSpan.FromSeconds(60));
        return true;
    }

    public bool TooManyAttempts(User user) =>
        cache.TryGetValue($"sifre-deneme:{user.Id}", out int n) && n >= MaxAttempts;

    public bool Verify(User user, string code)
    {
        var attemptsKey = $"sifre-deneme:{user.Id}";
        cache.TryGetValue(attemptsKey, out int attempts);
        if (attempts >= MaxAttempts) return false;

        var given = Encoding.ASCII.GetBytes((code ?? "").Trim());
        var now = Bucket(DateTimeOffset.UtcNow);
        foreach (var b in new[] { now, now - 1 })
        {
            if (CryptographicOperations.FixedTimeEquals(given, Encoding.ASCII.GetBytes(Code(user, b))))
            {
                cache.Remove(attemptsKey);
                return true;
            }
        }
        cache.Set(attemptsKey, attempts + 1, TimeSpan.FromMinutes(30));
        return false;
    }
}

// E-posta gönderimi: Brevo (ücretsiz plan günde 300 e-posta).
// Ayarlar ortam değişkeninden: Email__BrevoApiKey, Email__From (Brevo'da doğrulanmış gönderen adresi), Email__FromName
public class EmailSender(HttpClient http, IConfiguration config, ILogger<EmailSender> log)
{
    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(config["Email:BrevoApiKey"]) && !string.IsNullOrWhiteSpace(config["Email:From"]);

    public async Task SendAsync(string to, string toName, string subject, string html, CancellationToken ct = default)
    {
        using var req = new HttpRequestMessage(HttpMethod.Post, "https://api.brevo.com/v3/smtp/email");
        req.Headers.Add("api-key", config["Email:BrevoApiKey"]);
        req.Headers.Accept.ParseAdd("application/json");
        req.Content = JsonContent.Create(new
        {
            sender = new { name = config["Email:FromName"] ?? "Çiftliğim", email = config["Email:From"] },
            to = new[] { new { email = to, name = toName } },
            subject,
            htmlContent = html,
        });

        using var res = await http.SendAsync(req, ct);
        if (!res.IsSuccessStatusCode)
        {
            var body = await res.Content.ReadAsStringAsync(ct);
            log.LogWarning("Brevo e-posta hatası {Status}: {Body}", (int)res.StatusCode, body);
            throw new InvalidOperationException("E-posta gönderilemedi.");
        }
    }
}
