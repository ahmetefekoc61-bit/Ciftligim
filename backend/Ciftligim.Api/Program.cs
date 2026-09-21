using Ciftligim.Api.Auth;
using Ciftligim.Api.Data;
using Ciftligim.Api.Entities;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

// Veritabanı bağlantısı (şifre user-secrets'tan gelir)
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("Default"))
           .UseSnakeCaseNamingConvention());

// Giriş sistemi: şifre özetleme + token üretme
builder.Services.AddScoped<IPasswordHasher<User>, PasswordHasher<User>>();
builder.Services.AddScoped<TokenService>();

// Gelen isteklerdeki token'ı doğrulama
builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.MapInboundClaims = false;   // "sub" gibi alan adlarını olduğu gibi bırak
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidIssuer = JwtSettings.Issuer,
            ValidAudience = JwtSettings.Audience,
            IssuerSigningKey = JwtSettings.GetKey(builder.Configuration),
            NameClaimType = "name",
        };
    });
builder.Services.AddAuthorization();

builder.Services.AddControllers();
builder.Services.AddOpenApi();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseAuthentication();   // 1) Bu kim?
app.UseAuthorization();    // 2) Bunu yapmaya yetkisi var mı?
app.MapControllers();

// Sağlık kontrolü: API veritabanına ulaşabiliyor mu?
app.MapGet("/health/db", async (AppDbContext db) =>
    await db.Database.CanConnectAsync()
        ? Results.Ok(new { veritabani = "bağlı" })
        : Results.Problem("Veritabanına bağlanılamadı"));

app.Run();
