using Ciftligim.Api.Tkgm;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Ciftligim.Api.Controllers;

// TKGM Parsel Sorgu üzerinden il/ilçe/mahalle listeleri ve parsel bilgisi
[ApiController]
[Authorize]
[Route("api/tkgm")]
public class TkgmController(TkgmClient tkgm) : ControllerBase
{
    [HttpGet("iller")]
    public Task<ActionResult<List<TkgmItem>>> Provinces() => Run(() => tkgm.GetProvinces());

    [HttpGet("ilceler/{provinceId:int}")]
    public Task<ActionResult<List<TkgmItem>>> Districts(int provinceId) =>
        Run(() => tkgm.GetDistricts(provinceId));

    [HttpGet("mahalleler/{districtId:int}")]
    public Task<ActionResult<List<TkgmItem>>> Neighborhoods(int districtId) =>
        Run(() => tkgm.GetNeighborhoods(districtId));

    // GET /api/tkgm/parsel/{mahalleId}/{ada}/{parsel}
    [HttpGet("parsel/{neighborhoodId:int}/{blockNo:int}/{parcelNo:int}")]
    public Task<ActionResult<TkgmParcel>> Parcel(int neighborhoodId, int blockNo, int parcelNo) =>
        Run(() => tkgm.GetParcel(neighborhoodId, blockNo, parcelNo));

    // GET /api/tkgm/konum?lat=39.79&lon=32.80 → haritada dokunulan noktadaki parsel
    [HttpGet("konum")]
    public Task<ActionResult<TkgmParcel>> ParcelAt([FromQuery] double lat, [FromQuery] double lon)
    {
        if (lat is < 35 or > 43 || lon is < 25 or > 45)
            return Task.FromResult<ActionResult<TkgmParcel>>(BadRequest(new { hata = "Koordinat Türkiye sınırları dışında." }));
        return Run(() => tkgm.GetParcelAt(lat, lon));
    }

    private async Task<ActionResult<T>> Run<T>(Func<Task<T>> action)
    {
        try
        {
            return await action();
        }
        catch (TkgmException e)
        {
            return StatusCode(StatusCodes.Status502BadGateway, new { hata = e.Message });
        }
    }
}
