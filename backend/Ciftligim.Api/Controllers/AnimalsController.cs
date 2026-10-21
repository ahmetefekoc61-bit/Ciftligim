using Ciftligim.Api.Auth;
using Ciftligim.Api.Data;
using Ciftligim.Api.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Ciftligim.Api.Controllers;

// Hayvan ekleme ve düzenleme için aynı form kullanılır
public record AnimalRequest(
    short SpeciesId,
    int? BreedId,
    Guid? HerdId,
    string? EarTag,
    string? Microchip,
    string? Name,
    AnimalSex Sex,
    DateOnly? BirthDate,
    bool BirthDateEstimated,
    Guid? MotherId,
    Guid? FatherId,
    string? ColorMarks,
    DateOnly? AcquiredOn,
    string? Notes);

// Satış / ölüm / kesim / kayıp kaydı
public record AnimalExitRequest(AnimalStatus Status, DateOnly Date, string? Notes);

public record AnimalListItem(
    Guid Id, string? EarTag, string? Name,
    short SpeciesId, string SpeciesName, string? BreedName,
    AnimalSex Sex, DateOnly? BirthDate, int? AgeMonths,
    Guid? HerdId, string? HerdName, AnimalStatus Status,
    AnimalLocation? CurrentLocation, bool InWithdrawal);

public record ParentDto(Guid Id, string? EarTag, string? Name);

public record AnimalDetail(
    Guid Id, string? EarTag, string? Microchip, string? Name,
    short SpeciesId, string SpeciesName, int? BreedId, string? BreedName,
    AnimalSex Sex, DateOnly? BirthDate, bool BirthDateEstimated, int? AgeMonths,
    Guid? HerdId, string? HerdName,
    ParentDto? Mother, ParentDto? Father, List<ParentDto> Offspring,
    string? ColorMarks, string? PhotoUrl,
    AnimalStatus Status, DateOnly? AcquiredOn, DateOnly? ExitedOn, string? Notes,
    DateTimeOffset CreatedAt,
    AnimalLocation? CurrentLocation, DateTimeOffset? LocationSince,
    decimal? LastWeightKg, DateOnly? LastWeighedOn,
    DateOnly? MeatWithdrawalUntil, DateOnly? MilkWithdrawalUntil,
    bool CanEdit, bool CanAddRecords);

[ApiController]
[Authorize]
[Route("api/farms/{farmId:guid}/animals")]
public class AnimalsController(AppDbContext db, FarmAccess access) : ControllerBase
{
    // GET /api/farms/{farmId}/animals?herdId=&speciesId=&status=&search=
    //   Varsayılan: yalnızca aktif hayvanlar. Çoban sadece kendi sürülerini görür.
    //   search: küpe no ya da isimde arar
    [HttpGet]
    public async Task<ActionResult<List<AnimalListItem>>> GetAll(
        Guid farmId, Guid? herdId, short? speciesId, AnimalStatus? status, string? search)
    {
        var me = User.GetUserId();
        var role = await access.GetRoleAsync(farmId, me);
        if (role is null) return NotFound(new { hata = "İşletme bulunamadı." });

        var q = access.VisibleAnimals(farmId, me, role.Value)
                      .Where(a => a.Status == (status ?? AnimalStatus.Active));
        if (herdId is not null) q = q.Where(a => a.HerdId == herdId);
        if (speciesId is not null) q = q.Where(a => a.SpeciesId == speciesId);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var pattern = $"%{search.Trim()}%";
            q = q.Where(a => EF.Functions.ILike(a.EarTag ?? "", pattern) || EF.Functions.ILike(a.Name ?? "", pattern));
        }

        var today = Today();
        var rows = await q
            .OrderBy(a => a.EarTag).ThenBy(a => a.Name)
            .Select(a => new
            {
                a.Id, a.EarTag, a.Name, a.SpeciesId,
                SpeciesName = a.Species.Name,
                BreedName = a.Breed != null ? a.Breed.Name : null,
                a.Sex, a.BirthDate, a.ExitedOn, a.HerdId,
                HerdName = a.Herd != null ? a.Herd.Name : null,
                a.Status,
                Location = db.AnimalLocationEvents.Where(e => e.AnimalId == a.Id)
                             .OrderByDescending(e => e.Since)
                             .Select(e => (AnimalLocation?)e.Location).FirstOrDefault(),
                InWithdrawal = db.Treatments.Any(t => t.AnimalId == a.Id &&
                             (t.MeatWithdrawalUntil >= today || t.MilkWithdrawalUntil >= today)),
            })
            .ToListAsync();

        return rows.Select(r => new AnimalListItem(
            r.Id, r.EarTag, r.Name, r.SpeciesId, r.SpeciesName, r.BreedName,
            r.Sex, r.BirthDate, AgeInMonths(r.BirthDate, r.ExitedOn),
            r.HerdId, r.HerdName, r.Status, r.Location, r.InWithdrawal)).ToList();
    }

    // GET /api/farms/{farmId}/animals/{id}  → hayvan profili
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<AnimalDetail>> Get(Guid farmId, Guid id)
    {
        var me = User.GetUserId();
        var role = await access.GetRoleAsync(farmId, me);
        if (role is null) return NotFound(new { hata = "İşletme bulunamadı." });

        var animal = await access.VisibleAnimals(farmId, me, role.Value)
            .Include(a => a.Species).Include(a => a.Breed).Include(a => a.Herd)
            .FirstOrDefaultAsync(a => a.Id == id);
        if (animal is null) return NotFound(new { hata = "Hayvan bulunamadı." });

        return await ToDetail(animal, role.Value);
    }

    // GET /api/farms/{farmId}/animals/by-tag/{earTag}  → küpe okutunca hayvanı bul
    [HttpGet("by-tag/{earTag}")]
    public async Task<ActionResult<AnimalDetail>> GetByTag(Guid farmId, string earTag)
    {
        var me = User.GetUserId();
        var role = await access.GetRoleAsync(farmId, me);
        if (role is null) return NotFound(new { hata = "İşletme bulunamadı." });

        var tag = NormalizeTag(earTag);
        var animal = await access.VisibleAnimals(farmId, me, role.Value)
            .Include(a => a.Species).Include(a => a.Breed).Include(a => a.Herd)
            .FirstOrDefaultAsync(a => a.EarTag == tag);
        if (animal is null) return NotFound(new { hata = "Bu küpe numarasıyla hayvan bulunamadı." });

        return await ToDetail(animal, role.Value);
    }

    // POST /api/farms/{farmId}/animals  → yeni hayvan (sahip / yönetici; çoban ekleyemez)
    [HttpPost]
    public async Task<ActionResult<AnimalDetail>> Create(Guid farmId, AnimalRequest req)
    {
        var me = User.GetUserId();
        var role = await access.GetRoleAsync(farmId, me);
        if (role is null) return NotFound(new { hata = "İşletme bulunamadı." });
        if (!FarmAccess.CanManage(role)) return Forbidden("Hayvan eklemeye yetkiniz yok.");

        var error = await Validate(farmId, req, animalId: null);
        if (error is not null) return BadRequest(new { hata = error });

        var animal = new Animal { FarmId = farmId, CreatedById = me };
        Apply(animal, req);
        db.Animals.Add(animal);
        await db.SaveChangesAsync();

        return await Get(farmId, animal.Id);
    }

    // PUT /api/farms/{farmId}/animals/{id}  → kimlik bilgilerini düzenle (sahip / yönetici)
    [HttpPut("{id:guid}")]
    public async Task<ActionResult<AnimalDetail>> Update(Guid farmId, Guid id, AnimalRequest req)
    {
        var role = await access.GetRoleAsync(farmId, User.GetUserId());
        if (role is null) return NotFound(new { hata = "İşletme bulunamadı." });
        if (!FarmAccess.CanManage(role)) return Forbidden("Hayvanı düzenlemeye yetkiniz yok.");

        var animal = await db.Animals.FirstOrDefaultAsync(a => a.Id == id && a.FarmId == farmId);
        if (animal is null) return NotFound(new { hata = "Hayvan bulunamadı." });

        var error = await Validate(farmId, req, animalId: id);
        if (error is not null) return BadRequest(new { hata = error });

        Apply(animal, req);
        await db.SaveChangesAsync();
        return await Get(farmId, id);
    }

    // POST /api/farms/{farmId}/animals/{id}/exit  → satıldı / öldü / kesildi / kayboldu
    [HttpPost("{id:guid}/exit")]
    public async Task<IActionResult> Exit(Guid farmId, Guid id, AnimalExitRequest req)
    {
        var role = await access.GetRoleAsync(farmId, User.GetUserId());
        if (role is null) return NotFound(new { hata = "İşletme bulunamadı." });
        if (!FarmAccess.CanManage(role)) return Forbidden("Bu işlem için yetkiniz yok.");

        if (req.Status == AnimalStatus.Active)
            return BadRequest(new { hata = "Çıkış durumu satıldı, öldü, kesildi ya da kayıp olmalı." });
        if (req.Date > Today())
            return BadRequest(new { hata = "Tarih ileri bir gün olamaz." });

        var animal = await db.Animals.FirstOrDefaultAsync(a => a.Id == id && a.FarmId == farmId);
        if (animal is null) return NotFound(new { hata = "Hayvan bulunamadı." });
        if (animal.Status != AnimalStatus.Active)
            return Conflict(new { hata = "Bu hayvan zaten sürüden çıkmış." });

        animal.Status = req.Status;
        animal.ExitedOn = req.Date;
        if (!string.IsNullOrWhiteSpace(req.Notes))
            animal.Notes = string.IsNullOrWhiteSpace(animal.Notes) ? req.Notes.Trim() : $"{animal.Notes}\n{req.Notes.Trim()}";
        await db.SaveChangesAsync();
        return NoContent();
    }

    // POST /api/farms/{farmId}/animals/{id}/restore  → yanlışlıkla çıkış yapıldıysa geri al
    [HttpPost("{id:guid}/restore")]
    public async Task<IActionResult> Restore(Guid farmId, Guid id)
    {
        var role = await access.GetRoleAsync(farmId, User.GetUserId());
        if (role is null) return NotFound(new { hata = "İşletme bulunamadı." });
        if (!FarmAccess.CanManage(role)) return Forbidden("Bu işlem için yetkiniz yok.");

        var animal = await db.Animals.FirstOrDefaultAsync(a => a.Id == id && a.FarmId == farmId);
        if (animal is null) return NotFound(new { hata = "Hayvan bulunamadı." });

        animal.Status = AnimalStatus.Active;
        animal.ExitedOn = null;
        await db.SaveChangesAsync();
        return NoContent();
    }

    // DELETE /api/farms/{farmId}/animals/{id}  → yanlış girilen kaydı tamamen sil (sahip / yönetici)
    //   Satılan/ölen hayvan için silme değil "exit" kullanılır; geçmiş kayıtlar kaybolmasın.
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid farmId, Guid id)
    {
        var role = await access.GetRoleAsync(farmId, User.GetUserId());
        if (role is null) return NotFound(new { hata = "İşletme bulunamadı." });
        if (!FarmAccess.CanManage(role)) return Forbidden("Hayvan silmeye yetkiniz yok.");

        var animal = await db.Animals.FirstOrDefaultAsync(a => a.Id == id && a.FarmId == farmId);
        if (animal is null) return NotFound(new { hata = "Hayvan bulunamadı." });

        db.Animals.Remove(animal);
        await db.SaveChangesAsync();
        return NoContent();
    }

    // ------------------------------------------------------------------ yardımcılar

    // Formdaki bilgiler mantıklı mı? Sorun varsa Türkçe hata mesajı döner, yoksa null.
    private async Task<string?> Validate(Guid farmId, AnimalRequest req, Guid? animalId)
    {
        if (!await db.Species.AnyAsync(s => s.Id == req.SpeciesId))
            return "Geçersiz hayvan türü.";

        if (req.BreedId is not null &&
            !await db.Breeds.AnyAsync(b => b.Id == req.BreedId && b.SpeciesId == req.SpeciesId))
            return "Seçilen ırk bu türe ait değil.";

        if (req.HerdId is not null &&
            !await db.Herds.AnyAsync(h => h.Id == req.HerdId && h.FarmId == farmId))
            return "Sürü bulunamadı.";

        if (req.BirthDate > Today()) return "Doğum tarihi ileri bir gün olamaz.";
        if (req.AcquiredOn > Today()) return "Alış tarihi ileri bir gün olamaz.";

        var tag = NormalizeTag(req.EarTag);
        if (tag is not null &&
            await db.Animals.AnyAsync(a => a.FarmId == farmId && a.EarTag == tag && a.Id != animalId))
            return $"{tag} küpe numaralı başka bir hayvan var.";

        if (req.MotherId is not null)
        {
            var err = await CheckParent(farmId, req.MotherId.Value, AnimalSex.Female, req, animalId, "Anne");
            if (err is not null) return err;
        }
        if (req.FatherId is not null)
        {
            var err = await CheckParent(farmId, req.FatherId.Value, AnimalSex.Male, req, animalId, "Baba");
            if (err is not null) return err;
        }
        return null;
    }

    private async Task<string?> CheckParent(Guid farmId, Guid parentId, AnimalSex expectedSex,
                                            AnimalRequest req, Guid? animalId, string label)
    {
        if (parentId == animalId) return $"{label} hayvanın kendisi olamaz.";

        var parent = await db.Animals
            .Where(a => a.Id == parentId && a.FarmId == farmId)
            .Select(a => new { a.Sex, a.SpeciesId, a.BirthDate })
            .FirstOrDefaultAsync();
        if (parent is null) return $"{label} bulunamadı.";
        if (parent.SpeciesId != req.SpeciesId) return $"{label} aynı türden olmalı.";
        if (parent.Sex != expectedSex) return $"{label} olarak seçilen hayvanın cinsiyeti uygun değil.";
        if (parent.BirthDate is not null && req.BirthDate is not null && parent.BirthDate >= req.BirthDate)
            return $"{label}, yavrudan önce doğmuş olmalı.";
        return null;
    }

    private static void Apply(Animal a, AnimalRequest req)
    {
        a.SpeciesId = req.SpeciesId;
        a.BreedId = req.BreedId;
        a.HerdId = req.HerdId;
        a.EarTag = NormalizeTag(req.EarTag);
        a.Microchip = Clean(req.Microchip);
        a.Name = Clean(req.Name);
        a.Sex = req.Sex;
        a.BirthDate = req.BirthDate;
        a.BirthDateEstimated = req.BirthDate is not null && req.BirthDateEstimated;
        a.MotherId = req.MotherId;
        a.FatherId = req.FatherId;
        a.ColorMarks = Clean(req.ColorMarks);
        a.AcquiredOn = req.AcquiredOn;
        a.Notes = Clean(req.Notes);
    }

    private async Task<AnimalDetail> ToDetail(Animal a, MemberRole role)
    {
        var parentIds = new[] { a.MotherId, a.FatherId }.Where(x => x is not null).Select(x => x!.Value).ToList();
        var parents = await db.Animals
            .Where(x => parentIds.Contains(x.Id))
            .Select(x => new ParentDto(x.Id, x.EarTag, x.Name))
            .ToListAsync();

        var offspring = await db.Animals
            .Where(x => x.FarmId == a.FarmId && (x.MotherId == a.Id || x.FatherId == a.Id))
            .OrderByDescending(x => x.BirthDate)
            .Select(x => new ParentDto(x.Id, x.EarTag, x.Name))
            .ToListAsync();

        var lastLocation = await db.AnimalLocationEvents
            .Where(e => e.AnimalId == a.Id)
            .OrderByDescending(e => e.Since)
            .Select(e => new { e.Location, e.Since })
            .FirstOrDefaultAsync();
        var lastWeight = await db.AnimalWeights
            .Where(w => w.AnimalId == a.Id)
            .OrderByDescending(w => w.WeighedOn).ThenByDescending(w => w.RecordedAt)
            .Select(w => new { w.WeightKg, w.WeighedOn })
            .FirstOrDefaultAsync();
        var today = Today();
        var meatUntil = await db.Treatments
            .Where(t => t.AnimalId == a.Id && t.MeatWithdrawalUntil >= today)
            .MaxAsync(t => t.MeatWithdrawalUntil);
        var milkUntil = await db.Treatments
            .Where(t => t.AnimalId == a.Id && t.MilkWithdrawalUntil >= today)
            .MaxAsync(t => t.MilkWithdrawalUntil);

        return new AnimalDetail(
            a.Id, a.EarTag, a.Microchip, a.Name,
            a.SpeciesId, a.Species.Name, a.BreedId, a.Breed?.Name,
            a.Sex, a.BirthDate, a.BirthDateEstimated, AgeInMonths(a.BirthDate, a.ExitedOn),
            a.HerdId, a.Herd?.Name,
            parents.FirstOrDefault(p => p.Id == a.MotherId),
            parents.FirstOrDefault(p => p.Id == a.FatherId),
            offspring,
            a.ColorMarks, a.PhotoUrl,
            a.Status, a.AcquiredOn, a.ExitedOn, a.Notes,
            a.CreatedAt,
            lastLocation?.Location, lastLocation?.Since,
            lastWeight?.WeightKg, lastWeight?.WeighedOn,
            meatUntil, milkUntil,
            CanEdit: FarmAccess.CanManage(role),
            CanAddRecords: role != MemberRole.Viewer && a.Status == AnimalStatus.Active);
    }

    // Türkiye saatine göre bugün
    private static DateOnly Today() => DateOnly.FromDateTime(DateTime.UtcNow.AddHours(3));

    // Doğum tarihinden ay cinsinden yaş (öldü/satıldıysa o tarihe kadar)
    private static int? AgeInMonths(DateOnly? birth, DateOnly? exited)
    {
        if (birth is null) return null;
        var b = birth.Value;
        var end = exited ?? Today();
        var months = (end.Year - b.Year) * 12 + end.Month - b.Month;
        if (end.Day < b.Day) months--;
        return Math.Max(months, 0);
    }

    // Küpe numarası: boşlukları at, harfleri büyük yaz ("tr 06 123" → "TR06123")
    private static string? NormalizeTag(string? tag)
    {
        if (string.IsNullOrWhiteSpace(tag)) return null;
        return string.Concat(tag.Where(c => !char.IsWhiteSpace(c))).ToUpperInvariant();
    }

    private static string? Clean(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();

    private ObjectResult Forbidden(string message) =>
        StatusCode(StatusCodes.Status403Forbidden, new { hata = message });
}
