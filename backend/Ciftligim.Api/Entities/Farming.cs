namespace Ciftligim.Api.Entities;

// Tarla (parsel). TKGM'den getirilirse sınır ve alan otomatik dolar; elle de girilebilir.
public class Parcel
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public Guid FarmId { get; set; }

    public string Province { get; set; } = "";          // il
    public string District { get; set; } = "";          // ilçe
    public string Neighborhood { get; set; } = "";      // mahalle / köy
    public int? TkgmNeighborhoodId { get; set; }        // TKGM mahalle kimliği (yeniden sorgu için)
    public int BlockNo { get; set; }                    // ada (ada yoksa 0)
    public int ParcelNo { get; set; }                   // parsel

    public string? Nickname { get; set; }               // "Dere tarla"
    public string? Locality { get; set; }               // mevki
    public string? Quality { get; set; }                // nitelik (tarla, bağ...)
    public decimal? AreaM2 { get; set; }

    public OwnershipType Ownership { get; set; } = OwnershipType.Owned;
    public int? ShareNumerator { get; set; }            // hisseli ise pay (ör. 1/3)
    public int? ShareDenominator { get; set; }
    public string? TitleOwner { get; set; }             // tapudaki malik

    public string? BoundaryGeoJson { get; set; }        // TKGM'den gelen sınır (GeoJSON geometry)
    public double? CenterLat { get; set; }
    public double? CenterLon { get; set; }
    public DateTimeOffset? TkgmFetchedAt { get; set; }

    public string? Notes { get; set; }
    public Guid CreatedById { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

// Kira / ortakçılık sözleşmesi
public class ParcelLease
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public Guid ParcelId { get; set; }
    public string Counterparty { get; set; } = "";      // kiraya veren / ortak
    public DateOnly StartDate { get; set; }
    public DateOnly? EndDate { get; set; }
    public string? Terms { get; set; }                  // nakit, ürün payı...
    public decimal? Amount { get; set; }
    public string? Notes { get; set; }
}

// Ürün listesi (sabit, başlangıç verisiyle gelir)
public class Crop
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
}

// Bir tarlada bir yıl ekilen ürün ve verimi. CropId boşsa nadas.
public class CropSeason
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public Guid ParcelId { get; set; }
    public short Year { get; set; }
    public int? CropId { get; set; }
    public string? Variety { get; set; }                // tohum çeşidi
    public decimal? PlantedAreaM2 { get; set; }         // tarlanın bir kısmı ekildiyse
    public DateOnly? SowingDate { get; set; }
    public DateOnly? HarvestDate { get; set; }
    public decimal? YieldKg { get; set; }
    public string? Notes { get; set; }

    public Crop? Crop { get; set; }
}

// Tarlaya yapılan işlem
public class FieldOperation
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public Guid ParcelId { get; set; }
    public OperationType Type { get; set; }
    public DateOnly PerformedOn { get; set; }
    public string? Product { get; set; }                // kullanılan gübre / ilaç / tohum
    public decimal? Quantity { get; set; }
    public string? Unit { get; set; }
    public decimal? Cost { get; set; }                  // TL
    public string? Description { get; set; }
    public Guid RecordedById { get; set; }
    public DateTimeOffset RecordedAt { get; set; } = DateTimeOffset.UtcNow;

    public User RecordedBy { get; set; } = null!;
}
