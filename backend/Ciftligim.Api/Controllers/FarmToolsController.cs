using Ciftligim.Api.Auth;
using Ciftligim.Api.Common;
using Ciftligim.Api.Data;
using Ciftligim.Api.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Ciftligim.Api.Controllers;

public record MedicineRequest(string Name, string? ActiveIngredient, string? DefaultUnit,
                              int? MeatWithdrawalDays, int? MilkWithdrawalDays, string? Notes);
public record MedicineDto(Guid Id, string Name, string? ActiveIngredient, string DefaultUnit,
                          int? MeatWithdrawalDays, int? MilkWithdrawalDays, string? Notes, bool IsShared);

// Sürüye ya da seçilen hayvanlara toplu uygulama
public record BatchTreatmentRequest(Guid? HerdId, List<Guid>? AnimalIds, TreatmentRequest Treatment);
public record HerdLocationRequest(AnimalLocation Location, string? Notes);

public record WithdrawalDto(Guid AnimalId, string? EarTag, string? Name, string SpeciesName,
                            DateOnly? MeatBlockedUntil, DateOnly? MilkBlockedUntil);
public record SpeciesCountDto(short SpeciesId, string SpeciesName, int Count);
public record RecentBirthDto(Guid MotherId, string? MotherEarTag, string? MotherName, DateOnly BirthDate, short OffspringCount);
public record FarmSummaryDto(int ActiveAnimals, List<SpeciesCountDto> BySpecies, int HerdCount,
                             int InWithdrawal, int BirthsLast30Days, List<RecentBirthDto> RecentBirths);

[ApiController]
[Authorize]
[Route("api/farms/{farmId:guid}")]
public class FarmToolsController(AppDbContext db, FarmAccess access) : ControllerBase
{
    // ---------------------------------------------------------------- Özet (ana ekran)
    // GET /api/farms/{farmId}/summary
    [HttpGet("summary")]
    public async Task<ActionResult<FarmSummaryDto>> Summary(Guid farmId)
    {
        var me = User.GetUserId();
        var role = await access.GetRoleAsync(farmId, me);
        if (role is null) return NotFound(new { hata = "İşletme bulunamadı." });

        var today = Clock.Today();
        var monthAgo = today.AddDays(-30);
        var animals = access.VisibleAnimals(farmId, me, role.Value).Where(a => a.Status == AnimalStatus.Active);

        var bySpecies = await animals
            .GroupBy(a => new { a.SpeciesId, a.Species.Name })
            .Select(g => new SpeciesCountDto(g.Key.SpeciesId, g.Key.Name, g.Count()))
            .ToListAsync();

        var inWithdrawal = await animals.CountAsync(a => db.Treatments.Any(t => t.AnimalId == a.Id &&
            (t.MeatWithdrawalUntil >= today || t.MilkWithdrawalUntil >= today)));

        var recentBirths = await db.BirthEvents
            .Where(b => b.BirthDate >= monthAgo && animals.Any(a => a.Id == b.MotherId))
            .OrderByDescending(b => b.BirthDate)
            .Take(10)
            .Join(db.Animals, b => b.MotherId, a => a.Id,
                  (b, a) => new RecentBirthDto(a.Id, a.EarTag, a.Name, b.BirthDate, b.OffspringCount))
            .ToListAsync();

        var birthCount = await db.BirthEvents
            .CountAsync(b => b.BirthDate >= monthAgo && animals.Any(a => a.Id == b.MotherId));

        var herdCount = await access.VisibleHerds(farmId, me, role.Value).CountAsync();

        return new FarmSummaryDto(bySpecies.Sum(s => s.Count), bySpecies.OrderBy(s => s.SpeciesId).ToList(),
                                  herdCount, inWithdrawal, birthCount, recentBirths);
    }

    // ---------------------------------------------------------------- Arınma listesi
    // GET /api/farms/{farmId}/withdrawals  → eti/sütü henüz kullanılamayacak hayvanlar
    [HttpGet("withdrawals")]
    public async Task<ActionResult<List<WithdrawalDto>>> Withdrawals(Guid farmId)
    {
        var me = User.GetUserId();
        var role = await access.GetRoleAsync(farmId, me);
        if (role is null) return NotFound(new { hata = "İşletme bulunamadı." });

        var today = Clock.Today();
        var rows = await access.VisibleAnimals(farmId, me, role.Value)
            .Where(a => a.Status == AnimalStatus.Active)
            .Select(a => new
            {
                a.Id, a.EarTag, a.Name, SpeciesName = a.Species.Name,
                Meat = db.Treatments.Where(t => t.AnimalId == a.Id && t.MeatWithdrawalUntil >= today)
                                    .Max(t => t.MeatWithdrawalUntil),
                Milk = db.Treatments.Where(t => t.AnimalId == a.Id && t.MilkWithdrawalUntil >= today)
                                    .Max(t => t.MilkWithdrawalUntil),
            })
            .Where(x => x.Meat != null || x.Milk != null)
            .ToListAsync();

        return rows
            .OrderByDescending(x => x.Meat > x.Milk ? x.Meat : x.Milk ?? x.Meat)
            .Select(x => new WithdrawalDto(x.Id, x.EarTag, x.Name, x.SpeciesName, x.Meat, x.Milk))
            .ToList();
    }

    // ---------------------------------------------------------------- İlaç kataloğu
    // GET /api/farms/{farmId}/medicines  → ortak katalog + işletmenin kendi ilaçları
    [HttpGet("medicines")]
    public async Task<ActionResult<List<MedicineDto>>> Medicines(Guid farmId)
    {
        var role = await access.GetRoleAsync(farmId, User.GetUserId());
        if (role is null) return NotFound(new { hata = "İşletme bulunamadı." });

        return await db.Medicines
            .Where(m => m.FarmId == null || m.FarmId == farmId)
            .OrderBy(m => m.Name)
            .Select(m => new MedicineDto(m.Id, m.Name, m.ActiveIngredient, m.DefaultUnit,
                m.MeatWithdrawalDays, m.MilkWithdrawalDays, m.Notes, m.FarmId == null))
            .ToListAsync();
    }

    // POST /api/farms/{farmId}/medicines  → işletmeye özel ilaç (arınma süreleriyle)
    [HttpPost("medicines")]
    public async Task<ActionResult<MedicineDto>> AddMedicine(Guid farmId, MedicineRequest req)
    {
        var role = await access.GetRoleAsync(farmId, User.GetUserId());
        if (role is null) return NotFound(new { hata = "İşletme bulunamadı." });
        if (!FarmAccess.CanManage(role)) return Forbidden("İlaç eklemeye yetkiniz yok.");

        var error = ValidateMedicine(req);
        if (error is not null) return BadRequest(new { hata = error });
        var name = req.Name.Trim();
        if (await db.Medicines.AnyAsync(m => m.FarmId == farmId && m.Name.ToLower() == name.ToLower()))
            return Conflict(new { hata = "Bu adda bir ilaç zaten var." });

        var m = new Medicine { FarmId = farmId };
        ApplyMedicine(m, req);
        db.Medicines.Add(m);
        await db.SaveChangesAsync();
        return new MedicineDto(m.Id, m.Name, m.ActiveIngredient, m.DefaultUnit,
                               m.MeatWithdrawalDays, m.MilkWithdrawalDays, m.Notes, false);
    }

    // PUT /api/farms/{farmId}/medicines/{id}  → yalnızca işletmenin kendi ilacı düzenlenir
    [HttpPut("medicines/{id:guid}")]
    public async Task<IActionResult> UpdateMedicine(Guid farmId, Guid id, MedicineRequest req)
    {
        var role = await access.GetRoleAsync(farmId, User.GetUserId());
        if (role is null) return NotFound(new { hata = "İşletme bulunamadı." });
        if (!FarmAccess.CanManage(role)) return Forbidden("İlacı düzenlemeye yetkiniz yok.");

        var m = await db.Medicines.FirstOrDefaultAsync(x => x.Id == id && x.FarmId == farmId);
        if (m is null) return NotFound(new { hata = "İlaç bulunamadı (ortak katalogdaki ilaçlar düzenlenemez, kendi ilacınızı ekleyin)." });

        var error = ValidateMedicine(req);
        if (error is not null) return BadRequest(new { hata = error });
        ApplyMedicine(m, req);
        await db.SaveChangesAsync();
        return NoContent();
    }

    // ---------------------------------------------------------------- Toplu işlemler
    // POST /api/farms/{farmId}/treatments/batch  → bütün sürüye ya da seçili hayvanlara aynı ilaç
    [HttpPost("treatments/batch")]
    public async Task<IActionResult> BatchTreatment(Guid farmId, BatchTreatmentRequest req)
    {
        var me = User.GetUserId();
        var role = await access.GetRoleAsync(farmId, me);
        if (role is null) return NotFound(new { hata = "İşletme bulunamadı." });
        if (role == MemberRole.Viewer) return Forbidden("İzleyici rolüyle kayıt eklenemez.");

        var q = access.VisibleAnimals(farmId, me, role.Value).Where(a => a.Status == AnimalStatus.Active);
        if (req.HerdId is not null) q = q.Where(a => a.HerdId == req.HerdId);
        else if (req.AnimalIds is { Count: > 0 } ids) q = q.Where(a => ids.Contains(a.Id));
        else return BadRequest(new { hata = "Sürü ya da hayvan seçin." });

        var animalIds = await q.Select(a => a.Id).ToListAsync();
        if (animalIds.Count == 0) return BadRequest(new { hata = "Seçimde aktif hayvan yok." });

        var batchId = Guid.CreateVersion7();
        foreach (var animalId in animalIds)
        {
            var (t, err) = await TreatmentFactory.Build(db, farmId, animalId, req.Treatment, me, batchId);
            if (err is not null) return BadRequest(new { hata = err });
            db.Treatments.Add(t!);
        }
        await db.SaveChangesAsync();
        return Ok(new { batchId, count = animalIds.Count });
    }

    // POST /api/farms/{farmId}/herds/{herdId}/location  → sürüyü topluca meraya / ahıra al
    [HttpPost("herds/{herdId:guid}/location")]
    public async Task<IActionResult> HerdLocation(Guid farmId, Guid herdId, HerdLocationRequest req)
    {
        var me = User.GetUserId();
        var role = await access.GetRoleAsync(farmId, me);
        if (role is null) return NotFound(new { hata = "İşletme bulunamadı." });
        if (role == MemberRole.Viewer) return Forbidden("İzleyici rolüyle kayıt eklenemez.");

        var animalIds = await access.VisibleAnimals(farmId, me, role.Value)
            .Where(a => a.HerdId == herdId && a.Status == AnimalStatus.Active)
            .Select(a => a.Id)
            .ToListAsync();
        if (animalIds.Count == 0) return BadRequest(new { hata = "Bu sürüde görebildiğiniz aktif hayvan yok." });

        var now = DateTimeOffset.UtcNow;
        var notes = TextUtil.Clean(req.Notes);
        db.AnimalLocationEvents.AddRange(animalIds.Select(id => new AnimalLocationEvent
        {
            AnimalId = id, Location = req.Location, Since = now, Notes = notes, RecordedById = me,
        }));
        await db.SaveChangesAsync();
        return Ok(new { count = animalIds.Count });
    }

    // ---------------------------------------------------------------- yardımcılar
    private static string? ValidateMedicine(MedicineRequest req)
    {
        var name = req.Name?.Trim() ?? "";
        if (name.Length is < 2 or > 100) return "İlaç adı 2-100 karakter olmalı.";
        if (req.MeatWithdrawalDays is < 0 or > 365) return "Et arınma süresi 0-365 gün olmalı.";
        if (req.MilkWithdrawalDays is < 0 or > 365) return "Süt arınma süresi 0-365 gün olmalı.";
        return null;
    }

    private static void ApplyMedicine(Medicine m, MedicineRequest req)
    {
        m.Name = req.Name.Trim();
        m.ActiveIngredient = TextUtil.Clean(req.ActiveIngredient);
        m.DefaultUnit = TextUtil.Clean(req.DefaultUnit) ?? "ml";
        m.MeatWithdrawalDays = req.MeatWithdrawalDays;
        m.MilkWithdrawalDays = req.MilkWithdrawalDays;
        m.Notes = TextUtil.Clean(req.Notes);
    }

    private ObjectResult Forbidden(string message) =>
        StatusCode(StatusCodes.Status403Forbidden, new { hata = message });
}
