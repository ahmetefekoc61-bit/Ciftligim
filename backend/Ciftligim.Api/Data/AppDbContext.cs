using Microsoft.EntityFrameworkCore;

namespace Ciftligim.Api.Data;

// Veritabanıyla konuşan köprü. Tablolar ileride buraya eklenecek.
public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
}