using Ciftligim.Api.Entities;
using Microsoft.EntityFrameworkCore;

namespace Ciftligim.Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Species> Species => Set<Species>();
    public DbSet<Breed> Breeds => Set<Breed>();
    public DbSet<Farm> Farms => Set<Farm>();
    public DbSet<FarmMember> FarmMembers => Set<FarmMember>();
    public DbSet<Herd> Herds => Set<Herd>();
    public DbSet<HerdAssignment> HerdAssignments => Set<HerdAssignment>();
    public DbSet<Animal> Animals => Set<Animal>();
    public DbSet<Medicine> Medicines => Set<Medicine>();
    public DbSet<Treatment> Treatments => Set<Treatment>();
    public DbSet<AnimalWeight> AnimalWeights => Set<AnimalWeight>();
    public DbSet<AnimalLocationEvent> AnimalLocationEvents => Set<AnimalLocationEvent>();
    public DbSet<BirthEvent> BirthEvents => Set<BirthEvent>();
    public DbSet<Parcel> Parcels => Set<Parcel>();
    public DbSet<ParcelLease> ParcelLeases => Set<ParcelLease>();
    public DbSet<Crop> Crops => Set<Crop>();
    public DbSet<CropSeason> CropSeasons => Set<CropSeason>();
    public DbSet<FieldOperation> FieldOperations => Set<FieldOperation>();

    // Enum'lar veritabanına sayı değil metin olarak yazılsın ("Shepherd" gibi) — okurken anlaşılır olur
    protected override void ConfigureConventions(ModelConfigurationBuilder c)
    {
        c.Properties<MemberRole>().HaveConversion<string>().HaveMaxLength(20);
        c.Properties<AnimalSex>().HaveConversion<string>().HaveMaxLength(20);
        c.Properties<AnimalStatus>().HaveConversion<string>().HaveMaxLength(20);
        c.Properties<TreatmentType>().HaveConversion<string>().HaveMaxLength(20);
        c.Properties<AnimalLocation>().HaveConversion<string>().HaveMaxLength(20);
        c.Properties<OwnershipType>().HaveConversion<string>().HaveMaxLength(20);
        c.Properties<OperationType>().HaveConversion<string>().HaveMaxLength(20);
    }

    protected override void OnModelCreating(ModelBuilder b)
    {
        // ---------- Kullanıcı ----------
        b.Entity<User>(e =>
        {
            e.HasIndex(u => u.Email).IsUnique();   // aynı e-posta iki kez kayıt olamaz
            e.HasIndex(u => u.Phone).IsUnique();
            e.Property(u => u.FullName).HasMaxLength(100);
            e.ToTable(t => t.HasCheckConstraint(
                "ck_users_email_or_phone", "email IS NOT NULL OR phone IS NOT NULL"));
        });

        // ---------- Tür ve ırk (sabit liste) ----------
        b.Entity<Species>(e =>
        {
            e.Property(s => s.Id).ValueGeneratedNever();
            e.HasIndex(s => s.Code).IsUnique();
            e.HasData(SeedData.Species);
        });

        b.Entity<Breed>(e =>
        {
            e.Property(x => x.Id).ValueGeneratedNever();
            e.HasIndex(x => new { x.SpeciesId, x.Name }).IsUnique();
            e.HasOne<Species>().WithMany().HasForeignKey(x => x.SpeciesId).OnDelete(DeleteBehavior.Restrict);
            e.HasData(SeedData.Breeds);
        });

        // ---------- İşletme ve üyeler ----------
        b.Entity<Farm>(e =>
        {
            e.Property(f => f.Name).HasMaxLength(100);
            e.HasOne<User>().WithMany().HasForeignKey(f => f.CreatedById).OnDelete(DeleteBehavior.Restrict);
        });

        b.Entity<FarmMember>(e =>
        {
            e.HasKey(m => new { m.FarmId, m.UserId });
            e.HasOne<Farm>().WithMany().HasForeignKey(m => m.FarmId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(m => m.User).WithMany().HasForeignKey(m => m.UserId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne<User>().WithMany().HasForeignKey(m => m.InvitedById).OnDelete(DeleteBehavior.SetNull);
            e.HasIndex(m => m.UserId);
        });

        // ---------- Sürü ve çoban ataması ----------
        b.Entity<Herd>(e =>
        {
            e.Property(h => h.Name).HasMaxLength(100);
            e.HasIndex(h => new { h.FarmId, h.Name }).IsUnique();   // bir işletmede aynı adlı iki sürü olmaz
            e.HasOne<Farm>().WithMany().HasForeignKey(h => h.FarmId).OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<HerdAssignment>(e =>
        {
            e.HasKey(a => new { a.HerdId, a.UserId });
            e.HasOne<Herd>().WithMany().HasForeignKey(a => a.HerdId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(a => a.User).WithMany().HasForeignKey(a => a.UserId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne<User>().WithMany().HasForeignKey(a => a.AssignedById).OnDelete(DeleteBehavior.SetNull);
            e.HasIndex(a => a.UserId);
        });

        // ---------- Hayvan ----------
        b.Entity<Animal>(e =>
        {
            e.Property(a => a.EarTag).HasMaxLength(50);
            e.Property(a => a.Microchip).HasMaxLength(50);
            e.Property(a => a.Name).HasMaxLength(100);

            e.HasOne<Farm>().WithMany().HasForeignKey(a => a.FarmId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(a => a.Herd).WithMany().HasForeignKey(a => a.HerdId).OnDelete(DeleteBehavior.SetNull);
            e.HasOne(a => a.Species).WithMany().HasForeignKey(a => a.SpeciesId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(a => a.Breed).WithMany().HasForeignKey(a => a.BreedId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne<Animal>().WithMany().HasForeignKey(a => a.MotherId).OnDelete(DeleteBehavior.SetNull);
            e.HasOne<Animal>().WithMany().HasForeignKey(a => a.FatherId).OnDelete(DeleteBehavior.SetNull);
            e.HasOne<User>().WithMany().HasForeignKey(a => a.CreatedById).OnDelete(DeleteBehavior.Restrict);

            // Aynı işletmede aynı küpe iki hayvanda olamaz (küpesiz hayvanlar hariç)
            e.HasIndex(a => new { a.FarmId, a.EarTag }).IsUnique().HasFilter("ear_tag IS NOT NULL");
            e.HasIndex(a => a.HerdId);
            e.ToTable(t => t.HasCheckConstraint(
                "ck_animals_not_own_parent", "mother_id <> id AND father_id <> id"));
        });
        // ---------- İlaç kataloğu ----------
        b.Entity<Medicine>(e =>
        {
            e.Property(m => m.Name).HasMaxLength(100);
            e.Property(m => m.DefaultUnit).HasMaxLength(20);
            e.HasOne<Farm>().WithMany().HasForeignKey(m => m.FarmId).OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(m => new { m.FarmId, m.Name });
            e.ToTable(t =>
            {
                t.HasCheckConstraint("ck_medicines_meat_days", "meat_withdrawal_days IS NULL OR meat_withdrawal_days >= 0");
                t.HasCheckConstraint("ck_medicines_milk_days", "milk_withdrawal_days IS NULL OR milk_withdrawal_days >= 0");
            });
            e.HasData(SeedData.Medicines);
        });

        // ---------- Hayvan olay kayıtları ----------
        b.Entity<Treatment>(e =>
        {
            e.Property(t => t.Dose).HasPrecision(10, 3);
            e.Property(t => t.DoseUnit).HasMaxLength(20);
            e.Property(t => t.MedicineText).HasMaxLength(100);
            e.Property(t => t.Route).HasMaxLength(50);
            e.HasOne<Animal>().WithMany().HasForeignKey(t => t.AnimalId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(t => t.Medicine).WithMany().HasForeignKey(t => t.MedicineId).OnDelete(DeleteBehavior.SetNull);
            e.HasOne(t => t.RecordedBy).WithMany().HasForeignKey(t => t.RecordedById).OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(t => new { t.AnimalId, t.AdministeredAt });
            e.HasIndex(t => t.BatchId);
        });

        b.Entity<AnimalWeight>(e =>
        {
            e.Property(w => w.WeightKg).HasPrecision(7, 2);
            e.HasOne<Animal>().WithMany().HasForeignKey(w => w.AnimalId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(w => w.RecordedBy).WithMany().HasForeignKey(w => w.RecordedById).OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(w => new { w.AnimalId, w.WeighedOn });
            e.ToTable(t => t.HasCheckConstraint("ck_animal_weights_positive", "weight_kg > 0"));
        });

        b.Entity<AnimalLocationEvent>(e =>
        {
            e.HasOne<Animal>().WithMany().HasForeignKey(l => l.AnimalId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(l => l.RecordedBy).WithMany().HasForeignKey(l => l.RecordedById).OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(l => new { l.AnimalId, l.Since });
        });

        b.Entity<BirthEvent>(e =>
        {
            e.Property(x => x.Difficulty).HasMaxLength(50);
            e.HasOne<Animal>().WithMany().HasForeignKey(x => x.MotherId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.RecordedBy).WithMany().HasForeignKey(x => x.RecordedById).OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(x => new { x.MotherId, x.BirthDate });
            e.ToTable(t => t.HasCheckConstraint("ck_birth_events_counts",
                "offspring_count >= 0 AND (alive_count IS NULL OR (alive_count >= 0 AND alive_count <= offspring_count))"));
        });
        // ---------- Tarım ----------
        b.Entity<Parcel>(e =>
        {
            e.Property(p => p.Province).HasMaxLength(50);
            e.Property(p => p.District).HasMaxLength(80);
            e.Property(p => p.Neighborhood).HasMaxLength(120);
            e.Property(p => p.Nickname).HasMaxLength(100);
            e.Property(p => p.Locality).HasMaxLength(120);
            e.Property(p => p.Quality).HasMaxLength(100);
            e.Property(p => p.TitleOwner).HasMaxLength(150);
            e.Property(p => p.AreaM2).HasPrecision(12, 2);
            e.Property(p => p.BoundaryGeoJson).HasColumnType("jsonb");
            e.HasOne<Farm>().WithMany().HasForeignKey(p => p.FarmId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne<User>().WithMany().HasForeignKey(p => p.CreatedById).OnDelete(DeleteBehavior.Restrict);
            // Aynı işletmede aynı ada/parsel iki kez girilmesin
            e.HasIndex(p => new { p.FarmId, p.Province, p.District, p.Neighborhood, p.BlockNo, p.ParcelNo }).IsUnique();
            e.ToTable(t =>
            {
                t.HasCheckConstraint("ck_parcels_area", "area_m2 IS NULL OR area_m2 > 0");
                t.HasCheckConstraint("ck_parcels_share",
                    "(share_numerator IS NULL AND share_denominator IS NULL) OR " +
                    "(share_numerator > 0 AND share_denominator > 0 AND share_numerator <= share_denominator)");
            });
        });

        b.Entity<ParcelLease>(e =>
        {
            e.Property(l => l.Counterparty).HasMaxLength(150);
            e.Property(l => l.Amount).HasPrecision(12, 2);
            e.HasOne<Parcel>().WithMany().HasForeignKey(l => l.ParcelId).OnDelete(DeleteBehavior.Cascade);
            e.ToTable(t => t.HasCheckConstraint("ck_parcel_leases_dates", "end_date IS NULL OR end_date >= start_date"));
        });

        b.Entity<Crop>(e =>
        {
            e.Property(c => c.Id).ValueGeneratedNever();
            e.Property(c => c.Name).HasMaxLength(60);
            e.HasIndex(c => c.Name).IsUnique();
            e.HasData(SeedData.Crops);
        });

        b.Entity<CropSeason>(e =>
        {
            e.Property(x => x.Variety).HasMaxLength(100);
            e.Property(x => x.PlantedAreaM2).HasPrecision(12, 2);
            e.Property(x => x.YieldKg).HasPrecision(12, 2);
            e.HasOne<Parcel>().WithMany().HasForeignKey(x => x.ParcelId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Crop).WithMany().HasForeignKey(x => x.CropId).OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(x => new { x.ParcelId, x.Year });
            e.ToTable(t => t.HasCheckConstraint("ck_crop_seasons_year", "year BETWEEN 1950 AND 2200"));
        });

        b.Entity<FieldOperation>(e =>
        {
            e.Property(o => o.Product).HasMaxLength(120);
            e.Property(o => o.Unit).HasMaxLength(20);
            e.Property(o => o.Quantity).HasPrecision(12, 3);
            e.Property(o => o.Cost).HasPrecision(12, 2);
            e.HasOne<Parcel>().WithMany().HasForeignKey(o => o.ParcelId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(o => o.RecordedBy).WithMany().HasForeignKey(o => o.RecordedById).OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(o => new { o.ParcelId, o.PerformedOn });
        });
    }
}
