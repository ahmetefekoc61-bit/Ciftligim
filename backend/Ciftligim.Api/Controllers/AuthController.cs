using Ciftligim.Api.Auth;
using Ciftligim.Api.Data;
using Ciftligim.Api.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Ciftligim.Api.Controllers;

// Telefondan gelen veri kalıpları
public record RegisterRequest(string FullName, string? Email, string? Phone, string Password);
public record LoginRequest(string Login, string Password);   // Login = e-posta ya da telefon
public record AuthResponse(string Token, Guid UserId, string FullName);
public record ForgotPasswordRequest(string Email);
public record ResetPasswordRequest(string Email, string Code, string NewPassword);

[ApiController]
[Route("api/auth")]
public class AuthController(AppDbContext db, IPasswordHasher<User> hasher, TokenService tokens,
    PasswordResetService resets, EmailSender mailer)
    : ControllerBase
{
    // POST /api/auth/register  → yeni kullanıcı oluşturur
    [HttpPost("register")]
    public async Task<ActionResult<AuthResponse>> Register(RegisterRequest req)
    {
        var fullName = req.FullName.Trim();
        var email = Clean(req.Email)?.ToLowerInvariant();
        var phone = Clean(req.Phone);

        if (fullName.Length is < 2 or > 100)
            return BadRequest(new { hata = "Ad soyad 2-100 karakter olmalı." });
        if (email is null && phone is null)
            return BadRequest(new { hata = "E-posta ya da telefon numarası gerekli." });
        if (req.Password.Length < 8)
            return BadRequest(new { hata = "Şifre en az 8 karakter olmalı." });

        var exists = await db.Users.AnyAsync(u =>
            (email != null && u.Email == email) || (phone != null && u.Phone == phone));
        if (exists)
            return Conflict(new { hata = "Bu e-posta ya da telefon zaten kayıtlı." });

        var user = new User { FullName = fullName, Email = email, Phone = phone };
        user.PasswordHash = hasher.HashPassword(user, req.Password);   // şifre asla düz saklanmaz

        db.Users.Add(user);
        await db.SaveChangesAsync();

        return new AuthResponse(tokens.Create(user), user.Id, user.FullName);
    }

    // POST /api/auth/login  → doğru bilgilerle token döner
    [HttpPost("login")]
    public async Task<ActionResult<AuthResponse>> Login(LoginRequest req)
    {
        var login = req.Login.Trim();
        var email = login.ToLowerInvariant();

        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == email || u.Phone == login);

        // Kullanıcı yok mu, şifre mi yanlış? Güvenlik için ikisine aynı cevabı veriyoruz.
        if (user is null ||
            hasher.VerifyHashedPassword(user, user.PasswordHash, req.Password) == PasswordVerificationResult.Failed)
            return Unauthorized(new { hata = "E-posta/telefon ya da şifre hatalı." });

        return new AuthResponse(tokens.Create(user), user.Id, user.FullName);
    }

    // POST /api/auth/forgot  → e-postaya 6 haneli şifre yenileme kodu gönderir
    [HttpPost("forgot")]
    public async Task<IActionResult> Forgot(ForgotPasswordRequest req, CancellationToken ct)
    {
        var mail = Clean(req.Email)?.ToLowerInvariant();
        if (mail is null || !mail.Contains('@'))
            return BadRequest(new { hata = "Geçerli bir e-posta adresi girin." });
        if (!mailer.IsConfigured)
            return StatusCode(503, new { hata = "E-posta gönderimi henüz ayarlanmadı. Uygulama yöneticisine başvurun." });

        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == mail, ct);
        // Kayıtlı olup olmadığını belli etmemek için her durumda aynı cevap
        const string ok = "Bu e-posta kayıtlıysa birkaç dakika içinde kod gelecek. Spam klasörünü de kontrol et.";
        if (user is null) return Ok(new { mesaj = ok });
        if (!resets.CanSend(user))
            return StatusCode(429, new { hata = "Kod az önce gönderildi. 1 dakika sonra tekrar dene." });

        var code = resets.CreateCode(user);
        var name = System.Net.WebUtility.HtmlEncode(user.FullName);
        var html =
            "<div style=\"font-family:Arial,sans-serif;max-width:420px;margin:auto;color:#1F2A1F\">" +
            "<h2 style=\"color:#2F6B3A;margin-bottom:4px\">Çiftliğim</h2>" +
            $"<p>Merhaba {name},</p><p>Şifreni yenilemek için kodun:</p>" +
            $"<p style=\"font-size:32px;font-weight:bold;letter-spacing:8px;background:#F4F1EA;padding:12px 16px;border-radius:10px;text-align:center\">{code}</p>" +
            "<p>Kod 15 dakika geçerli. Bu isteği sen yapmadıysan bu e-postayı yok sayabilirsin.</p>" +
            "<p style=\"color:#9AA096;font-size:12px\">AEK Software</p></div>";
        try
        {
            await mailer.SendAsync(user.Email!, user.FullName, $"Çiftliğim şifre yenileme kodu: {code}", html, ct);
        }
        catch (Exception)
        {
            return StatusCode(502, new { hata = "E-posta şu an gönderilemedi. Biraz sonra tekrar dene." });
        }
        return Ok(new { mesaj = ok });
    }

    // POST /api/auth/reset  → kod doğruysa yeni şifreyi kaydeder ve giriş yapar
    [HttpPost("reset")]
    public async Task<ActionResult<AuthResponse>> Reset(ResetPasswordRequest req, CancellationToken ct)
    {
        var mail = Clean(req.Email)?.ToLowerInvariant();
        if (req.NewPassword is null || req.NewPassword.Length < 8)
            return BadRequest(new { hata = "Yeni şifre en az 8 karakter olmalı." });

        var user = mail is null ? null : await db.Users.FirstOrDefaultAsync(u => u.Email == mail, ct);
        if (user is null)
            return BadRequest(new { hata = "Kod hatalı ya da süresi dolmuş." });
        if (resets.TooManyAttempts(user))
            return StatusCode(429, new { hata = "Çok fazla hatalı deneme. 30 dakika sonra yeni kod iste." });
        if (!resets.Verify(user, req.Code))
            return BadRequest(new { hata = "Kod hatalı ya da süresi dolmuş." });

        user.PasswordHash = hasher.HashPassword(user, req.NewPassword);
        await db.SaveChangesAsync(ct);
        return new AuthResponse(tokens.Create(user), user.Id, user.FullName);
    }

    // GET /api/auth/me  → token'ı gönderen kullanıcının bilgileri (giriş zorunlu)
    [Authorize]
    [HttpGet("me")]
    public async Task<IActionResult> Me()
    {
        var sub = User.FindFirst("sub")?.Value;
        if (!Guid.TryParse(sub, out var userId)) return Unauthorized();

        var user = await db.Users.FindAsync(userId);
        if (user is null) return Unauthorized();

        return Ok(new { user.Id, user.FullName, user.Email, user.Phone, user.CreatedAt });
    }

    private static string? Clean(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();
}
