using System.Diagnostics;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Ciftligim.Api.Controllers;

// Küpe fotoğrafındaki yazıyı sunucuda okur (Tesseract OCR, Docker imajında kurulu).
// Telefon kendi okuyamazsa yedek yol olarak kullanılır. Fotoğraf saklanmaz; okunduktan sonra silinir.
[ApiController]
[Authorize]
[Route("api/ocr")]
public class OcrController(ILogger<OcrController> log) : ControllerBase
{
    private const string Whitelist = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

    // POST /api/ocr  (multipart/form-data, alan adı: image)
    [HttpPost]
    [RequestSizeLimit(8 * 1024 * 1024)]
    public async Task<IActionResult> Read(IFormFile? image, CancellationToken ct)
    {
        if (image is null || image.Length == 0)
            return BadRequest(new { hata = "Fotoğraf gelmedi." });

        var path = Path.Combine(Path.GetTempPath(), $"kupe-{Guid.NewGuid():N}.jpg");
        var temps = new List<string> { path };
        try
        {
            await using (var fs = System.IO.File.Create(path))
                await image.CopyToAsync(fs, ct);

            var lines = new List<string>();
            // Önce görüntüyü temizle (gri, gürültü azalt, kontrast aç, siyah-beyaz yap), sonra oku.
            // İki farklı temizleme × iki okuma modu: silik/eğik küpelerde en az biri genelde tutar.
            var variants = new[]
            {
                ("a", new[] { "-colorspace", "Gray", "-median", "5", "-normalize", "-threshold", "45%" }, new[] { "6", "11" }),
                ("b", new[] { "-colorspace", "Gray", "-median", "5", "-normalize", "-lat", "60x60-8%" }, new[] { "6" }),
            };
            foreach (var (name, convertArgs, psms) in variants)
            {
                var pre = Path.ChangeExtension(path, $".{name}.png");
                temps.Add(pre);
                if (!await Run("convert", [path, .. convertArgs, pre], ct)) pre = path;   // ImageMagick yoksa ham fotoğraf
                foreach (var psm in psms)
                {
                    var text = await RunTesseract(pre, psm, ct);
                    if (text is null) return StatusCode(503, new { hata = "Sunucuda yazı okuma kurulu değil." });
                    lines.AddRange(text.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries));
                }
            }
            return Ok(new { lines = lines.Distinct().ToList() });
        }
        finally
        {
            foreach (var t in temps)
                try { System.IO.File.Delete(t); } catch { /* geçici dosya */ }
        }
    }

    private static async Task<bool> Run(string exe, string[] args, CancellationToken ct)
    {
        var psi = new ProcessStartInfo(exe) { UseShellExecute = false, RedirectStandardError = true, RedirectStandardOutput = true };
        foreach (var a in args) psi.ArgumentList.Add(a);
        try
        {
            using var p = Process.Start(psi);
            if (p is null) return false;
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
            timeout.CancelAfter(TimeSpan.FromSeconds(30));
            _ = p.StandardOutput.ReadToEndAsync(timeout.Token);
            _ = p.StandardError.ReadToEndAsync(timeout.Token);
            await p.WaitForExitAsync(timeout.Token);
            return p.ExitCode == 0;
        }
        catch (System.ComponentModel.Win32Exception)
        {
            return false;
        }
    }

    private async Task<string?> RunTesseract(string imagePath, string psm, CancellationToken ct)
    {
        var psi = new ProcessStartInfo("tesseract")
        {
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
        };
        foreach (var a in new[] { imagePath, "stdout", "-l", "eng", "--psm", psm, "-c", $"tessedit_char_whitelist={Whitelist}" })
            psi.ArgumentList.Add(a);

        try
        {
            using var p = Process.Start(psi);
            if (p is null) return null;
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
            timeout.CancelAfter(TimeSpan.FromSeconds(40));
            var stdout = p.StandardOutput.ReadToEndAsync(timeout.Token);
            var stderr = p.StandardError.ReadToEndAsync(timeout.Token);
            await p.WaitForExitAsync(timeout.Token);
            var err = await stderr;
            if (p.ExitCode != 0) log.LogWarning("tesseract çıkış {Code}: {Err}", p.ExitCode, err);
            return await stdout;
        }
        catch (System.ComponentModel.Win32Exception)
        {
            return null;   // tesseract kurulu değil (ör. Windows'ta yerel çalıştırma)
        }
    }
}
