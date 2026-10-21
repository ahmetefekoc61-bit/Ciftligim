using Ciftligim.Api.Entities;

namespace Ciftligim.Api.Data;

// Uygulama ilk kurulduğunda veritabanına yazılan sabit listeler.
// Yeni ırk eklemek için: listeye yeni satır ekle (yeni Id ile) → migration oluştur.
public static class SeedData
{
    public const short Dog = 1, Donkey = 2, Cattle = 3, Goat = 4, Sheep = 5;

    public static readonly Species[] Species =
    [
        new() { Id = Dog,    Code = "dog",    Name = "Köpek" },
        new() { Id = Donkey, Code = "donkey", Name = "Eşek" },
        new() { Id = Cattle, Code = "cattle", Name = "İnek / Sığır" },
        new() { Id = Goat,   Code = "goat",   Name = "Keçi" },
        new() { Id = Sheep,  Code = "sheep",  Name = "Koyun" },
    ];

    public static readonly Breed[] Breeds =
    [
        // Koyun (1-19)
        new() { Id = 1,  SpeciesId = Sheep, Name = "Akkaraman" },
        new() { Id = 2,  SpeciesId = Sheep, Name = "Morkaraman" },
        new() { Id = 3,  SpeciesId = Sheep, Name = "Kıvırcık" },
        new() { Id = 4,  SpeciesId = Sheep, Name = "İvesi" },
        new() { Id = 5,  SpeciesId = Sheep, Name = "Merinos" },
        new() { Id = 6,  SpeciesId = Sheep, Name = "Karayaka" },
        new() { Id = 7,  SpeciesId = Sheep, Name = "Sakız" },
        new() { Id = 8,  SpeciesId = Sheep, Name = "Dağlıç" },
        new() { Id = 9,  SpeciesId = Sheep, Name = "Romanov" },
        new() { Id = 10, SpeciesId = Sheep, Name = "Melez" },
        // Keçi (20-39)
        new() { Id = 20, SpeciesId = Goat, Name = "Kıl keçisi" },
        new() { Id = 21, SpeciesId = Goat, Name = "Saanen" },
        new() { Id = 22, SpeciesId = Goat, Name = "Ankara keçisi" },
        new() { Id = 23, SpeciesId = Goat, Name = "Kilis" },
        new() { Id = 24, SpeciesId = Goat, Name = "Honamlı" },
        new() { Id = 25, SpeciesId = Goat, Name = "Melez" },
        // Sığır (40-59)
        new() { Id = 40, SpeciesId = Cattle, Name = "Holstein" },
        new() { Id = 41, SpeciesId = Cattle, Name = "Simental" },
        new() { Id = 42, SpeciesId = Cattle, Name = "Montofon (Esmer)" },
        new() { Id = 43, SpeciesId = Cattle, Name = "Jersey" },
        new() { Id = 44, SpeciesId = Cattle, Name = "Yerli Kara" },
        new() { Id = 45, SpeciesId = Cattle, Name = "Boz Irk" },
        new() { Id = 46, SpeciesId = Cattle, Name = "Melez" },
        // Köpek (60-79)
        new() { Id = 60, SpeciesId = Dog, Name = "Kangal" },
        new() { Id = 61, SpeciesId = Dog, Name = "Akbaş" },
        new() { Id = 62, SpeciesId = Dog, Name = "Kars Çoban Köpeği" },
        new() { Id = 63, SpeciesId = Dog, Name = "Melez" },
        // Eşek (80-99)
        new() { Id = 80, SpeciesId = Donkey, Name = "Anadolu eşeği" },
        new() { Id = 81, SpeciesId = Donkey, Name = "Melez" },
    ];

    // Ortak ilaç kataloğu. Arınma süreleri bilerek boş: ürüne göre değişir, prospektüsten
    // işletme kendi kaydında girer. Id'ler sabit olmalı (migration'lar bunlara göre yazılır).
    public static readonly Medicine[] Medicines =
    [
        new() { Id = Guid.Parse("0199a000-0000-7000-8000-000000000001"), Name = "Ivomec", ActiveIngredient = "ivermektin", DefaultUnit = "ml" },
        new() { Id = Guid.Parse("0199a000-0000-7000-8000-000000000002"), Name = "Dectomax", ActiveIngredient = "doramektin", DefaultUnit = "ml" },
        new() { Id = Guid.Parse("0199a000-0000-7000-8000-000000000003"), Name = "Albendazol (iç parazit)", ActiveIngredient = "albendazol", DefaultUnit = "ml" },
        new() { Id = Guid.Parse("0199a000-0000-7000-8000-000000000004"), Name = "Oksitetrasiklin (LA)", ActiveIngredient = "oksitetrasiklin", DefaultUnit = "ml" },
        new() { Id = Guid.Parse("0199a000-0000-7000-8000-000000000005"), Name = "Penisilin-Streptomisin", ActiveIngredient = "penisilin + streptomisin", DefaultUnit = "ml" },
        new() { Id = Guid.Parse("0199a000-0000-7000-8000-000000000006"), Name = "Vitamin AD3E", ActiveIngredient = "A, D3, E vitaminleri", DefaultUnit = "ml" },
        new() { Id = Guid.Parse("0199a000-0000-7000-8000-000000000007"), Name = "Şap aşısı", DefaultUnit = "ml" },
        new() { Id = Guid.Parse("0199a000-0000-7000-8000-000000000008"), Name = "Koyun-keçi çiçek aşısı", DefaultUnit = "ml" },
        new() { Id = Guid.Parse("0199a000-0000-7000-8000-000000000009"), Name = "Enterotoksemi aşısı", DefaultUnit = "ml" },
        new() { Id = Guid.Parse("0199a000-0000-7000-8000-00000000000a"), Name = "Brusella aşısı", DefaultUnit = "doz" },
        new() { Id = Guid.Parse("0199a000-0000-7000-8000-00000000000b"), Name = "PPR (Küçük ruminant vebası) aşısı", DefaultUnit = "ml" },
    ];

    // Ürün listesi. Yeni ürün eklemek için sona yeni Id ile ekle → migration.
    public static readonly Crop[] Crops =
    [
        new() { Id = 1, Name = "Buğday" },
        new() { Id = 2, Name = "Arpa" },
        new() { Id = 3, Name = "Yulaf" },
        new() { Id = 4, Name = "Çavdar" },
        new() { Id = 5, Name = "Tritikale" },
        new() { Id = 6, Name = "Mısır (dane)" },
        new() { Id = 7, Name = "Mısır (silajlık)" },
        new() { Id = 8, Name = "Ayçiçeği" },
        new() { Id = 9, Name = "Kanola" },
        new() { Id = 10, Name = "Nohut" },
        new() { Id = 11, Name = "Mercimek" },
        new() { Id = 12, Name = "Fasulye" },
        new() { Id = 13, Name = "Yonca" },
        new() { Id = 14, Name = "Korunga" },
        new() { Id = 15, Name = "Fiğ" },
        new() { Id = 16, Name = "Şeker pancarı" },
        new() { Id = 17, Name = "Patates" },
        new() { Id = 18, Name = "Soğan" },
        new() { Id = 19, Name = "Karpuz" },
        new() { Id = 20, Name = "Kavun" },
        new() { Id = 21, Name = "Domates" },
        new() { Id = 22, Name = "Biber" },
        new() { Id = 23, Name = "Pamuk" },
        new() { Id = 24, Name = "Diğer" },
    ];
}
