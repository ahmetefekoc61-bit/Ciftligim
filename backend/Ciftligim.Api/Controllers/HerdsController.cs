using Ciftligim.Api.Auth;
using Ciftligim.Api.Data;
using Ciftligim.Api.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Ciftligim.Api.Controllers;

public record HerdRequest(string Name, string? Notes);
public record ShepherdDto(Guid UserId, string FullName);
public record HerdDto(Guid Id, string Name, string? Notes, int AnimalCount, List<ShepherdDto> Shepherds);
public record AssignShepherdRequest(Guid UserId);

[ApiController]
[Authorize]
[Route("api/farms/{farmId:guid}/herds")]
public class HerdsController(AppDbContext db, FarmAccess access) : ControllerBase
{
    // GET /api/farms/{farmId}/herds  → sürüler (çoban yalnızca kendi sürülerini görür)
    [HttpGet]
    public async Task<ActionResult<List<HerdDto>>> GetAll(Guid farmId)
    {
        var me = User.GetUserId();
        var role = await access.GetRoleAsync(farmId, me);
        if (role is null) return NotFound(new { hata = "İşletme bulunamadı." });

        return await access.VisibleHerds(farmId, me, role.Value)
            .OrderBy(h => h.Name)
            .Select(h => new HerdDto(
                h.Id, h.Name, h.Notes,
                db.Animals.Count(a => a.HerdId == h.Id && a.Status == AnimalStatus.Active),
                db.HerdAssignments
                  .Where(x => x.HerdId == h.Id)
                  .Select(x => new ShepherdDto(x.UserId, x.User.FullName))
                  .ToList()))
            .ToListAsync();
    }

    // POST /api/farms/{farmId}/herds  → yeni sürü (sahip / yönetici)
    [HttpPost]
    public async Task<ActionResult<HerdDto>> Create(Guid farmId, HerdRequest req)
    {
        var role = await access.GetRoleAsync(farmId, User.GetUserId());
        if (role is null) return NotFound(new { hata = "İşletme bulunamadı." });
        if (!FarmAccess.CanManage(role)) return Forbidden("Sürü eklemeye yetkiniz yok.");

        var name = req.Name.Trim();
        if (name.Length is < 1 or > 100) return BadRequest(new { hata = "Sürü adı 1-100 karakter olmalı." });
        if (await db.Herds.AnyAsync(h => h.FarmId == farmId && h.Name == name))
            return Conflict(new { hata = "Bu adda bir sürü zaten var." });

        var herd = new Herd { FarmId = farmId, Name = name, Notes = Clean(req.Notes) };
        db.Herds.Add(herd);
        await db.SaveChangesAsync();
        return new HerdDto(herd.Id, herd.Name, herd.Notes, 0, []);
    }

    // PUT /api/farms/{farmId}/herds/{herdId}  → adı / notu değiştir
    [HttpPut("{herdId:guid}")]
    public async Task<IActionResult> Update(Guid farmId, Guid herdId, HerdRequest req)
    {
        var role = await access.GetRoleAsync(farmId, User.GetUserId());
        if (role is null) return NotFound(new { hata = "İşletme bulunamadı." });
        if (!FarmAccess.CanManage(role)) return Forbidden("Sürüyü düzenlemeye yetkiniz yok.");

        var herd = await db.Herds.FirstOrDefaultAsync(h => h.Id == herdId && h.FarmId == farmId);
        if (herd is null) return NotFound(new { hata = "Sürü bulunamadı." });

        var name = req.Name.Trim();
        if (name.Length is < 1 or > 100) return BadRequest(new { hata = "Sürü adı 1-100 karakter olmalı." });
        if (await db.Herds.AnyAsync(h => h.FarmId == farmId && h.Name == name && h.Id != herdId))
            return Conflict(new { hata = "Bu adda bir sürü zaten var." });

        herd.Name = name;
        herd.Notes = Clean(req.Notes);
        await db.SaveChangesAsync();
        return NoContent();
    }

    // DELETE /api/farms/{farmId}/herds/{herdId}  → sürüyü sil; hayvanlar silinmez, sürüsüz kalır
    [HttpDelete("{herdId:guid}")]
    public async Task<IActionResult> Delete(Guid farmId, Guid herdId)
    {
        var role = await access.GetRoleAsync(farmId, User.GetUserId());
        if (role is null) return NotFound(new { hata = "İşletme bulunamadı." });
        if (!FarmAccess.CanManage(role)) return Forbidden("Sürüyü silmeye yetkiniz yok.");

        var herd = await db.Herds.FirstOrDefaultAsync(h => h.Id == herdId && h.FarmId == farmId);
        if (herd is null) return NotFound(new { hata = "Sürü bulunamadı." });

        db.Herds.Remove(herd);
        await db.SaveChangesAsync();
        return NoContent();
    }

    // POST /api/farms/{farmId}/herds/{herdId}/shepherds  → sürüye çoban ata
    [HttpPost("{herdId:guid}/shepherds")]
    public async Task<IActionResult> AssignShepherd(Guid farmId, Guid herdId, AssignShepherdRequest req)
    {
        var me = User.GetUserId();
        var role = await access.GetRoleAsync(farmId, me);
        if (role is null) return NotFound(new { hata = "İşletme bulunamadı." });
        if (!FarmAccess.CanManage(role)) return Forbidden("Çoban atamaya yetkiniz yok.");

        if (!await db.Herds.AnyAsync(h => h.Id == herdId && h.FarmId == farmId))
            return NotFound(new { hata = "Sürü bulunamadı." });

        var targetRole = await access.GetRoleAsync(farmId, req.UserId);
        if (targetRole != MemberRole.Shepherd)
            return BadRequest(new { hata = "Bu kişi işletmede çoban rolünde değil. Önce çoban olarak ekleyin." });

        if (await db.HerdAssignments.AnyAsync(a => a.HerdId == herdId && a.UserId == req.UserId))
            return Conflict(new { hata = "Bu çoban zaten bu sürüye atanmış." });

        db.HerdAssignments.Add(new HerdAssignment { HerdId = herdId, UserId = req.UserId, AssignedById = me });
        await db.SaveChangesAsync();
        return NoContent();
    }

    // DELETE /api/farms/{farmId}/herds/{herdId}/shepherds/{userId}  → çobanı sürüden al
    [HttpDelete("{herdId:guid}/shepherds/{userId:guid}")]
    public async Task<IActionResult> UnassignShepherd(Guid farmId, Guid herdId, Guid userId)
    {
        var role = await access.GetRoleAsync(farmId, User.GetUserId());
        if (role is null) return NotFound(new { hata = "İşletme bulunamadı." });
        if (!FarmAccess.CanManage(role)) return Forbidden("Çoban atamasını kaldırmaya yetkiniz yok.");

        var assignment = await db.HerdAssignments
            .FirstOrDefaultAsync(a => a.HerdId == herdId && a.UserId == userId
                                   && db.Herds.Any(h => h.Id == herdId && h.FarmId == farmId));
        if (assignment is null) return NotFound(new { hata = "Atama bulunamadı." });

        db.HerdAssignments.Remove(assignment);
        await db.SaveChangesAsync();
        return NoContent();
    }

    private static string? Clean(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();

    private ObjectResult Forbidden(string message) =>
        StatusCode(StatusCodes.Status403Forbidden, new { hata = message });
}
