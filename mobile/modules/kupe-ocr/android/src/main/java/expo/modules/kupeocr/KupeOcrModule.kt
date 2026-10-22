package expo.modules.kupeocr

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.media.ExifInterface
import android.net.Uri
import com.google.mlkit.common.sdkinternal.MlKitContext
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.TextRecognizer
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

class KupeOcrModule : Module() {
  private var recognizer: TextRecognizer? = null

  private fun getRecognizer(): TextRecognizer {
    val existing = recognizer
    if (existing != null) return existing
    val created = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
    recognizer = created
    return created
  }

  /** Fotoğrafı ML Kit'in yardımcılarına bırakmadan kendimiz açıyoruz (bazı cihazlarda fromFilePath çöküyor). */
  private fun loadBitmap(context: Context, uriString: String): Pair<Bitmap, Int> {
    val uri = Uri.parse(uriString)
    val path: String? = when {
      uriString.startsWith("file://") -> uri.path
      uriString.startsWith("/") -> uriString
      else -> null
    }

    // 1) Boyutu öğren, çok büyükse küçülterek aç (bellek taşmasın)
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    if (path != null) {
      BitmapFactory.decodeFile(path, bounds)
    } else {
      context.contentResolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, bounds) }
    }
    val longest = maxOf(bounds.outWidth, bounds.outHeight)
    var sample = 1
    while (longest / sample > 2400) sample *= 2

    val opts = BitmapFactory.Options().apply { inSampleSize = sample }
    val bitmap: Bitmap? = if (path != null) {
      BitmapFactory.decodeFile(path, opts)
    } else {
      context.contentResolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, opts) }
    }
    if (bitmap == null) {
      val exists = path?.let { File(it).exists() } ?: false
      throw IllegalStateException("Fotoğraf çözülemedi (yol: ${path ?: uriString}, dosya var: $exists)")
    }

    // 2) EXIF yönü
    var rotation = 0
    if (path != null) {
      try {
        rotation = when (ExifInterface(path).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)) {
          ExifInterface.ORIENTATION_ROTATE_90 -> 90
          ExifInterface.ORIENTATION_ROTATE_180 -> 180
          ExifInterface.ORIENTATION_ROTATE_270 -> 270
          else -> 0
        }
      } catch (ignored: Throwable) {
        rotation = 0
      }
    }
    return Pair(bitmap, rotation)
  }

  /** Hata mesajına nerede patladığını ekler (ilk birkaç satır) — uzaktan teşhis için */
  private fun describe(e: Throwable): String {
    val where = e.stackTrace.take(4).joinToString(" < ") { "${it.className.substringAfterLast('.')}.${it.methodName}:${it.lineNumber}" }
    return "${e.message ?: e.javaClass.simpleName} [$where]"
  }

  override fun definition() = ModuleDefinition {
    Name("KupeOcr")

    AsyncFunction("recognize") { uri: String, promise: Promise ->
      val context = appContext.reactContext
      if (context == null) {
        promise.reject("E_CONTEXT", "Uygulama bağlamı bulunamadı", null)
        return@AsyncFunction
      }

      // ML Kit'in kendi başlatıcısı bazı cihazlarda çalışmamış olabilir: gerekirse elle başlat
      try { MlKitContext.initializeIfNeeded(context) } catch (ignored: Throwable) { }

      val image: InputImage
      try {
        val (bitmap, rotation) = loadBitmap(context, uri)
        image = InputImage.fromBitmap(bitmap, rotation)
      } catch (e: Throwable) {
        promise.reject("E_IMAGE", "Görüntü açılamadı: ${describe(e)}", e)
        return@AsyncFunction
      }

      try {
        getRecognizer().process(image)
          .addOnSuccessListener { result ->
            val blocks = result.textBlocks.map { block ->
              mapOf(
                "text" to block.text,
                "lines" to block.lines.map { it.text }
              )
            }
            promise.resolve(mapOf("text" to result.text, "blocks" to blocks))
          }
          .addOnFailureListener { e ->
            promise.reject("E_OCR", "Tanıma hatası: ${describe(e)}", e)
          }
      } catch (e: Throwable) {
        promise.reject("E_OCR", "Tanıma başlatılamadı: ${describe(e)}", e)
      }
    }

    OnDestroy {
      recognizer?.close()
      recognizer = null
    }
  }
}
