using Ciftligim.Api.Auth;
using Ciftligim.Api.Data;
using Ciftligim.Api.Entities;
using Ciftligim.Api.Tkgm;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

// Bulutta (Render) dinlenecek port ortam değişkeninden gelir
if (Environment.GetEnvironmentVariable("PORT") is { Length: > 0 } port)
    builder.WebHost.UseUrls($"http://0.0.0.0:{port}");

// Veritabanı bağlantısı: yerelde user-secrets, sunucuda ortam değişkeni (ConnectionStrings__Default)
var connectionString = DatabaseUrl.Normalize(builder.Configuration.GetConnectionString("Default"));
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(connectionString)
           .UseSnakeCaseNamingConvention());

// Giriş sistemi: şifre özetleme + token üretme
builder.Services.AddScoped<IPasswordHasher<User>, PasswordHasher<User>>();
builder.Services.AddScoped<TokenService>();
builder.Services.AddScoped<FarmAccess>();   // işletme/sürü yetki kuralları

// TKGM parsel sorgusu (il/ilçe/mahalle listeleri bellekte saklanır)
builder.Services.AddMemoryCache();
builder.Services.AddHttpClient<TkgmClient>(c =>
{
    c.BaseAddress = new Uri(TkgmClient.BaseUrl);
    c.Timeout = TimeSpan.FromSeconds(20);
    c.DefaultRequestHeaders.UserAgent.ParseAdd("Ciftligim/0.2 (kisisel ciftlik kayit uygulamasi)");
    c.DefaultRequestHeaders.Accept.ParseAdd("application/json");
});

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

// Enum'lar JSON'da sayı değil metin olarak gitsin: "sex": "female", "role": "shepherd"
builder.Services.AddControllers()
    .AddJsonOptions(o => o.JsonSerializerOptions.Converters.Add(
        new JsonStringEnumConverter(JsonNamingPolicy.CamelCase)));
builder.Services.AddOpenApi();

var app = builder.Build();

// Sunucuda açılışta bekleyen migration'ları uygula (Database__MigrateOnStartup=true)
if (app.Configuration.GetValue<bool>("Database:MigrateOnStartup"))
{
    using var scope = app.Services.CreateScope();
    await scope.ServiceProvider.GetRequiredService<AppDbContext>().Database.MigrateAsync();
}

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseAuthentication();   // 1) Bu kim?
app.UseAuthorization();    // 2) Bunu yapmaya yetkisi var mı?
app.MapControllers();

// Hafif sağlık kontrolü (Render bunu sık sık çağırır; veritabanını uyandırmasın)
app.MapGet("/health", () => Results.Ok(new { durum = "çalışıyor" }));

// Sağlık kontrolü: API veritabanına ulaşabiliyor mu?
app.MapGet("/health/db", async (AppDbContext db) =>
    await db.Database.CanConnectAsync()
        ? Results.Ok(new { veritabani = "bağlı" })
        : Results.Problem("Veritabanına bağlanılamadı"));

app.Run();
