using System.Security.Claims;
using Ciftligim.Api.Entities;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace Ciftligim.Api.Auth;

// JWT ayarları: token'ı kim üretti (Issuer), kimin için (Audience)
public static class JwtSettings
{
    public const string Issuer = "ciftligim-api";
    public const string Audience = "ciftligim-mobile";

    // İmza anahtarı "Jwt:Key" ayarından okunur (yerelde user-secrets, sunucuda ortam değişkeni).
    // Base64 değilse ya da kısaysa metnin SHA-256 özeti kullanılır; böylece her türlü uzun rastgele metin çalışır.
    public static SymmetricSecurityKey GetKey(IConfiguration config)
    {
        var key = config["Jwt:Key"]
            ?? throw new InvalidOperationException("Jwt:Key ayarı bulunamadı. user-secrets ya da ortam değişkeni ile ekleyin.");
        byte[] bytes;
        try { bytes = Convert.FromBase64String(key); }
        catch (FormatException) { bytes = []; }
        if (bytes.Length < 32)
            bytes = System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(key));
        return new SymmetricSecurityKey(bytes);
    }
}

// Giriş yapan kullanıcıya "kimlik kartı" (JWT token) üretir
public class TokenService(IConfiguration config)
{
    public string Create(User user)
    {
        var descriptor = new SecurityTokenDescriptor
        {
            Issuer = JwtSettings.Issuer,
            Audience = JwtSettings.Audience,
            Expires = DateTime.UtcNow.AddDays(7),   // 7 gün geçerli
            Subject = new ClaimsIdentity(new[]
            {
                new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
                new Claim(JwtRegisteredClaimNames.Name, user.FullName),
            }),
            SigningCredentials = new SigningCredentials(
                JwtSettings.GetKey(config), SecurityAlgorithms.HmacSha256),
        };
        return new JsonWebTokenHandler().CreateToken(descriptor);
    }
}
