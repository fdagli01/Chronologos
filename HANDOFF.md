# Chronologos — Geliştirme devri

Bu dosya yeni bir Codex sohbeti için kısa, güncel bağlam sağlar. Ürün özeti `README.md`, tamamlananlar ve yapılacaklar `PROJECT_PLAN.md` içindedir.

## Mevcut teslim

- Ekran tutarlılığı ilk inceleme paketi kurulu web arayüzüne aktarıldı: ortak hata kutusu stili, katalog hataları alert, genel not hatası sayfa üstünde, bağlantı kaydetme hatası pencerenin içinde. 360/540 px dar pencere ve ayrı test API'si kapatılarak hata/yeniden kayıt senaryosu doğrulandı. Performans ve kurtarma sıradaki aşama; ayrıntılar `QUALITY_PLAN.md` içinde.

- Günlük akış ilk paketi kurulu web arayüzüne aktarıldı: Kitaplık/Notlar belge yenilemeden gezinir, Atlas portalını korur; değiştirilmiş tıklamalar tarayıcıya bırakılır. Kaynak kitap bağlantısı ilgili fişi açar, kitaptan yeni not formu doğru kaynakla açık gelir, not araması yazar adını da içerir. Ayrı geçici arşivde oluşturma/düzenleme/arama/Atlas/geri dönüş kontrol edildi. Onaylı üç aşamalı kalite çalışmasının ilerlemesi `QUALITY_PLAN.md` içinde; sonraki ekran tutarlılığı ve performans/kurtarma aşamaları henüz tamamlanmadı.

- Portal geçişleri aynı React belgesinde History API ile çalışır; Atlas modülü çıkış animasyonu sırasında yüklenir. Varış örtüsü sahnenin ilk kareleri ve ilk API isteği tamamlanınca açılır (6 saniye güvenlik süresi). Portal 360/420 ms, yeni not 640/600 ms; CSS yalnızca transform/opacity hareketleri kullanır. Kontrol: `node scripts/portal-transition-check.mjs`.

- Türkçe varsayılan; İngilizce/Almanca arayüz seçimi `chronologos:language` localStorage anahtarında saklanır. Dil seçimi Kitaplık/Notlar yan menüsünde ve Atlas ayarlarında; ekranı yeniden yüklemeden uygulanır. Kullanıcı içerikleri ve SQLite alanları aynı kalır. Altyapı/sözlükler `src/i18n`, metin/yer tutucu kontrolü `node scripts/i18n-audit.mjs`.

- Yerel Windows masaüstü uygulaması ve web geliştirme modu. Electron kurulumundan ayrı kullanıcı verisi `%APPDATA%\Chronologos\chronologos.sqlite` içinde; geliştirme veritabanı `server/data/chronologos.sqlite` konumunda.
- `/` ve `/atlas`: tam ekran 3D Atlas; not yıldızları ve düşünce bağları, seçili yıldız kartı, not hatırlatması, kitap coğrafya işaretçileri ve kümeleri.
- `/library`: Goodreads CSV önizlemeli aktarım, Open Library eser/baskı arama, kapakları kitap ayrıntısında gösterme, kitap rafları, okuma durumları/ilerlemesi, yıllık hedef ve yazar pusulası.
- `/notes`: kaynaklı düşünce/alinti kayıtları, kalıcı Nebula taslakları, düzenlenebilir beş tür düşünce bağı, Günün Unutulmuş Yıldızı ve JSON dışa aktarma.
- Yeni not başarılı kaydedildikten sonra kullanıcıyı Atlas'a taşıyan geçiş var; azaltılmış hareket tercihi dikkate alınır.
- Kitap hikâye konumu ve yazım şehri kitap kaydına eklenebilir. Okunmuş kitap işaretçileri isteğe bağlı olarak Atlas'ta gösterilir; yakın işaretçiler küme açar. Küre son seçilen konuma yumuşakça döner ve kuzeyi korur.
- JSON arşivi `schemaVersion: 8`; kitap ve baskı bilgileri, okuma sayfası/yüzdesi, yıllık hedef, pusula ve hikâye konumu alanları, notlar/taslaklar, temalar, hatırlatma kayıtları ve Atlas yerleşimlerini içerir. JSON içe aktarma yoktur. `localStorage` tercihler ve anı geçmişi arşivin dışında kalır.
- Yerel AI önerileri isteğe bağlıdır; yalnızca kullanıcı isterse aynı makinedeki Ollama'ya gider. Öneriler kullanıcı onaylamadan bağlantı olarak kaydedilmez.

## Veri koruma

- Kurulu uygulama güncellemeleri normalde `%APPDATA%\Chronologos` verisini korur. Kişisel arşiv Git'e girmez.
- Uygulama içindeki JSON indirmesi taşınabilir veri dökümüdür, henüz geri yüklenemez. Tam kurtarma için uygulamayı kapatıp `chronologos.sqlite` dosyasını kopyala; WAL açıkken uygulama çalışırken yalnızca ana dosyayı kopyalama.
- Kod/akış kontrolü için ana kişisel veritabanı yerine `DATABASE_PATH` ile ayrı bir SQLite kopyası kullan.

## Geliştirme

- Node.js `24.14+`; `npm ci` ile bağımlılıkları kur.
- `npm run dev` API'yi `127.0.0.1:4178`, Vite'ı boş yerel porta açar. `npm run desktop:dev` masaüstü penceresini başlatır.
- `npm run build` üretim derlemesi; `npm run desktop:installer` Windows kurucusu üretir. Projede ayrı otomatik test/lint script'i tanımlı değil.
- Son kaynak commit'i `0d3fbde` (`feat: deliver desktop reading atlas with book discovery and note transitions`). Commit kapsamı masaüstü kabuğu, kütüphane/not/Atlas özellikleri ve bu teslim öncesi birikmiş değişikliklerdir.
- 2 Ekim 2026: Görsel sürüm 0.1.4 hazırlandı. Yeni logo, ortak arşiv gezinmesi ve kalıcı Raf/Kapaklar seçimi kaynakta mevcut; Windows kurucusu `release/Chronologos-Setup-0.1.4.exe` olarak üretilir.

## Son kullanıcı kararı

Son görsel değişiklikler kurulu masaüstü uygulamasının web arayüzüne aktarıldı; önceki web dosyalarının yedeği Codex çalışma klasöründe alındı. 0.1.4 kaynak sürümü ve Windows kurucusu bu görsel değişiklikleri içerir. 0.1.5 sürümünde okumaya devam paneli ve özel koleksiyonlar uygulandı. Okuma zaman çizelgesi 0.1.7 sürümünde Yıldız Yolu olarak uygulandı. Kitaplar arası bağlantı görünümü TODO olarak bekliyor. Koleksiyonlar migration 010 ile SQLite içinde saklanır; JSON şema 8 koleksiyonları ve kitap üyeliklerini içerir. Ayrıntılı kapsam ve tamamlanma ölçütleri `PROJECT_PLAN.md` içindedir.

## Sıradaki işler

1. TODO bölümündeki kitaplar arası bağlantı görünümünü uygula. Sürüm tesliminde yerel klonda `npm run build` ve `npm run desktop:installer` çalıştırıp gerçek masaüstü uygulamasında `/atlas`, kitaplık ve yeni not geçişini gözle kontrol et.
2. JSON içe aktarmayı ve uygulama içi güvenli SQLite snapshot alma/geri yüklemeyi tasarla. Önce yedek almalı, doğrulamalı ve mevcut arşivi ancak kullanıcı onayıyla değiştirmeli.
3. Büyük Atlas bundle'ını ve yoğun Avrupa işaretçilerinin farklı zoom/kamera açılarındaki okunabilirliğini görsel olarak gözden geçir.
4. İnternete veya başka kullanıcılara açmadan önce kimlik doğrulama, API sahiplik kontrolleri, hesap silme ve dağıtım güvenliğini tamamla.

Başlamadan önce `README.md` ve `PROJECT_PLAN.md`'yi oku. Yerel SQLite verisini sıfırlama veya seed verisiyle değiştirme.

## 0.1.6 düzeltmesi

Raf/Kapaklar geçişinde Raf doğrudan kitap sırtlarını gösterir. Uygulama ve favicon yeni `chronologos-mark-celestial.svg` adresini kullanır; Windows ICO aynı C/yıldız çiziminden üretildi.

## 0.1.7 — Yıldız Yolu

Yeni bölüm: Kitaplık → Yıldız Yolu (`/library?view=timeline`). Yıl/tür/tarih filtreleri, yıllık özet, aylık ritim, mevsimli yıldız yolu, ortak kaynak kitabına ait not bağları, kâğıt fişleri ve tarihsiz bulutsu eklendi. `server/reading-history.js` sahipliğe göre timeline/geçmiş API verisini üretir; migration 011 bilinen bitişleri geri dönük korur. Yeniden okuma ve Goodreads aktarımı okuma geçmişine kaydolur. Ayrı okuma bitişi tarihleri fişten düzenlenir. Yıl özeti demo kayıtları dışlar; çizelge demo kayıtlarını etiketler. JSON şema 8 etkin oturum kimliği ve oturum tamamlanma alanını içerir. Eski sürümlerde üzerine yazılmış geçmiş tarihler geri üretilemez.

## 4 Ekim — Atlas seçim düzeltmesi
Yıldız seçiminde tüm konum/renk geometrisinin tekrar oluşturulması kaldırıldı. Yalnız eski/yeni seçili ve yeni-not işaretleri güncellenir; yıldız/bağlantı temizleme etkileri ayrıldı. Luna uygulaması kaynakta doğrulandı (eksik stars importu entegrasyonda düzeltildi). Antigravity yalnız izin verilen kısa kod özetini araçsız inceledi: agent-tasks/atlas-selection-review/result.json, toplam 11.974 token; genel risk iddiaları doğrulanmış hata kabul edilmedi.
10.000 yapay not ve 9.999 ilişkiyle 30 değişimde CPU geometri yeniden kurma ortalaması 4,92–5,92 ms; indeksli güncelleme 0,016–0,018 ms. Bu bir geometri mikro ölçümüdür, FPS/GPU/geçiş ölçümü değildir. Maske değiştirme/temizleme/bilinmeyen kimlik/statik buffer/sonlu bağlantı konumu kontrolleri, portal/dil kontrolleri ve üretim derlemesi geçti. Ayrı boş geçici arşivle Atlas üretim önizlemesi açıldı, konsol hatası gözlenmedi. Kurulu web arayüzü yedeklenip 12 dosya hash kontrolüyle aktarıldı: agent-tasks/atlas-selection-install-result.json. Kişisel SQLite arşivi değiştirilmedi.
Sıradaki dar paket: büyük arşivle gerçek kare/geçiş ölçümü. Güvenli yedek/geri yükleme henüz tamamlanmadı.

## 4 Ekim — Büyük arşivde kare ölçümü
Luna dar görevle yalnız ?atlasBench=1 için AtlasPerformance ölçüm bileşenini hazırladı. Entegrasyonda 3D/DOM portal uyumu düzeltildi (drei Html), yalnız veri ve sahne hazır olduktan sonra ölçme eklendi; sekiz saniyeyi erken kesen örnek limiti yükseltildi. Composer son çizimini tüm sahne gibi gösteren gl.info sayaçları kaldırıldı. Normal kullanımda bileşen monte edilmez.
Kişisel veriden ayrı agent-tasks/atlas-benchmark.sqlite: 10.000 yapay not, 9.999 bağ. Üretim önizlemesi, IAB, DPR1.25: 8 saniye/2032 kare; p50 3,9 ms, p95 4,2 ms, en uzun13,8 ms. İlk üç sahne karesi navigasyondan1568,4ms sonra; veri hazır olma ve tüm portal animasyonu dahil değildir. Sonuç agent-tasks/atlas-frame-measurement.json. Bu örnekte sürekli takılma bulunmadı; GPU zamanı veya kurulu Electron performansı eşitliği iddia edilmez. Portal/yerelleştirme/geometri kontrolleri ve derleme geçti. Tam portal/Electron ölçümü ve yedek geri yükleme hâlâ bekliyor.

## 4 Ekim — SQLite kurtarma doğrulaması
Luna dar görevle kurtarma kontrolünü hazırladı; entegrasyonda scripts/archive-recovery-check.mjs konumuna alındı, geçici silme hedefi kontrolü ve canlı kaynakla tüm tablo/hash karşılaştırması eklendi. Son çalışma geçti: canlı WAL 4.152 bayt; node:sqlite backup ile snapshot, yeni geçici dosyaya geri koyma, integrity_check=ok/FK hatası0, 24 tablo tüm satır içerik hashleri eşleşti. 10.000 not/9.999 bağlantı/10.000 Atlas düğümü ve son yazılan marker korundu. Kesilmiş yedek reddedildi. Sonuç agent-tasks/archive-recovery-result.json. Yalnız yapay fixture kullanıldı, kişisel arşiv değiştirilmedi. Bu paket doğrulama aracıdır; uygulama içinde yedek/geri yükleme arayüzü henüz yok. Üretim kaynak davranışı değişmediği için yeniden kurulum gerekmedi. Sırada tam portal geçişi/kurulu Electron ölçümü kalıyor.

## 4 Ekim — Tam portal ölçümü
Luna dar görevle portalBench=1 ölçümü hazırladı. Normal gezinmede ölçüm RAF'ı çalışmaz; geçiş başlangıcı → lazy preload/çıkış → veri ve üç kare hazır → kapak kaldırılma süreleri ve RAF kare aralıkları raporlanır. VM portal harnessine yeni bağımlılık stub'ları eklendi; portal/dil/geometri kontrolleri ve derleme geçti. Yapay10.000not/9.999bağ üretim önizlemesi IAB: route360,7ms, ready1602ms, toplam2024,9ms, p95kare7,8ms, max701,9ms. İlk açılışta belirgin uzun kare var. Drei Preload all kaldırma denemesi üç ölçümde tutarlı iyileşmedi (max588/486/922ms); değişiklik geri alındı. Kayıt agent-tasks/portal-measurement-result.json. Masaüstü native kontrolü kapalı olduğundan Electron ölçümü tamamlanmış sayılmaz. Sonraki dar görev başlangıçta geometri/tekstür/shader sürelerini ayrı ölçmek; tahmini optimizasyon uygulanmadı.

## 4 Ekim — Yeni not bağı ışık akışı
Kitap koleksiyonları kütüphanede kategorileme/çoklu üyelik ve filtreleme içindir. Yeni not bağlantısı başarılı POST sonrası tek bekleyen işaret oluşturur; düzenleme/hata/eski bağlantılar tetiklemez. Atlas ilk dönüşte veya canlı sinyalde, veri+sahne+iki uç hazır ve geçiş perdesi kapandıktan sonra 600 ms çizgi akışı gösterir. İşaret iki dakika sonra geçersizleşir; hareket azaltma tercihinde efekt çizilmez. Yalnız 20 geçici segment, kare başına drawRange/opaklık; React kare güncellemesi veya animasyon için ana geometri yeniden oluşturma yok. Luna uyguladı, Codex kaynak/entegrasyon kontrolü yaptı; bu pakette Antigravity kullanılmadı.
Tek sefer tüketme, süre aşımı, hatalı işaret, düzenleme ve normal/aynı/karşıt uç geometri kontrolleri; portal kontrolü ve üretim derlemesi geçti. Gerçek masaüstü animasyonu görsel olarak doğrulanmadı. Kurulu web arayüzü yedeklendi, 12 dosya hash kontrolüyle aktarıldı: agent-tasks/link-animation-install-result.json. Kişisel veritabanı değiştirilmedi. Önceki 702 ms başlangıç takılmasının ayrı profili hâlâ sırada.
