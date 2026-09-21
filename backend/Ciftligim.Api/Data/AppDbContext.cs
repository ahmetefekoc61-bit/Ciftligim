using Ciftligim.Api.Entities;
using Microsoft.EntityFrameworkCore;

namespace Ciftligim.Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<User>(e =>
        {
            e.HasIndex(u => u.Email).IsUnique();   // aynı e-posta iki kez kayıt olamaz
            e.HasIndex(u => u.Phone).IsUnique();
            e.Property(u => u.FullName).HasMaxLength(100);
            e.ToTable(t => t.HasCheckConstraint(
                "ck_users_email_or_phone", "email IS NOT NULL OR phone IS NOT NULL"));
        });
    }
}