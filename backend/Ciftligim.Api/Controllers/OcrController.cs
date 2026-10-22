using System.Diagnostics;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Ciftligim.Api.Controllers;

public record OcrBase64Request(string Image);

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
        await using var ms = new MemoryStream();
        await image.CopyToAsync(ms, ct);
        return await ReadBytes(ms.ToArray(), ct);
    }

    // POST /api/ocr/base64  { "image": "<base64 jpeg>" }  — telefonda dosya yüklemesi sorun çıkarırsa
    [HttpPost("base64")]
    [RequestSizeLimit(12 * 1024 * 1024)]
    public async Task<IActionResult> ReadBase64(OcrBase64Request req, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req.Image)) return BadRequest(new { hata = "Fotoğraf gelmedi." });
        var b64 = req.Image;
        var comma = b64.IndexOf(',');
        if (b64.StartsWith("data:") && comma > 0) b64 = b64[(comma + 1)..];
        byte[] bytes;
        try { bytes = Convert.FromBase64String(b64); }
        catch (FormatException) { return BadRequest(new { hata = "Fotoğraf bozuk geldi." }); }
        return await ReadBytes(bytes, ct);
    }

    private async Task<IActionResult> ReadBytes(byte[] bytes, CancellationToken ct)
    {
        var path = Path.Combine(Path.GetTempPath(), $"kupe-{Guid.NewGuid():N}.jpg");
        var temps = new List<string> { path };
        try
        {
            await System.IO.File.WriteAllBytesAsync(path, bytes, ct);
            var lines = new List<string>();
            // Ücretsiz sunucu çok yavaş: önce tek hızlı deneme, numara çıkmazsa ikinci deneme.
            // Hiçbir durumda 500 dönmesin: zaman aşımı/hata olursa o ana kadar okunanı döndür.
            using var budget = CancellationTokenSource.CreateLinkedTokenSource(ct);
            budget.CancelAfter(TimeSpan.FromSeconds(55));
            var attempts = new[]
            {
                ("a", new[] { "-resize", "1000x1000>", "-colorspace", "Gray", "-median", "3", "-normalize", "-threshold", "35%" }, "6"),
                ("c", new[] { "-resize", "1000x1000>", "-colorspace", "Gray", "-normalize" }, "11"),
            };
            string? lastError = null;
            foreach (var (name, convertArgs, psm) in attempts)
            {
                if (budget.IsCancellationRequested) break;
                try
                {
                    var pre = Path.ChangeExtension(path, $".{name}.png");
                    temps.Add(pre);
                    if (!await Run("convert", [path, .. convertArgs, pre], budget.Token)) pre = path;
                    var text = await RunTesseract(pre, psm, budget.Token);
                    if (text is null) return StatusCode(503, new { hata = "Sunucuda yazı okuma kurulu değil." });
                    lines.AddRange(text.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries));
                    if (lines.Any(l => l.Count(char.IsDigit) >= 4)) break;   // numara çıktı, yeter
                }
                catch (Exception ex)
                {
                    lastError = ex.GetType().Name;
                    log.LogWarning(ex, "OCR denemesi {Name} başarısız", name);
                }
            }
            if (lines.Count == 0 && lastError is not null)
                return StatusCode(504, new { hata = "Sunucu yazıyı zamanında okuyamadı. Küpeyi çerçeveye yaklaştırıp tekrar dene." });
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
            try { await p.WaitForExitAsync(timeout.Token); }
            catch (OperationCanceledException) { try { p.Kill(true); } catch { } throw; }
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
            timeout.CancelAfter(TimeSpan.FromSeconds(45));
            var stdout = p.StandardOutput.ReadToEndAsync(timeout.Token);
            var stderr = p.StandardError.ReadToEndAsync(timeout.Token);
            try { await p.WaitForExitAsync(timeout.Token); }
            catch (OperationCanceledException) { try { p.Kill(true); } catch { } throw; }
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
