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

[ApiController]
[Route("api/auth")]
public class AuthController(AppDbContext db, IPasswordHasher<User> hasher, TokenService tokens)
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
