namespace Ciftligim.Api.Entities;

// Hayvan kartı. Yaş saklanmaz, doğum tarihinden her sorguda hesaplanır.
public class Animal
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public Guid FarmId { get; set; }
    public Guid? HerdId { get; set; }
    public short SpeciesId { get; set; }
    public int? BreedId { get; set; }

    public string? EarTag { get; set; }        // küpe no (kameradan okunacak)
    public string? Microchip { get; set; }
    public string? Name { get; set; }
    public AnimalSex Sex { get; set; } = AnimalSex.Unknown;
    public DateOnly? BirthDate { get; set; }
    public bool BirthDateEstimated { get; set; }   // doğum tarihi tahmini mi?
    public Guid? MotherId { get; set; }
    public Guid? FatherId { get; set; }
    public string? ColorMarks { get; set; }    // renk / ayırt edici işaret
    public string? PhotoUrl { get; set; }

    public AnimalStatus Status { get; set; } = AnimalStatus.Active;
    public DateOnly? AcquiredOn { get; set; }  // satın alındıysa tarihi
    public DateOnly? ExitedOn { get; set; }    // satış / ölüm / kesim tarihi
    public string? Notes { get; set; }

    public Guid CreatedById { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public Species Species { get; set; } = null!;
    public Breed? Breed { get; set; }
    public Herd? Herd { get; set; }
}
