using Ciftligim.Api.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Ciftligim.Api.Controllers;

public record BreedDto(int Id, string Name);
public record SpeciesDto(short Id, string Code, string Name, List<BreedDto> Breeds);

[ApiController]
[Authorize]
[Route("api/species")]
public class SpeciesController(AppDbContext db) : ControllerBase
{
    // GET /api/species  → türler ve her türün ırkları (hayvan ekleme formundaki açılır listeler)
    [HttpGet]
    public async Task<List<SpeciesDto>> GetAll()
    {
        var species = await db.Species.OrderBy(s => s.Id).ToListAsync();
        var breeds = await db.Breeds.OrderBy(b => b.Name).ToListAsync();

        return species
            .Select(s => new SpeciesDto(s.Id, s.Code, s.Name,
                breeds.Where(b => b.SpeciesId == s.Id)
                      .OrderBy(b => b.Name == "Melez")   // "Melez" listenin sonunda dursun
                      .ThenBy(b => b.Name)
                      .Select(b => new BreedDto(b.Id, b.Name))
                      .ToList()))
            .ToList();
    }
}
