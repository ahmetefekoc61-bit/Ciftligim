# Çiftliğim — mobil uygulama (Expo / React Native)

## Klasörler
- `src/app/` — ekranlar (dosya adı = ekran yolu, Expo Router)
- `src/components/` — ortak bileşenler (düğme, form alanı, hayvan satırı...)
- `src/lib/` — API istemcisi, oturum, tipler, Türkçe etiketler

## APK oluşturma
Kök klasörde: `npm run mobil:kur` (bir kez), sonra `npm run apk`.
Derleme Expo'nun bulutunda yapılır (10-15 dk). `npm run durum` IP adresini, derleme durumunu ve
bittiyse APK linkini yazar (link `mobile/son-apk.txt` dosyasına da kaydedilir).
Yeni APK'yı yüklemeden önce `app.json`'da `android.versionCode`'u 1 artır.

## ⚠️ İmzalama anahtarı
`ciftligim-release.keystore` ve `credentials.json` APK'nın imzasıdır.
- Git'e girmez (.gitignore'da). **Kaybetme**: kaybolursa telefondaki uygulama güncellenemez,
  silip yeniden kurmak gerekir. Bir kopyasını USB/bulut gibi güvenli bir yere koy.
- Kimseyle paylaşma.
