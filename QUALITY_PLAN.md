# Chronologos — Günlük kullanım kalitesi

Kullanıcı 4 Ekim 2026'da yeni özellikler yerine mevcut ürünü sırayla olgunlaştırmayı onayladı. Codex entegrasyon ve doğrulamadan sorumlu; Antigravity ve yerel Codex ajanları dar görevler alır. Kişisel SQLite arşivi test amacıyla değiştirilmez.

## 1. Günlük akış — ilk düzeltme paketi teslim edildi

- [x] Kitaplık ve Notlar arasındaki normal bağlantılar aynı React belgesinde açılır; Atlas'a giriş/çıkış portal etkisini korur.
- [x] Ctrl/Meta/Shift/Alt, orta tıklama, yeni pencere ve indirme davranışları tarayıcıya bırakılır; aynı URL açık formu yeniden başlatmaz.
- [x] Not/Atlas kaynak kitap bağlantısı ilgili kitap fişini açar.
- [x] Kitaptan not oluşturma formu açık ve doğru kaynak seçili gelir; yeni form açma kaynak seçimini korur.
- [x] Not ve bağlantı adaylarında yazar adına göre arama çalışır.
- [x] Ayrı geçici arşivle tarayıcı kontrolü: kitap oluşturma, kitap kaynaklı not, seçili Atlas yıldızı, doğru kitap fişi, aynı notu düzenleme, yazar araması, geri dönüş.
- [x] Portal/normal gezinme kontrolleri, i18n kontrolleri ve üretim derlemesi geçti. Kurulu web arayüzü yedeklenip güncellendi.

İnceleme kayıtları: `agent-tasks/daily-flow-navigation-review/result.json` (Antigravity Flash Low, bildirilen toplam 12.515 token); Luna salt okunur kayıt/düzenleme/arama incelemesi. Bunlar Codex kota tüketimi ölçümü değildir.

## 2. Ekran tutarlılığı — ilk inceleme paketi teslim edildi

- [x] Goodreads önizlemesi, diğer pencereler gibi açılış odağı, Tab/Shift+Tab döngüsü, Escape ile kapatma ve aktarma düğmesine odak dönüşü kullanır. Geçici CSV önizlemesiyle tarayıcı kontrolü geçti.

- [x] Kitaplık, kitap fişi, yeni kitap ve not formunda tipografi, boşluklar, düğmeler ve hata mesajlarını karşılaştır. Hatalar için ortak `archive-feedback.css`; koyu arşiv ve açık bağlantı kâğıdı için okunaklı renkler. Boş durum mesajları aynı kaldı.
- [x] Klavye odağı ve küçük pencere boyutundaki taşmaları somut ekran kontrolleriyle doğrula. Not/bağlantı formu 540 px, kitaplık/kitap fişi/yeni kitap formu 360 px kontrol edildi; kitaplık 350/350, fiş 332/332, yeni kitap 328/328 clientWidth/scrollWidth. Yatay taşma gözlenmedi.
- [x] Yalnız doğrulanmış pürüzleri düzelt. Katalog arama ve fiş not yükleme hataları alert olarak duyurulur; genel not hatası çalışma/arşiv sekmesinden bağımsız sayfa üstünde görünür; bağlantı kaydetme hatası kendi penceresinde görünür ve girdi korunur. Ayrı API kapatılıp hata tetiklendi, yeniden açılınca aynı formdan kayıt geçti. Dil/gezinti kontrolleri ve üretim derlemesi geçti; kurulu web arayüzüne aktarıldı.

Antigravity CSS incelemesi: `agent-tasks/screen-style-review/result.json`, Flash Low, bildirilen toplam 12.283 token. Luna katalog hata duyurularını inceledi. Kullanılan deneme verileri kişisel arşivden ayrıdır. Bu paket tüm olası ekran/zoom/içerik uzunluğu kombinasyonlarını kapsayan bir erişilebilirlik sertifikası değildir.

## 3. Performans ve kurtarma — bekliyor

- [ ] Kişisel arşivi dış servislere göndermeden, temsili büyük geçici veriyle Atlas kare süresi ve geçiş bekleme süresini ölç.
- [ ] Ölçülen darboğazlara göre optimizasyon uygula ve önce/sonra karşılaştır.
- [x] Güvenli SQLite yedeği ve geri dönüşü geçici arşivde doğrula; kişisel arşivi değiştirme. Canlı WAL yazısı dahil 24 tablo içerik hashleri, 10.000 not/9.999 bağ, bütünlük ve yabancı anahtar kontrolleri geçti. Bozuk kopya reddedildi. Uygulama içi geri yükleme ekranı eklenmedi.

Bu kayıt, tüm ürünün hatasız olduğu veya performans/kurtarma aşamasının tamamlandığı anlamına gelmez.

### 3. aşama — seçim geometrisi ara paketi
- [x] Yıldız seçimi geometrisini yeniden kurma ve değişmeyen bağlantı buffer'ını temizleme sorunu düzeltildi; bağımsız kontroller ve kurulu arayüze aktarım tamamlandı.
- Ölçüm: 10.000 yapay not, 30 farklı seçim; CPU geometri işlemi 4,92–5,92 ms → 0,016–0,018 ms. FPS ve portal bekleme süresi değildir; yukarıdaki tam performans/kurtarma maddeleri hâlâ bekliyor.
- [x] Büyük yapay arşivle üretim önizlemesinde ilk kare aralığı ölçümü: 10.000 not/9.999 bağ, 8 saniye/2032 kare, p50 3,9 ms/p95 4,2 ms/max13,8 ms. Dar ölçüm normal arayüzde kapalıdır. Kurulu Electron ve tüm portal animasyonu ölçümü henüz tamamlanmadığından üstteki tam madde açık kalır.


- 4 Ekim: Yeni not bağlantısı için tek seferlik 600 ms Atlas çizgi akışı eklendi; 20 geçici segment, azaltılmış hareket desteği, eski bağlar/düzenlemeler tetiklemez. İşaret/geometri/portal kontrolleri ve build geçti, kurulu arayüze yedekli aktarıldı. Görsel masaüstü doğrulaması yapılmadı; başlangıç takılması profili açık.
