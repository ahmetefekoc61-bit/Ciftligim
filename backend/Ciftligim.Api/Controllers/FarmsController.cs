using Ciftligim.Api.Auth;
using Ciftligim.Api.Data;
using Ciftligim.Api.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Ciftligim.Api.Controllers;

public record FarmRequest(string Name);
public record FarmDto(Guid Id, string Name, MemberRole MyRole, int AnimalCount);

public record AddMemberRequest(string Login, MemberRole Role);   // Login = e-posta ya da telefon
public record ChangeRoleRequest(MemberRole Role);
public record MemberDto(Guid UserId, string FullName, string? Email, string? Phone, MemberRole Role, DateTimeOffset JoinedAt);

[ApiController]
[Authorize]
[Route("api/farms")]
public class FarmsController(AppDbContext db, FarmAccess access, IPasswordHasher<User> hasher) : ControllerBase
{
    // GET /api/farms  → üye olduğum işletmeler
    [HttpGet]
    public async Task<List<FarmDto>> MyFarms()
    {
        var me = User.GetUserId();
        return await db.FarmMembers
            .Where(m => m.UserId == me)
            .Join(db.Farms, m => m.FarmId, f => f.Id, (m, f) => new { f, m.Role })
            .OrderBy(x => x.f.Name)
            .Select(x => new FarmDto(x.f.Id, x.f.Name, x.Role,
                db.Animals.Count(a => a.FarmId == x.f.Id && a.Status == AnimalStatus.Active)))
            .ToListAsync();
    }

    // POST /api/farms  → yeni işletme; oluşturan kişi otomatik "sahip" olur
    [HttpPost]
    public async Task<ActionResult<FarmDto>> Create(FarmRequest req)
    {
        var name = req.Name.Trim();
        if (name.Length is < 2 or > 100)
            return BadRequest(new { hata = "İşletme adı 2-100 karakter olmalı." });

        var me = User.GetUserId();
        var farm = new Farm { Name = name, CreatedById = me };
        db.Farms.Add(farm);
        db.FarmMembers.Add(new FarmMember { FarmId = farm.Id, UserId = me, Role = MemberRole.Owner });
        await db.SaveChangesAsync();

        return new FarmDto(farm.Id, farm.Name, MemberRole.Owner, 0);
    }

    // PUT /api/farms/{farmId}  → işletme adını değiştir (yalnızca sahip)
    [HttpPut("{farmId:guid}")]
    public async Task<IActionResult> Rename(Guid farmId, FarmRequest req)
    {
        var role = await access.GetRoleAsync(farmId, User.GetUserId());
        if (role is null) return NotFound(new { hata = "İşletme bulunamadı." });
        if (role != MemberRole.Owner) return Forbidden("Bunu yalnızca işletme sahibi yapabilir.");

        var name = req.Name.Trim();
        if (name.Length is < 2 or > 100)
            return BadRequest(new { hata = "İşletme adı 2-100 karakter olmalı." });

        var farm = await db.Farms.FindAsync(farmId);
        farm!.Name = name;
        await db.SaveChangesAsync();
        return NoContent();
    }

    // GET /api/farms/{farmId}/members  → işletme üyeleri
    [HttpGet("{farmId:guid}/members")]
    public async Task<ActionResult<List<MemberDto>>> Members(Guid farmId)
    {
        var role = await access.GetRoleAsync(farmId, User.GetUserId());
        if (role is null) return NotFound(new { hata = "İşletme bulunamadı." });

        return await db.FarmMembers
            .Where(m => m.FarmId == farmId)
            .OrderBy(m => m.Role == MemberRole.Owner ? 0 : m.Role == MemberRole.Manager ? 1 : m.Role == MemberRole.Shepherd ? 2 : 3)
            .ThenBy(m => m.User.FullName)
            .Select(m => new MemberDto(m.UserId, m.User.FullName, m.User.Email, m.User.Phone, m.Role, m.JoinedAt))
            .ToListAsync();
    }

    // POST /api/farms/{farmId}/members  → kayıtlı bir kullanıcıyı işletmeye ekle
    //   Sahip: yönetici, çoban, izleyici ekleyebilir
    //   Yönetici: çoban ve izleyici ekleyebilir
    [HttpPost("{farmId:guid}/members")]
    public async Task<ActionResult<MemberDto>> AddMember(Guid farmId, AddMemberRequest req)
    {
        var me = User.GetUserId();
        var myRole = await access.GetRoleAsync(farmId, me);
        if (myRole is null) return NotFound(new { hata = "İşletme bulunamadı." });
        if (!CanAssignRole(myRole.Value, req.Role))
            return Forbidden("Bu rolde üye eklemeye yetkiniz yok.");

        var login = req.Login.Trim();
        var email = login.ToLowerInvariant();
        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == email || u.Phone == login);
        if (user is null)
            return NotFound(new { hata = "Bu e-posta/telefonla kayıtlı kullanıcı yok. Önce uygulamaya kayıt olmalı." });

        if (await db.FarmMembers.AnyAsync(m => m.FarmId == farmId && m.UserId == user.Id))
            return Conflict(new { hata = "Bu kişi zaten işletmede." });

        var member = new FarmMember { FarmId = farmId, UserId = user.Id, Role = req.Role, InvitedById = me };
        db.FarmMembers.Add(member);
        await db.SaveChangesAsync();

        return new MemberDto(user.Id, user.FullName, user.Email, user.Phone, member.Role, member.JoinedAt);
    }

    // PUT /api/farms/{farmId}/members/{userId}  → üyenin rolünü değiştir
    [HttpPut("{farmId:guid}/members/{userId:guid}")]
    public async Task<IActionResult> ChangeRole(Guid farmId, Guid userId, ChangeRoleRequest req)
    {
        var me = User.GetUserId();
        var myRole = await access.GetRoleAsync(farmId, me);
        if (myRole is null) return NotFound(new { hata = "İşletme bulunamadı." });
        if (userId == me) return BadRequest(new { hata = "Kendi rolünüzü değiştiremezsiniz." });

        var member = await db.FarmMembers.FindAsync(farmId, userId);
        if (member is null) return NotFound(new { hata = "Üye bulunamadı." });

        // Hem eski hem yeni rol üzerinde yetkili olmalı (yönetici, başka yöneticiyi düşüremez)
        if (!CanAssignRole(myRole.Value, member.Role) || !CanAssignRole(myRole.Value, req.Role))
            return Forbidden("Bu değişikliği yapmaya yetkiniz yok.");

        // Artık çoban değilse sürü atamaları kalkar
        if (member.Role == MemberRole.Shepherd && req.Role != MemberRole.Shepherd)
            await RemoveHerdAssignments(farmId, userId);

        member.Role = req.Role;
        await db.SaveChangesAsync();
        return NoContent();
    }

    // DELETE /api/farms/{farmId}/members/{userId}  → üyeyi işletmeden çıkar
    [HttpDelete("{farmId:guid}/members/{userId:guid}")]
    public async Task<IActionResult> RemoveMember(Guid farmId, Guid userId)
    {
        var me = User.GetUserId();
        var myRole = await access.GetRoleAsync(farmId, me);
        if (myRole is null) return NotFound(new { hata = "İşletme bulunamadı." });

        var member = await db.FarmMembers.FindAsync(farmId, userId);
        if (member is null) return NotFound(new { hata = "Üye bulunamadı." });
        if (member.Role == MemberRole.Owner) return BadRequest(new { hata = "İşletme sahibi çıkarılamaz." });

        // Kişi kendi isteğiyle ayrılabilir; başkasını çıkarmak için o rol üzerinde yetki gerekir
        if (userId != me && !CanAssignRole(myRole.Value, member.Role))
            return Forbidden("Bu üyeyi çıkarmaya yetkiniz yok.");

        await RemoveHerdAssignments(farmId, userId);
        db.FarmMembers.Remove(member);
        await db.SaveChangesAsync();
        return NoContent();
    }

    // POST /api/farms/{farmId}/members/{userId}/reset-password  → üyeye geçici şifre verir
    //   Güvenlik: yalnızca o rol üzerinde yetkili olan sahip/yönetici yapabilir; hedef kişi başka
    //   bir işletmenin sahibi ya da senin sahibi olmadığın başka bir işletmenin üyesiyse izin verilmez.
    [HttpPost("{farmId:guid}/members/{userId:guid}/reset-password")]
    public async Task<IActionResult> ResetMemberPassword(Guid farmId, Guid userId)
    {
        var me = User.GetUserId();
        var myRole = await access.GetRoleAsync(farmId, me);
        if (myRole is null) return NotFound(new { hata = "İşletme bulunamadı." });
        if (userId == me) return BadRequest(new { hata = "Kendi şifreni 'Şifremi değiştir' ekranından değiştir." });

        var member = await db.FarmMembers.FindAsync(farmId, userId);
        if (member is null) return NotFound(new { hata = "Üye bulunamadı." });
        if (!CanAssignRole(myRole.Value, member.Role))
            return Forbidden("Bu üyenin şifresini sıfırlamaya yetkiniz yok.");

        var otherMemberships = await db.FarmMembers
            .Where(m => m.UserId == userId && m.FarmId != farmId)
            .Select(m => new
            {
                m.Role,
                IOwnIt = db.FarmMembers.Any(x => x.FarmId == m.FarmId && x.UserId == me && x.Role == MemberRole.Owner),
            })
            .ToListAsync();
        if (otherMemberships.Any(o => o.Role == MemberRole.Owner || !o.IOwnIt))
            return Forbidden("Bu kişi başka işletmelerde de üye; şifresini yalnızca kendisi 'Şifremi unuttum' ile yenileyebilir.");

        var user = await db.Users.FindAsync(userId);
        if (user is null) return NotFound(new { hata = "Kullanıcı bulunamadı." });

        var temp = System.Security.Cryptography.RandomNumberGenerator.GetString("abcdefghjkmnpqrstuvwxyz23456789", 8);
        user.PasswordHash = hasher.HashPassword(user, temp);
        await db.SaveChangesAsync();
        return Ok(new { geciciSifre = temp });
    }

    // Kim hangi rolü verebilir? Sahiplik devri şimdilik yok.
    private static bool CanAssignRole(MemberRole myRole, MemberRole target) => (myRole, target) switch
    {
        (_, MemberRole.Owner) => false,
        (MemberRole.Owner, _) => true,
        (MemberRole.Manager, MemberRole.Shepherd or MemberRole.Viewer) => true,
        _ => false,
    };

    private async Task RemoveHerdAssignments(Guid farmId, Guid userId)
    {
        var assignments = await db.HerdAssignments
            .Where(a => a.UserId == userId && db.Herds.Any(h => h.Id == a.HerdId && h.FarmId == farmId))
            .ToListAsync();
        db.HerdAssignments.RemoveRange(assignments);
    }

    private ObjectResult Forbidden(string message) =>
        StatusCode(StatusCodes.Status403Forbidden, new { hata = message });
}
