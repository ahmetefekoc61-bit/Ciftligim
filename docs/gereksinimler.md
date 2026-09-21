# Çiftliğim — Gereksinimler (v0.2)

Tarla ve hayvan kayıtlarını tutan, çok kullanıcılı mobil uygulama. **Uygulama internet bağlantısıyla çalışır** (çevrimdışı mod yok).
Uygulama açılınca iki modül var: **Tarım** ve **Hayvancılık**.

Veritabanı şeması: `ciftligim_schema.sql` (PostgreSQL, test edildi)

---

## 1. Kullanıcılar ve roller

- Uygulamaya e-posta ya da telefonla giriş yapılır.
- Bir **işletmenin** (çiftlik) birden fazla üyesi olabilir, bir kullanıcı da birden fazla işletmede yer alabilir.
- Hayvanlar işletme içinde **sürülere** ayrılır. Çobanlar sürü bazında yetkilendirilir.

| Rol | Görür | Kayıt ekler |
|---|---|---|
| Sahip (owner) | Her şeyi | Her şeyi; üye ekler, çoban atar |
| Yönetici (manager) | Her şeyi | Her şeyi (üye yönetimi hariç) |
| Çoban (shepherd) | Yalnızca atandığı sürülerdeki hayvanları | Tedavi, ilaç, aşı, hastalık, konum (mera/ahır), yavrulama, tartım. **Hayvan ekleyemez, silemez, kimlik bilgisini değiştiremez.** |
| İzleyici (viewer) | Her şeyi | Hiçbir şey |

- Her kaydın yanında **kimin ve ne zaman girdiği** saklanır ve gösterilir.

## 2. Hayvancılık

**Türler:** köpek, eşek, inek/sığır, keçi, koyun. Yeni tür eklenebilir.

**Kayıt oluşturma**
- Küpe numarası kamerayla taranır (OCR veya barkod). Ulusal küpe formatı: `TR` + rakamlar.
- İlk kayıtta bilgiler bir kez elle girilir: tür, ırk, cinsiyet, doğum tarihi (tahmini olabilir), anne/baba, renk-işaret, fotoğraf.
- **Yaş veritabanında saklanmaz.** Doğum tarihinden her sorguda hesaplanır, böylece kendiliğinden güncel kalır.
- Köpek ve eşekte küpe yerine mikroçip ya da isim kullanılabilir.

**Hayvan profili** (hayvana tıklayınca açılan sayfa)
- Kimlik bilgileri, yaş, ırk, cinsiyet, sürü
- Güncel konum (mera / ahır) ve konum geçmişi
- **Son tartım tarihi ve kilosu**, altında tartım geçmişi
- Anne, baba ve yavrular
- Yavrulama geçmişi: tarih, yavru sayısı, canlı sayısı, doğum zorluğu
- **Sağlık zaman çizelgesi:** hastalıklar ve tedaviler tarih sırasıyla, en yenisi üstte
- Durum: aktif / satıldı / öldü / kesildi / kayıp

**Tedavi kaydı** (çoban sahadan girer)
- Tür: ilaç, iğne, aşı, parazit, vitamin, diğer
- İlaç listeden seçilir. Listede yoksa adı serbest yazılır.
- Doz sayı olarak, birim (ml, mg, tablet…) ayrı alanda girilir.
- Uygulama yolu (deri altı, kas içi, ağızdan, dökme)
- Serbest açıklama, örneğin "Ivomec vuruldu, 4 ml"
- Tedavi bir hastalık kaydına bağlanabilir.
- **Toplu uygulama:** tüm sürüye aynı gün yapılan ilaç tek işlemle girilir (`batch_id`).

**Arınma süresi uyarısı**
- İlaç kataloğunda et ve süt arınma süresi (gün) tutulur. Değer ilacın prospektüsünden girilir.
- Tedavi girilince "şu tarihe kadar kesilmez / sütü satılmaz" tarihi otomatik hesaplanır.
- Bu tarihler kayıt anında saklanır, katalog sonradan değişse de geçmiş kayıtlar bozulmaz.
- Arınması devam eden hayvanlar listelenir, süre bitince bildirim gönderilir.

## 3. Tarım

**Tarla (parsel) kaydı**
- İl, ilçe, mahalle/köy, ada, parsel, mevki, takma ad ("Dere tarla"), alan (m²)
- Sahiplik: tam mülk / hisseli (pay oranıyla) / kiracı / ortakçı / diğer
- Tapudaki malik adı
- Kira ve ortakçılık sözleşmeleri: karşı taraf, başlangıç-bitiş, şartlar, bedel, sözleşme taraması

**Yıllara göre ekim**
- Yıl, ürün (ya da nadas), çeşit, ekili alan, ekim ve hasat tarihi, verim (kg)
- Dekar başına verim otomatik hesaplanır, yıllar arasında karşılaştırılır.

**Tarlaya yapılan işlemler**
- Sürüm, ekim, gübreleme, ilaçlama, sulama, hasat, diğer
- Tarih, kullanılan ürün, miktar-birim, maliyet, açıklama, kaydı giren kişi

**Harita ve uydu görüntüsü**
- TKGM Parsel Sorgu'dan ada/parsel ile sınır poligonu çekilir, GeoJSON olarak saklanır.
- Poligonun merkez koordinatı hava durumu sorgusu için de kullanılır.
- Uydu görüntüsü harita katmanı olarak gösterilir. İleride Sentinel-2 ile bitki gelişim (NDVI) takibi eklenebilir.
- ⚠️ TKGM'nin resmî ve açık bir API'si olup olmadığı, kullanım koşulları doğrulanmalı. Olmazsa parsel sınırı haritada elle çizdirilir.

## 4. Hava durumu ve bildirimler

- Her tarla için koordinata göre tahmin çekilir (ör. Open-Meteo, MGM).
- **Bildirimler kurala dayalıdır**, yapay zekâ yalnızca açıklama metnini zenginleştirir. Örnek kurallar:
  - Önümüzdeki 24–48 saatte hafif yağış bekleniyor → gübre atmak için uygun zaman
  - Şiddetli yağış bekleniyor → gübre yıkanabilir, ertele
  - Rüzgâr yüksek ya da 6 saat içinde yağış var → ilaçlama yapma
  - Don riski var → uyarı
- Hayvan bildirimleri: arınma süresi bitti, aşı zamanı geldi, beklenen doğum tarihi yaklaştı
- Aynı uyarı tekrar gönderilmez (`dedupe_key`).

## 5. Yapay zekâ asistanı

- Sohbet hayvan profilinden ya da tarla sayfasından açılır. O hayvanın veya tarlanın kayıtları bağlam olarak modele verilir.
- Hayvan tarafı: sağlık geçmişine bakarak fikir verir, hangi belirtide veterinere başvurulması gerektiğini söyler.
- Tarla tarafı: ürün, dönem, geçmiş verim ve hava durumuna göre ipuçları verir.
- ⚠️ Asistan **fikir verir, karar vermez.** İlaç ve doz kararı veterinerindir; bu not ekranda gösterilir.
- Sohbet geçmişi saklanır.

## 6. Veritabanı özeti

| Alan | Tablolar |
|---|---|
| Kullanıcı / yetki | `users`, `farms`, `farm_members`, `herds`, `herd_assignments` |
| Hayvan | `species`, `breeds`, `animals`, `animal_location_events`, `birth_events`, `animal_weights` |
| Sağlık | `medicines`, `illnesses`, `treatments` (+ arınma tetikleyicisi) |
| Tarım | `provinces`, `districts`, `neighborhoods`, `parcels`, `parcel_leases`, `crops`, `crop_seasons`, `field_operations` |
| Bildirim / YZ | `notifications`, `ai_conversations`, `ai_messages` |
| Görünümler | `v_animals` (yaş + güncel konum + son tartım), `v_health_timeline`, `v_active_withdrawals`, `v_parcel_yields` |
| Yetki | `can_access_animal(user, animal)`, `can_manage_animals(user, farm)` |

## 7. Teknoloji (kararlaştırıldı)

| Katman | Seçim | Neden |
|---|---|---|
| Mobil | React Native + Expo (TypeScript) | Tek kod tabanıyla Android ve iOS. Kamera, harita ve bildirim kütüphaneleri olgun. |
| Backend | ASP.NET Core Web API (C#) | Türkiye'de backend iş ilanlarında yaygın, hızlı ve tip güvenli. |
| Veritabanı | PostgreSQL + EF Core | Şema C# sınıflarıyla tanımlanır, migration'larla sürümlenir. `ciftligim_schema.sql` bu tasarımın planıdır. |
| Kimlik doğrulama | JWT | |
| Kod deposu | Git + GitHub (tek repo: `mobile/`, `backend/`) | |

## 8. Yol haritası

Her aşamanın sonunda çalışan bir şey olacak.

0. **Kurulum:** Git, Node.js, .NET SDK, PostgreSQL, VS Code, telefonda test ortamı
1. **Backend iskeleti:** API projesi, veritabanı bağlantısı, kayıt ve giriş
2. **Hayvancılık MVP:** hayvan ekleme ve listeleme, hayvan profili, tedavi/tartım/konum kaydı, çoban atama
3. **Küpe tarama:** kamera + metin tanıma
4. **Tarım modülü:** tarla, yıllara göre ekim, tarlaya yapılan işlemler
5. **Hava durumu ve bildirimler**
6. **Yapay zekâ asistanı**
7. **Yayına alma:** sunucu, Play Store / App Store, KVKK aydınlatma metni

## 9. Kararlar

- Uygulama yalnızca internetle çalışır.
- Tartım takibi var: tarih ve kilo.
- Çoban hayvan ekleyemez ve silemez.
- Gelir-gider modülü ileride eklenecek.

## 10. Açık sorular

- Süt verimi ve kırkım takibi istenecek mi?
