using Ciftligim.Api.Auth;
using Ciftligim.Api.Common;
using Ciftligim.Api.Data;
using Ciftligim.Api.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Ciftligim.Api.Controllers;

// ---------- Gelen veri kalıpları ----------
public record TreatmentRequest(
    TreatmentType Type, Guid? MedicineId, string? MedicineText,
    decimal? Dose, string? DoseUnit, string? Route,
    DateTimeOffset? AdministeredAt, string? Description,
    DateOnly? MeatWithdrawalUntil, DateOnly? MilkWithdrawalUntil);

public record WeightRequest(decimal WeightKg, DateOnly? WeighedOn, string? Notes);
public record LocationRequest(AnimalLocation Location, DateTimeOffset? Since, string? Notes);

public record OffspringRequest(AnimalSex Sex, string? EarTag, string? Name);
public record BirthRequest(
    DateOnly BirthDate, short OffspringCount, short? AliveCount,
    string? Difficulty, string? Notes,
    List<OffspringRequest>? Offspring);   // doluysa yavrular hayvan olarak da eklenir (sahip/yönetici)

// ---------- Giden veri kalıpları ----------
public record TreatmentDto(
    Guid Id, TreatmentType Type, Guid? MedicineId, string Title,
    decimal? Dose, string? DoseUnit, string? Route, DateTimeOffset AdministeredAt, string? Description,
    DateOnly? MeatWithdrawalUntil, DateOnly? MilkWithdrawalUntil, Guid? BatchId,
    string RecordedByName, bool CanDelete);
public record WeightDto(Guid Id, DateOnly WeighedOn, decimal WeightKg, string? Notes, string RecordedByName, bool CanDelete);
public record LocationDto(Guid Id, AnimalLocation Location, DateTimeOffset Since, string? Notes, string RecordedByName, bool CanDelete);
public record BirthDto(Guid Id, DateOnly BirthDate, short OffspringCount, short? AliveCount,
                       string? Difficulty, string? Notes, string RecordedByName, bool CanDelete);
public record AnimalHistoryDto(
    List<TreatmentDto> Treatments, List<WeightDto> Weights,
    List<LocationDto> Locations, List<BirthDto> Births);

// Hayvanın olay kayıtları: tedavi, tartım, konum, yavrulama.
// Sahip, yönetici ve (kendi sürülerinde) çoban kayıt ekleyebilir. İzleyici yalnızca görür.
// Kayıt silme: sahip/yönetici ya da kaydı giren kişi.
[ApiController]
[Authorize]
[Route("api/farms/{farmId:guid}/animals/{animalId:guid}")]
public class RecordsController(AppDbContext db, FarmAccess access) : ControllerBase
{
    // GET .../history  → profil sayfasındaki tüm geçmiş tek seferde
    [HttpGet("history")]
    public async Task<ActionResult<AnimalHistoryDto>> History(Guid farmId, Guid animalId)
    {
        var (role, animal, error) = await Load(farmId, animalId, write: false);
        if (error is not null) return error;
        var me = User.GetUserId();
        var manage = FarmAccess.CanManage(role);

        var treatments = await db.Treatments
            .Where(t => t.AnimalId == animalId)
            .OrderByDescending(t => t.AdministeredAt)
            .Select(t => new TreatmentDto(
                t.Id, t.Type, t.MedicineId,
                t.Medicine != null ? t.Medicine.Name : (t.MedicineText ?? t.Description ?? ""),
                t.Dose, t.DoseUnit, t.Route, t.AdministeredAt, t.Description,
                t.MeatWithdrawalUntil, t.MilkWithdrawalUntil, t.BatchId,
                t.RecordedBy.FullName, manage || t.RecordedById == me))
            .ToListAsync();

        var weights = await db.AnimalWeights
            .Where(w => w.AnimalId == animalId)
            .OrderByDescending(w => w.WeighedOn).ThenByDescending(w => w.RecordedAt)
            .Select(w => new WeightDto(w.Id, w.WeighedOn, w.WeightKg, w.Notes,
                w.RecordedBy.FullName, manage || w.RecordedById == me))
            .ToListAsync();

        var locations = await db.AnimalLocationEvents
            .Where(l => l.AnimalId == animalId)
            .OrderByDescending(l => l.Since)
            .Select(l => new LocationDto(l.Id, l.Location, l.Since, l.Notes,
                l.RecordedBy.FullName, manage || l.RecordedById == me))
            .ToListAsync();

        var births = await db.BirthEvents
            .Where(b => b.MotherId == animalId)
            .OrderByDescending(b => b.BirthDate)
            .Select(b => new BirthDto(b.Id, b.BirthDate, b.OffspringCount, b.AliveCount,
                b.Difficulty, b.Notes, b.RecordedBy.FullName, manage || b.RecordedById == me))
            .ToListAsync();

        return new AnimalHistoryDto(treatments, weights, locations, births);
    }

    // ---------------------------------------------------------------- Tedavi
    // POST .../treatments
    [HttpPost("treatments")]
    public async Task<IActionResult> AddTreatment(Guid farmId, Guid animalId, TreatmentRequest req)
    {
        var (_, animal, error) = await Load(farmId, animalId, write: true);
        if (error is not null) return error;
        if (animal!.Status != AnimalStatus.Active) return InactiveError();

        var (treatment, err) = await TreatmentFactory.Build(db, farmId, animalId, req, User.GetUserId(), batchId: null);
        if (err is not null) return BadRequest(new { hata = err });

        db.Treatments.Add(treatment!);
        await db.SaveChangesAsync();
        return Ok(new { treatment!.Id, treatment.MeatWithdrawalUntil, treatment.MilkWithdrawalUntil });
    }

    [HttpDelete("treatments/{id:guid}")]
    public async Task<IActionResult> DeleteTreatment(Guid farmId, Guid animalId, Guid id)
    {
        var (role, _, error) = await Load(farmId, animalId, write: true);
        if (error is not null) return error;
        var row = await db.Treatments.FirstOrDefaultAsync(x => x.Id == id && x.AnimalId == animalId);
        return await DeleteRow(row, row?.RecordedById, role);
    }

    // ---------------------------------------------------------------- Tartım
    [HttpPost("weights")]
    public async Task<IActionResult> AddWeight(Guid farmId, Guid animalId, WeightRequest req)
    {
        var (_, animal, error) = await Load(farmId, animalId, write: true);
        if (error is not null) return error;
        if (animal!.Status != AnimalStatus.Active) return InactiveError();

        if (req.WeightKg is <= 0 or > 2000) return BadRequest(new { hata = "Ağırlık 0-2000 kg arasında olmalı." });
        var date = req.WeighedOn ?? Clock.Today();
        if (date > Clock.Today()) return BadRequest(new { hata = "Tarih ileri bir gün olamaz." });

        var row = new AnimalWeight
        {
            AnimalId = animalId, WeighedOn = date, WeightKg = Math.Round(req.WeightKg, 2),
            Notes = TextUtil.Clean(req.Notes), RecordedById = User.GetUserId(),
        };
        db.AnimalWeights.Add(row);
        await db.SaveChangesAsync();
        return Ok(new { row.Id });
    }

    [HttpDelete("weights/{id:guid}")]
    public async Task<IActionResult> DeleteWeight(Guid farmId, Guid animalId, Guid id)
    {
        var (role, _, error) = await Load(farmId, animalId, write: true);
        if (error is not null) return error;
        var row = await db.AnimalWeights.FirstOrDefaultAsync(x => x.Id == id && x.AnimalId == animalId);
        return await DeleteRow(row, row?.RecordedById, role);
    }

    // ---------------------------------------------------------------- Konum
    [HttpPost("locations")]
    public async Task<IActionResult> AddLocation(Guid farmId, Guid animalId, LocationRequest req)
    {
        var (_, animal, error) = await Load(farmId, animalId, write: true);
        if (error is not null) return error;
        if (animal!.Status != AnimalStatus.Active) return InactiveError();

        var since = req.Since ?? DateTimeOffset.UtcNow;
        if (since > DateTimeOffset.UtcNow.AddMinutes(5)) return BadRequest(new { hata = "Tarih ileri bir zaman olamaz." });

        var row = new AnimalLocationEvent
        {
            AnimalId = animalId, Location = req.Location, Since = since,
            Notes = TextUtil.Clean(req.Notes), RecordedById = User.GetUserId(),
        };
        db.AnimalLocationEvents.Add(row);
        await db.SaveChangesAsync();
        return Ok(new { row.Id });
    }

    [HttpDelete("locations/{id:guid}")]
    public async Task<IActionResult> DeleteLocation(Guid farmId, Guid animalId, Guid id)
    {
        var (role, _, error) = await Load(farmId, animalId, write: true);
        if (error is not null) return error;
        var row = await db.AnimalLocationEvents.FirstOrDefaultAsync(x => x.Id == id && x.AnimalId == animalId);
        return await DeleteRow(row, row?.RecordedById, role);
    }

    // ---------------------------------------------------------------- Yavrulama
    [HttpPost("births")]
    public async Task<IActionResult> AddBirth(Guid farmId, Guid animalId, BirthRequest req)
    {
        var (role, mother, error) = await Load(farmId, animalId, write: true);
        if (error is not null) return error;
        if (mother!.Status != AnimalStatus.Active) return InactiveError();

        if (mother.Sex != AnimalSex.Female) return BadRequest(new { hata = "Yavrulama yalnızca dişi hayvana girilir." });
        if (req.BirthDate > Clock.Today()) return BadRequest(new { hata = "Doğum tarihi ileri bir gün olamaz." });
        if (req.OffspringCount is < 0 or > 20) return BadRequest(new { hata = "Yavru sayısı 0-20 arasında olmalı." });
        if (req.AliveCount is not null && (req.AliveCount < 0 || req.AliveCount > req.OffspringCount))
            return BadRequest(new { hata = "Canlı yavru sayısı toplamdan fazla olamaz." });

        var offspring = req.Offspring ?? [];
        if (offspring.Count > 0 && !FarmAccess.CanManage(role))
            return Forbidden("Yavruları hayvan olarak eklemeye yetkiniz yok; yalnızca doğum kaydı girebilirsiniz.");
        if (offspring.Count > req.OffspringCount)
            return BadRequest(new { hata = "Eklenen yavru sayısı toplam yavru sayısından fazla olamaz." });

        var me = User.GetUserId();
        var tags = offspring.Select(o => TextUtil.NormalizeTag(o.EarTag)).Where(t => t is not null).ToList();
        if (tags.Count != tags.Distinct().Count())
            return BadRequest(new { hata = "Yavruların küpe numaraları birbirinden farklı olmalı." });
        if (tags.Count > 0 && await db.Animals.AnyAsync(a => a.FarmId == farmId && tags.Contains(a.EarTag)))
            return BadRequest(new { hata = "Yavrulardan birinin küpe numarası başka bir hayvanda kayıtlı." });

        var birth = new BirthEvent
        {
            MotherId = animalId, BirthDate = req.BirthDate,
            OffspringCount = req.OffspringCount, AliveCount = req.AliveCount,
            Difficulty = TextUtil.Clean(req.Difficulty), Notes = TextUtil.Clean(req.Notes), RecordedById = me,
        };
        db.BirthEvents.Add(birth);

        foreach (var o in offspring)
        {
            db.Animals.Add(new Animal
            {
                FarmId = farmId, HerdId = mother.HerdId, SpeciesId = mother.SpeciesId, BreedId = mother.BreedId,
                EarTag = TextUtil.NormalizeTag(o.EarTag), Name = TextUtil.Clean(o.Name), Sex = o.Sex,
                BirthDate = req.BirthDate, MotherId = mother.Id, CreatedById = me,
            });
        }

        await db.SaveChangesAsync();
        return Ok(new { birth.Id });
    }

    [HttpDelete("births/{id:guid}")]
    public async Task<IActionResult> DeleteBirth(Guid farmId, Guid animalId, Guid id)
    {
        var (role, _, error) = await Load(farmId, animalId, write: true);
        if (error is not null) return error;
        var row = await db.BirthEvents.FirstOrDefaultAsync(x => x.Id == id && x.MotherId == animalId);
        return await DeleteRow(row, row?.RecordedById, role);
    }

    // ---------------------------------------------------------------- yardımcılar

    // İşletme üyeliğini, hayvanın görünürlüğünü ve (write ise) yazma yetkisini kontrol eder.
    private async Task<(MemberRole Role, Animal? Animal, ActionResult? Error)> Load(Guid farmId, Guid animalId, bool write)
    {
        var me = User.GetUserId();
        var role = await access.GetRoleAsync(farmId, me);
        if (role is null) return (default, null, NotFound(new { hata = "İşletme bulunamadı." }));

        var animal = await access.VisibleAnimals(farmId, me, role.Value).FirstOrDefaultAsync(a => a.Id == animalId);
        if (animal is null) return (role.Value, null, NotFound(new { hata = "Hayvan bulunamadı." }));

        if (write && role == MemberRole.Viewer)
            return (role.Value, animal, Forbidden("İzleyici rolüyle kayıt eklenemez."));

        return (role.Value, animal, null);
    }

    private async Task<IActionResult> DeleteRow(object? row, Guid? recordedById, MemberRole role)
    {
        if (row is null) return NotFound(new { hata = "Kayıt bulunamadı." });
        if (!FarmAccess.CanManage(role) && recordedById != User.GetUserId())
            return Forbidden("Yalnızca kendi girdiğiniz kayıtları silebilirsiniz.");
        db.Remove(row);
        await db.SaveChangesAsync();
        return NoContent();
    }

    private BadRequestObjectResult InactiveError() =>
        BadRequest(new { hata = "Sürüden çıkmış hayvana kayıt eklenemez." });

    private ObjectResult Forbidden(string message) =>
        StatusCode(StatusCodes.Status403Forbidden, new { hata = message });
}
