using System.Text.Json;
using Ciftligim.Api.Auth;
using Ciftligim.Api.Common;
using Ciftligim.Api.Data;
using Ciftligim.Api.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Ciftligim.Api.Controllers;

public record ParcelRequest(
    string Province, string District, string Neighborhood, int? TkgmNeighborhoodId,
    int BlockNo, int ParcelNo,
    string? Nickname, string? Locality, string? Quality, decimal? AreaM2,
    OwnershipType Ownership, int? ShareNumerator, int? ShareDenominator, string? TitleOwner,
    string? BoundaryGeoJson, double? CenterLat, double? CenterLon, bool FromTkgm,
    string? Notes);

public record ParcelListItem(
    Guid Id, string? Nickname, string Province, string District, string Neighborhood,
    int BlockNo, int ParcelNo, string? Locality, decimal? AreaM2, OwnershipType Ownership,
    double? CenterLat, double? CenterLon, string? BoundaryGeoJson,
    short? LastSeasonYear, string? LastCropName);

public record SeasonRequest(short Year, int? CropId, string? Variety, decimal? PlantedAreaM2,
                            DateOnly? SowingDate, DateOnly? HarvestDate, decimal? YieldKg, string? Notes);
public record SeasonDto(Guid Id, short Year, int? CropId, string CropName, string? Variety, decimal? PlantedAreaM2,
                        DateOnly? SowingDate, DateOnly? HarvestDate, decimal? YieldKg, decimal? YieldKgPerDecare, string? Notes);

public record OperationRequest(OperationType Type, DateOnly PerformedOn, string? Product, decimal? Quantity,
                               string? Unit, decimal? Cost, string? Description);
public record OperationDto(Guid Id, OperationType Type, DateOnly PerformedOn, string? Product, decimal? Quantity,
                           string? Unit, decimal? Cost, string? Description, string RecordedByName);

public record LeaseRequest(string Counterparty, DateOnly StartDate, DateOnly? EndDate, string? Terms, decimal? Amount, string? Notes);
public record LeaseDto(Guid Id, string Counterparty, DateOnly StartDate, DateOnly? EndDate, string? Terms, decimal? Amount,
                       string? Notes, bool Active);

public record ParcelDetail(
    Guid Id, string? Nickname, string Province, string District, string Neighborhood, int? TkgmNeighborhoodId,
    int BlockNo, int ParcelNo, string? Locality, string? Quality, decimal? AreaM2,
    OwnershipType Ownership, int? ShareNumerator, int? ShareDenominator, string? TitleOwner,
    string? BoundaryGeoJson, double? CenterLat, double? CenterLon, DateTimeOffset? TkgmFetchedAt, string? Notes,
    List<SeasonDto> Seasons, List<OperationDto> Operations, List<LeaseDto> Leases, bool CanEdit);

public record CropAreaDto(string CropName, decimal AreaM2, int ParcelCount);
public record ParcelSummaryDto(int ParcelCount, decimal TotalAreaM2, decimal OwnedAreaM2, decimal LeasedAreaM2,
                               short Year, List<CropAreaDto> CropsThisYear, decimal OperationCostThisYear);

[ApiController]
[Authorize]
[Route("api/crops")]
public class CropsController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public Task<List<Crop>> GetAll() => db.Crops.OrderBy(c => c.Id).ToListAsync();
}

// Tarlalar ve kayıtları. Herkes görür; ekleme/düzenleme/silme sahip ve yöneticide.
[ApiController]
[Authorize]
[Route("api/farms/{farmId:guid}/parcels")]
public class ParcelsController(AppDbContext db, FarmAccess access) : ControllerBase
{
    // ---------------------------------------------------------------- liste / özet
    [HttpGet]
    public async Task<ActionResult<List<ParcelListItem>>> GetAll(Guid farmId)
    {
        if (await access.GetRoleAsync(farmId, User.GetUserId()) is null) return FarmNotFound();

        return await db.Parcels
            .Where(p => p.FarmId == farmId)
            .OrderBy(p => p.Nickname ?? p.Neighborhood).ThenBy(p => p.BlockNo).ThenBy(p => p.ParcelNo)
            .Select(p => new ParcelListItem(
                p.Id, p.Nickname, p.Province, p.District, p.Neighborhood, p.BlockNo, p.ParcelNo, p.Locality,
                p.AreaM2, p.Ownership, p.CenterLat, p.CenterLon, p.BoundaryGeoJson,
                db.CropSeasons.Where(s => s.ParcelId == p.Id).OrderByDescending(s => s.Year)
                    .Select(s => (short?)s.Year).FirstOrDefault(),
                db.CropSeasons.Where(s => s.ParcelId == p.Id).OrderByDescending(s => s.Year)
                    .Select(s => s.Crop != null ? s.Crop.Name : "Nadas").FirstOrDefault()))
            .ToListAsync();
    }

    [HttpGet("summary")]
    public async Task<ActionResult<ParcelSummaryDto>> Summary(Guid farmId)
    {
        if (await access.GetRoleAsync(farmId, User.GetUserId()) is null) return FarmNotFound();

        var year = (short)Clock.Today().Year;
        var parcels = await db.Parcels.Where(p => p.FarmId == farmId)
            .Select(p => new { p.Id, p.AreaM2, p.Ownership }).ToListAsync();

        var seasons = await db.CropSeasons
            .Where(s => s.Year == year && db.Parcels.Any(p => p.Id == s.ParcelId && p.FarmId == farmId))
            .Select(s => new { s.ParcelId, CropName = s.Crop != null ? s.Crop.Name : "Nadas", s.PlantedAreaM2 })
            .ToListAsync();

        var areaById = parcels.ToDictionary(p => p.Id, p => p.AreaM2 ?? 0);
        var crops = seasons
            .GroupBy(s => s.CropName)
            .Select(g => new CropAreaDto(g.Key, g.Sum(s => s.PlantedAreaM2 ?? areaById.GetValueOrDefault(s.ParcelId)), g.Count()))
            .OrderByDescending(c => c.AreaM2)
            .ToList();

        var yearStart = new DateOnly(year, 1, 1);
        var cost = await db.FieldOperations
            .Where(o => o.PerformedOn >= yearStart && o.Cost != null && db.Parcels.Any(p => p.Id == o.ParcelId && p.FarmId == farmId))
            .SumAsync(o => o.Cost) ?? 0;

        return new ParcelSummaryDto(
            parcels.Count,
            parcels.Sum(p => p.AreaM2 ?? 0),
            parcels.Where(p => p.Ownership is OwnershipType.Owned or OwnershipType.Shared).Sum(p => p.AreaM2 ?? 0),
            parcels.Where(p => p.Ownership is OwnershipType.LeasedIn or OwnershipType.Sharecropped).Sum(p => p.AreaM2 ?? 0),
            year, crops, cost);
    }

    // ---------------------------------------------------------------- tarla
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ParcelDetail>> Get(Guid farmId, Guid id)
    {
        var role = await access.GetRoleAsync(farmId, User.GetUserId());
        if (role is null) return FarmNotFound();

        var p = await db.Parcels.FirstOrDefaultAsync(x => x.Id == id && x.FarmId == farmId);
        if (p is null) return NotFound(new { hata = "Tarla bulunamadı." });

        var area = p.AreaM2;
        var seasons = (await db.CropSeasons.Where(s => s.ParcelId == id)
                .OrderByDescending(s => s.Year).ThenByDescending(s => s.SowingDate)
                .Select(s => new { s, CropName = s.Crop != null ? s.Crop.Name : "Nadas" })
                .ToListAsync())
            .Select(x => new SeasonDto(x.s.Id, x.s.Year, x.s.CropId, x.CropName, x.s.Variety, x.s.PlantedAreaM2,
                x.s.SowingDate, x.s.HarvestDate, x.s.YieldKg, PerDecare(x.s.YieldKg, x.s.PlantedAreaM2 ?? area), x.s.Notes))
            .ToList();

        var ops = await db.FieldOperations.Where(o => o.ParcelId == id)
            .OrderByDescending(o => o.PerformedOn).ThenByDescending(o => o.RecordedAt)
            .Take(100)
            .Select(o => new OperationDto(o.Id, o.Type, o.PerformedOn, o.Product, o.Quantity, o.Unit, o.Cost,
                o.Description, o.RecordedBy.FullName))
            .ToListAsync();

        var today = Clock.Today();
        var leases = await db.ParcelLeases.Where(l => l.ParcelId == id)
            .OrderByDescending(l => l.StartDate)
            .Select(l => new LeaseDto(l.Id, l.Counterparty, l.StartDate, l.EndDate, l.Terms, l.Amount, l.Notes,
                l.StartDate <= today && (l.EndDate == null || l.EndDate >= today)))
            .ToListAsync();

        return new ParcelDetail(p.Id, p.Nickname, p.Province, p.District, p.Neighborhood, p.TkgmNeighborhoodId,
            p.BlockNo, p.ParcelNo, p.Locality, p.Quality, p.AreaM2, p.Ownership, p.ShareNumerator, p.ShareDenominator,
            p.TitleOwner, p.BoundaryGeoJson, p.CenterLat, p.CenterLon, p.TkgmFetchedAt, p.Notes,
            seasons, ops, leases, FarmAccess.CanManage(role));
    }

    [HttpPost]
    public async Task<ActionResult<ParcelDetail>> Create(Guid farmId, ParcelRequest req)
    {
        var (role, err) = await RequireManage(farmId);
        if (err is not null) return err;

        var error = await Validate(farmId, req, null);
        if (error is not null) return BadRequest(new { hata = error });

        var p = new Parcel { FarmId = farmId, CreatedById = User.GetUserId() };
        Apply(p, req);
        db.Parcels.Add(p);
        await db.SaveChangesAsync();
        return await Get(farmId, p.Id);
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ParcelDetail>> Update(Guid farmId, Guid id, ParcelRequest req)
    {
        var (_, err) = await RequireManage(farmId);
        if (err is not null) return err;

        var p = await db.Parcels.FirstOrDefaultAsync(x => x.Id == id && x.FarmId == farmId);
        if (p is null) return NotFound(new { hata = "Tarla bulunamadı." });

        var error = await Validate(farmId, req, id);
        if (error is not null) return BadRequest(new { hata = error });

        Apply(p, req);
        await db.SaveChangesAsync();
        return await Get(farmId, id);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid farmId, Guid id)
    {
        var (_, err) = await RequireManage(farmId);
        if (err is not null) return err;
        var p = await db.Parcels.FirstOrDefaultAsync(x => x.Id == id && x.FarmId == farmId);
        if (p is null) return NotFound(new { hata = "Tarla bulunamadı." });
        db.Parcels.Remove(p);
        await db.SaveChangesAsync();
        return NoContent();
    }

    // ---------------------------------------------------------------- ekim / verim
    [HttpPost("{id:guid}/seasons")]
    public Task<IActionResult> AddSeason(Guid farmId, Guid id, SeasonRequest req) => SaveSeason(farmId, id, null, req);

    [HttpPut("{id:guid}/seasons/{seasonId:guid}")]
    public Task<IActionResult> UpdateSeason(Guid farmId, Guid id, Guid seasonId, SeasonRequest req) => SaveSeason(farmId, id, seasonId, req);

    [HttpDelete("{id:guid}/seasons/{seasonId:guid}")]
    public Task<IActionResult> DeleteSeason(Guid farmId, Guid id, Guid seasonId) =>
        DeleteChild(farmId, id, db.CropSeasons.Where(s => s.Id == seasonId && s.ParcelId == id));

    private async Task<IActionResult> SaveSeason(Guid farmId, Guid parcelId, Guid? seasonId, SeasonRequest req)
    {
        var (_, err) = await RequireManage(farmId);
        if (err is not null) return err;
        if (!await ParcelExists(farmId, parcelId)) return NotFound(new { hata = "Tarla bulunamadı." });

        var thisYear = Clock.Today().Year;
        if (req.Year < 1950 || req.Year > thisYear + 1) return BadRequest(new { hata = $"Yıl 1950-{thisYear + 1} arasında olmalı." });
        if (req.CropId is not null && !await db.Crops.AnyAsync(c => c.Id == req.CropId)) return BadRequest(new { hata = "Ürün bulunamadı." });
        if (req.YieldKg is < 0) return BadRequest(new { hata = "Verim negatif olamaz." });
        if (req.PlantedAreaM2 is <= 0) return BadRequest(new { hata = "Ekilen alan sıfırdan büyük olmalı." });
        if (req.SowingDate is not null && req.HarvestDate is not null && req.HarvestDate < req.SowingDate)
            return BadRequest(new { hata = "Hasat tarihi ekimden önce olamaz." });

        CropSeason? s;
        if (seasonId is null)
        {
            s = new CropSeason { ParcelId = parcelId };
            db.CropSeasons.Add(s);
        }
        else
        {
            s = await db.CropSeasons.FirstOrDefaultAsync(x => x.Id == seasonId && x.ParcelId == parcelId);
            if (s is null) return NotFound(new { hata = "Kayıt bulunamadı." });
        }
        s.Year = req.Year; s.CropId = req.CropId; s.Variety = TextUtil.Clean(req.Variety);
        s.PlantedAreaM2 = req.PlantedAreaM2; s.SowingDate = req.SowingDate; s.HarvestDate = req.HarvestDate;
        s.YieldKg = req.YieldKg; s.Notes = TextUtil.Clean(req.Notes);
        await db.SaveChangesAsync();
        return Ok(new { s.Id });
    }

    // ---------------------------------------------------------------- işlemler
    [HttpPost("{id:guid}/operations")]
    public async Task<IActionResult> AddOperation(Guid farmId, Guid id, OperationRequest req)
    {
        var (_, err) = await RequireManage(farmId);
        if (err is not null) return err;
        if (!await ParcelExists(farmId, id)) return NotFound(new { hata = "Tarla bulunamadı." });
        if (req.PerformedOn > Clock.Today().AddDays(1)) return BadRequest(new { hata = "Tarih ileri bir gün olamaz." });
        if (req.Quantity is < 0 || req.Cost is < 0) return BadRequest(new { hata = "Miktar ve maliyet negatif olamaz." });

        var o = new FieldOperation
        {
            ParcelId = id, Type = req.Type, PerformedOn = req.PerformedOn, Product = TextUtil.Clean(req.Product),
            Quantity = req.Quantity, Unit = req.Quantity is null ? null : TextUtil.Clean(req.Unit),
            Cost = req.Cost, Description = TextUtil.Clean(req.Description), RecordedById = User.GetUserId(),
        };
        db.FieldOperations.Add(o);
        await db.SaveChangesAsync();
        return Ok(new { o.Id });
    }

    [HttpDelete("{id:guid}/operations/{opId:guid}")]
    public Task<IActionResult> DeleteOperation(Guid farmId, Guid id, Guid opId) =>
        DeleteChild(farmId, id, db.FieldOperations.Where(o => o.Id == opId && o.ParcelId == id));

    // ---------------------------------------------------------------- kira / ortakçılık
    [HttpPost("{id:guid}/leases")]
    public Task<IActionResult> AddLease(Guid farmId, Guid id, LeaseRequest req) => SaveLease(farmId, id, null, req);

    [HttpPut("{id:guid}/leases/{leaseId:guid}")]
    public Task<IActionResult> UpdateLease(Guid farmId, Guid id, Guid leaseId, LeaseRequest req) => SaveLease(farmId, id, leaseId, req);

    [HttpDelete("{id:guid}/leases/{leaseId:guid}")]
    public Task<IActionResult> DeleteLease(Guid farmId, Guid id, Guid leaseId) =>
        DeleteChild(farmId, id, db.ParcelLeases.Where(l => l.Id == leaseId && l.ParcelId == id));

    private async Task<IActionResult> SaveLease(Guid farmId, Guid parcelId, Guid? leaseId, LeaseRequest req)
    {
        var (_, err) = await RequireManage(farmId);
        if (err is not null) return err;
        if (!await ParcelExists(farmId, parcelId)) return NotFound(new { hata = "Tarla bulunamadı." });

        var name = req.Counterparty?.Trim() ?? "";
        if (name.Length is < 2 or > 150) return BadRequest(new { hata = "Karşı taraf adı 2-150 karakter olmalı." });
        if (req.EndDate is not null && req.EndDate < req.StartDate) return BadRequest(new { hata = "Bitiş tarihi başlangıçtan önce olamaz." });
        if (req.Amount is < 0) return BadRequest(new { hata = "Tutar negatif olamaz." });

        ParcelLease? l;
        if (leaseId is null)
        {
            l = new ParcelLease { ParcelId = parcelId };
            db.ParcelLeases.Add(l);
        }
        else
        {
            l = await db.ParcelLeases.FirstOrDefaultAsync(x => x.Id == leaseId && x.ParcelId == parcelId);
            if (l is null) return NotFound(new { hata = "Sözleşme bulunamadı." });
        }
        l.Counterparty = name; l.StartDate = req.StartDate; l.EndDate = req.EndDate;
        l.Terms = TextUtil.Clean(req.Terms); l.Amount = req.Amount; l.Notes = TextUtil.Clean(req.Notes);
        await db.SaveChangesAsync();
        return Ok(new { l.Id });
    }

    // ---------------------------------------------------------------- yardımcılar
    private async Task<string?> Validate(Guid farmId, ParcelRequest req, Guid? id)
    {
        if (string.IsNullOrWhiteSpace(req.Province) || string.IsNullOrWhiteSpace(req.District) || string.IsNullOrWhiteSpace(req.Neighborhood))
            return "İl, ilçe ve mahalle/köy gerekli.";
        if (req.BlockNo < 0 || req.ParcelNo <= 0) return "Ada 0 ya da pozitif, parsel pozitif bir sayı olmalı.";
        if (req.AreaM2 is <= 0) return "Alan sıfırdan büyük olmalı.";
        if (req.Ownership == OwnershipType.Shared)
        {
            if (req.ShareNumerator is null || req.ShareDenominator is null || req.ShareNumerator <= 0 || req.ShareNumerator > req.ShareDenominator)
                return "Hisseli tarlada pay geçerli olmalı (ör. 1/3).";
        }
        if (req.BoundaryGeoJson is not null)
        {
            if (req.BoundaryGeoJson.Length > 500_000) return "Sınır verisi çok büyük.";
            try { using var _ = JsonDocument.Parse(req.BoundaryGeoJson); }
            catch (JsonException) { return "Sınır verisi geçersiz."; }
        }
        var province = req.Province.Trim(); var district = req.District.Trim(); var hood = req.Neighborhood.Trim();
        if (await db.Parcels.AnyAsync(p => p.FarmId == farmId && p.Id != id && p.Province == province &&
                                           p.District == district && p.Neighborhood == hood &&
                                           p.BlockNo == req.BlockNo && p.ParcelNo == req.ParcelNo))
            return $"{hood} {req.BlockNo} ada {req.ParcelNo} parsel zaten kayıtlı.";
        return null;
    }

    private static void Apply(Parcel p, ParcelRequest req)
    {
        p.Province = req.Province.Trim(); p.District = req.District.Trim(); p.Neighborhood = req.Neighborhood.Trim();
        p.TkgmNeighborhoodId = req.TkgmNeighborhoodId;
        p.BlockNo = req.BlockNo; p.ParcelNo = req.ParcelNo;
        p.Nickname = TextUtil.Clean(req.Nickname); p.Locality = TextUtil.Clean(req.Locality); p.Quality = TextUtil.Clean(req.Quality);
        p.AreaM2 = req.AreaM2 is null ? null : Math.Round(req.AreaM2.Value, 2);
        p.Ownership = req.Ownership;
        p.ShareNumerator = req.Ownership == OwnershipType.Shared ? req.ShareNumerator : null;
        p.ShareDenominator = req.Ownership == OwnershipType.Shared ? req.ShareDenominator : null;
        p.TitleOwner = TextUtil.Clean(req.TitleOwner);
        p.Notes = TextUtil.Clean(req.Notes);
        // Sınır yalnızca yeni geldiyse değişir; düzenlemede boş gönderilirse eskisi korunur
        if (req.BoundaryGeoJson is not null)
        {
            p.BoundaryGeoJson = req.BoundaryGeoJson;
            p.CenterLat = req.CenterLat; p.CenterLon = req.CenterLon;
            if (req.FromTkgm) p.TkgmFetchedAt = DateTimeOffset.UtcNow;
        }
        else if (req.CenterLat is not null && req.CenterLon is not null)
        {
            p.CenterLat = req.CenterLat; p.CenterLon = req.CenterLon;
        }
    }

    private static decimal? PerDecare(decimal? yieldKg, decimal? areaM2) =>
        yieldKg is null || areaM2 is null or 0m ? null : Math.Round(yieldKg.Value / (areaM2.Value / 1000m), 1);

    private Task<bool> ParcelExists(Guid farmId, Guid id) => db.Parcels.AnyAsync(p => p.Id == id && p.FarmId == farmId);

    private async Task<IActionResult> DeleteChild<T>(Guid farmId, Guid parcelId, IQueryable<T> query) where T : class
    {
        var (_, err) = await RequireManage(farmId);
        if (err is not null) return err;
        if (!await ParcelExists(farmId, parcelId)) return NotFound(new { hata = "Tarla bulunamadı." });
        var row = await query.FirstOrDefaultAsync();
        if (row is null) return NotFound(new { hata = "Kayıt bulunamadı." });
        db.Remove(row);
        await db.SaveChangesAsync();
        return NoContent();
    }

    private async Task<(MemberRole? Role, ActionResult? Error)> RequireManage(Guid farmId)
    {
        var role = await access.GetRoleAsync(farmId, User.GetUserId());
        if (role is null) return (null, FarmNotFound());
        if (!FarmAccess.CanManage(role))
            return (role, StatusCode(StatusCodes.Status403Forbidden, new { hata = "Tarla kayıtlarını yalnızca sahip ve yönetici değiştirebilir." }));
        return (role, null);
    }

    private NotFoundObjectResult FarmNotFound() => NotFound(new { hata = "İşletme bulunamadı." });
}
