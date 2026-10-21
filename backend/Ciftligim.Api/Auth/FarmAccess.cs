using System.Security.Claims;
using Ciftligim.Api.Data;
using Ciftligim.Api.Entities;
using Microsoft.EntityFrameworkCore;

namespace Ciftligim.Api.Auth;

public static class ClaimsExtensions
{
    // Token'daki "sub" alanından giriş yapan kullanıcının Id'si
    public static Guid GetUserId(this ClaimsPrincipal user) =>
        Guid.Parse(user.FindFirst("sub")?.Value
            ?? throw new InvalidOperationException("Token'da kullanıcı kimliği yok."));
}

// Yetki kuralları tek yerde:
//   Sahip (Owner) / Yönetici (Manager): işletmedeki her şeyi görür, hayvan ekler/siler/düzenler
//   Çoban (Shepherd): yalnızca atandığı sürülerdeki hayvanları görür, hayvan ekleyemez/silemez
//   İzleyici (Viewer): her şeyi görür, hiçbir şey değiştiremez
public class FarmAccess(AppDbContext db)
{
    // Kullanıcının bu işletmedeki rolü; üye değilse null
    public Task<MemberRole?> GetRoleAsync(Guid farmId, Guid userId) =>
        db.FarmMembers
          .Where(m => m.FarmId == farmId && m.UserId == userId)
          .Select(m => (MemberRole?)m.Role)
          .FirstOrDefaultAsync();

    public static bool CanManage(MemberRole? role) =>
        role is MemberRole.Owner or MemberRole.Manager;

    // Kullanıcının görebileceği hayvanlar
    public IQueryable<Animal> VisibleAnimals(Guid farmId, Guid userId, MemberRole role)
    {
        var q = db.Animals.Where(a => a.FarmId == farmId);
        if (role == MemberRole.Shepherd)
            q = q.Where(a => db.HerdAssignments.Any(h => h.HerdId == a.HerdId && h.UserId == userId));
        return q;
    }

    // Kullanıcının görebileceği sürüler
    public IQueryable<Herd> VisibleHerds(Guid farmId, Guid userId, MemberRole role)
    {
        var q = db.Herds.Where(h => h.FarmId == farmId);
        if (role == MemberRole.Shepherd)
            q = q.Where(h => db.HerdAssignments.Any(a => a.HerdId == h.Id && a.UserId == userId));
        return q;
    }
}
