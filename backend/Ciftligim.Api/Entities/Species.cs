namespace Ciftligim.Api.Entities;

// Hayvan türü: köpek, eşek, sığır, keçi, koyun. Sabit liste, başlangıç verisiyle gelir.
public class Species
{
    public short Id { get; set; }
    public string Code { get; set; } = "";
    public string Name { get; set; } = "";
}

// Irk: Akkaraman, Saanen, Holstein... Her ırk bir türe bağlı.
public class Breed
{
    public int Id { get; set; }
    public short SpeciesId { get; set; }
    public string Name { get; set; } = "";
}
