namespace Ciftligim.Api.Entities;

// İlaç kataloğu. FarmId boşsa herkese açık ortak katalog, doluysa işletmenin kendi eklediği.
public class Medicine
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public Guid? FarmId { get; set; }
    public string Name { get; set; } = "";              // ticari ad (ör. Ivomec)
    public string? ActiveIngredient { get; set; }       // etken madde
    public string DefaultUnit { get; set; } = "ml";
    public int? MeatWithdrawalDays { get; set; }        // et arınma süresi (gün) — prospektüsten
    public int? MilkWithdrawalDays { get; set; }        // süt arınma süresi (gün)
    public string? Notes { get; set; }
}

// İlaç / iğne / aşı uygulaması. Çobanın sahadan girdiği kayıt.
public class Treatment
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public Guid AnimalId { get; set; }
    public TreatmentType Type { get; set; }
    public Guid? MedicineId { get; set; }
    public string? MedicineText { get; set; }           // katalogda yoksa serbest ad
    public decimal? Dose { get; set; }
    public string? DoseUnit { get; set; }
    public string? Route { get; set; }                  // deri altı, kas içi, ağızdan...
    public DateTimeOffset AdministeredAt { get; set; } = DateTimeOffset.UtcNow;
    public string? Description { get; set; }
    public DateOnly? MeatWithdrawalUntil { get; set; }  // bu tarihe kadar kesilemez
    public DateOnly? MilkWithdrawalUntil { get; set; }  // bu tarihe kadar sütü satılamaz
    public Guid? BatchId { get; set; }                  // sürüye toplu uygulamaları gruplar
    public Guid RecordedById { get; set; }
    public DateTimeOffset RecordedAt { get; set; } = DateTimeOffset.UtcNow;

    public Medicine? Medicine { get; set; }
    public User RecordedBy { get; set; } = null!;
}

// Tartım kaydı
public class AnimalWeight
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public Guid AnimalId { get; set; }
    public DateOnly WeighedOn { get; set; }
    public decimal WeightKg { get; set; }
    public string? Notes { get; set; }
    public Guid RecordedById { get; set; }
    public DateTimeOffset RecordedAt { get; set; } = DateTimeOffset.UtcNow;

    public User RecordedBy { get; set; } = null!;
}

// Konum geçmişi (mera / ahır). Güncel konum = son kayıt.
public class AnimalLocationEvent
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public Guid AnimalId { get; set; }
    public AnimalLocation Location { get; set; }
    public DateTimeOffset Since { get; set; } = DateTimeOffset.UtcNow;
    public string? Notes { get; set; }
    public Guid RecordedById { get; set; }
    public DateTimeOffset RecordedAt { get; set; } = DateTimeOffset.UtcNow;

    public User RecordedBy { get; set; } = null!;
}

// Yavrulama (anne üzerinden)
public class BirthEvent
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public Guid MotherId { get; set; }
    public DateOnly BirthDate { get; set; }
    public short OffspringCount { get; set; }
    public short? AliveCount { get; set; }
    public string? Difficulty { get; set; }             // kolay / müdahaleli / sezaryen
    public string? Notes { get; set; }
    public Guid RecordedById { get; set; }
    public DateTimeOffset RecordedAt { get; set; } = DateTimeOffset.UtcNow;

    public User RecordedBy { get; set; } = null!;
}
