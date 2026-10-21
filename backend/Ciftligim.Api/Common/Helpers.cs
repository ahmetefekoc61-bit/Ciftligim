using Ciftligim.Api.Data;
using Ciftligim.Api.Entities;
using Ciftligim.Api.Controllers;
using Microsoft.EntityFrameworkCore;

namespace Ciftligim.Api.Common;

public static class Clock
{
    // Türkiye saatine (UTC+3, yaz saati yok) göre bugün
    public static DateOnly Today() => DateOnly.FromDateTime(DateTime.UtcNow.AddHours(3));

    public static DateOnly LocalDate(DateTimeOffset t) => DateOnly.FromDateTime(t.UtcDateTime.AddHours(3));
}

public static class TextUtil
{
    public static string? Clean(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();

    // Küpe numarası: boşlukları at, harfleri büyük yaz ("tr 06 123" → "TR06123")
    public static string? NormalizeTag(string? tag)
    {
        if (string.IsNullOrWhiteSpace(tag)) return null;
        return string.Concat(tag.Where(c => !char.IsWhiteSpace(c))).ToUpperInvariant();
    }
}

// Tedavi kaydını doğrular ve arınma tarihlerini ilaç kataloğundan hesaplar.
// Tek hayvana ve sürüye toplu uygulamada aynı kurallar geçerli olsun diye ayrı yerde.
public static class TreatmentFactory
{
    public static async Task<(Treatment? Treatment, string? Error)> Build(
        AppDbContext db, Guid farmId, Guid animalId, TreatmentRequest req, Guid userId, Guid? batchId)
    {
        var at = req.AdministeredAt ?? DateTimeOffset.UtcNow;
        if (at > DateTimeOffset.UtcNow.AddMinutes(5)) return (null, "Uygulama tarihi ileri bir zaman olamaz.");
        if (req.Dose is not null && req.Dose <= 0) return (null, "Doz sıfırdan büyük olmalı.");

        Medicine? medicine = null;
        if (req.MedicineId is not null)
        {
            medicine = await db.Medicines.FirstOrDefaultAsync(m =>
                m.Id == req.MedicineId && (m.FarmId == null || m.FarmId == farmId));
            if (medicine is null) return (null, "İlaç bulunamadı.");
        }

        var medicineText = TextUtil.Clean(req.MedicineText);
        var description = TextUtil.Clean(req.Description);
        if (medicine is null && medicineText is null && description is null)
            return (null, "İlaç seçin, ilaç adı yazın ya da açıklama girin.");

        var day = Clock.LocalDate(at);
        var meat = req.MeatWithdrawalUntil
                   ?? (medicine?.MeatWithdrawalDays is int md ? (DateOnly?)day.AddDays(md) : null);
        var milk = req.MilkWithdrawalUntil
                   ?? (medicine?.MilkWithdrawalDays is int kd ? (DateOnly?)day.AddDays(kd) : null);

        var t = new Treatment
        {
            AnimalId = animalId,
            Type = req.Type,
            MedicineId = medicine?.Id,
            MedicineText = medicine is null ? medicineText : null,
            Dose = req.Dose,
            DoseUnit = req.Dose is null ? null : (TextUtil.Clean(req.DoseUnit) ?? medicine?.DefaultUnit ?? "ml"),
            Route = TextUtil.Clean(req.Route),
            AdministeredAt = at,
            Description = description,
            MeatWithdrawalUntil = meat,
            MilkWithdrawalUntil = milk,
            BatchId = batchId,
            RecordedById = userId,
        };
        return (t, null);
    }
}
