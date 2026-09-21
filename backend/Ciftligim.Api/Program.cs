using Ciftligim.Api.Data;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// Veritabanı bağlantısı (şifre user-secrets'tan gelir)
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("Default")));

builder.Services.AddControllers();
builder.Services.AddOpenApi();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseAuthorization();
app.MapControllers();

// Sağlık kontrolü: API veritabanına ulaşabiliyor mu?
app.MapGet("/health/db", async (AppDbContext db) =>
    await db.Database.CanConnectAsync()
        ? Results.Ok(new { veritabani = "bağlı" })
        : Results.Problem("Veritabanına bağlanılamadı"));

app.Run();