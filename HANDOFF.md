# Chronologos — Geliştirme devri

Bu dosya yeni bir Codex sohbetinin projeyi kaldığı yerden sürdürmesi için kısa bağlam sağlar. Ürünün genel anlatımı `README.md`, uzun vadeli kapsam ve kabul ölçütleri `PROJECT_PLAN.md` içindedir.

## Ürün amacı

Chronologos, kişisel kitaplık ve notları tam ekran, tablo gibi izlenebilen bir 3D düşünce atlasında birleştirir. Atlas/Quiet Mode görsel imzadır ve ikinci monitörde arayüz kalabalığı olmadan çalışmalıdır. Kitaplık ve Notlar, aynı kişisel veriyi girmek ve yönetmek için ayrı görünümlerdir.

Temel anlamlar:

- Her kayıtlı notun Atlas'ta kalıcı bir yıldız kimliği ve konumu vardır.
- Kullanıcı iki not arasında düşünce ilişkisi kurabilir; gökyüzündeki gerçek kullanıcı verisi budur.
- Arka plan yıldızları ve çizgiler dekoratiftir; tarihsel iddialar taşımaz.
- Dünya, Chronos'un sanat merkezidir. Yazarların gerçek konumları ve kaynaklı tarihsel etki ilişkileri henüz veri olarak eklenmemiştir.
- Şimdilik AI, embedding, Neo4j, hesap sistemi veya çok kullanıcılı erişim yoktur. İlk dilim yerel SQLite verisiyle çalışır.

## Şu anki uygulama

- `/` ve `/atlas`: 3D Atlas; her veritabanı notu yıldız olarak yerleştirilir, yıldız seçimi nota bağlı kart açar, yeni not kısa bir parıltıyla sahneye gelir, boşta kalınca seyrek eski not hatırlatılır.
- `/library`: kitap ekleme/düzenleme/silme, arama ve okuma durumu.
- `/notes`: kaynaklı not/alinti, kişisel yorum, temalar, elle kurulan not bağlantıları, JSON dışa aktarma ve eski-not hatırlatma tercihi.
- Sol üst arşiv portalı Kitaplık veya Notlar seçimi sunar. Son düzenlemede portal yaklaşık 1,4 kat büyütüldü, göksel küre üzerindeki 3D noktaya bağlandı; nebula bükülmesi o noktanın izdüşümünü izliyor. “Arşiv” etiketi hover, klavye odağı veya açık menüde görünmeli.
- SQLite yerel dosyası `server/data/chronologos.sqlite`; Git dışında. `npm run db:seed` dört demo kitap ve dört örnek düşünce ekler, tekrar çalıştırılınca çoğaltmaz.

## Geliştirme ortamı

- Node.js `24.14+` (`.node-version`)
- `npm ci`
- `npm run dev` — API `127.0.0.1:4178`, Vite `127.0.0.1:5173` (Vite boş port bulmak için numarayı artırabilir).
- Açık preview sekmesi son olarak `http://localhost:5174/atlas` adresindeydi. Kaynak güncellendikten sonra bu adresi yenileyip kontrol et; sekmenin gerçekten güncel sürümü gösterdiğini doğrula.
- API portu kullanımda ise `API_PORT=4179 npm run dev` ile yeniden başlatılabilir.
- `npm run build` 2026-09-26 tarihinde başarılı oldu. Rollup, yaklaşık 1 MB olan AtlasApp chunk'ı için boyut uyarısı veriyor; derleme hatası değil.
- Otomatik test script'i tanımlı değil. Projede manuel görsel/akış kontrolü yapılmalı.

## İlk devam adımları

1. **Portal görsel QA:** 5174'te hard refresh yap. İmleç uzaktayken Arşiv etiketi gizli olmalı; hover ve klavye odağında görünmeli; tıklayınca menü açılmalı. Görsel merkez yaklaşık sol %7 / üst %12 civarında ve önceki sürümden belirgin büyük olmalı. Nebula bükülmesi halka/portalın altında kalmalı. Bu değişiklik yakın zamanda işlendiği için eski ekran görüntüsü veya açık sekme yanıltabilir.
2. **Kısa uçtan uca kontrol:** Kitap oluştur/düzenle/sil; kitap kaynağıyla not ve alıntı ekle; temayı ve bağlantıyı değiştir; notu Atlas yıldızında aç; yenileme sonrasında yıldız konumunun korunduğunu doğrula; JSON dışa aktar ve iki sekmede güncellemeyi kontrol et.
3. **JSON içe aktarma/geri yükleme:** Dışa aktarma şemasını sürümle, hatalı veya kısmi arşivde tüm işlemi geri alacak güvenli doğrulama/transaction ekle; mevcut veriyi ezme politikasını açık tasarla.
4. **Paylaşıma açmadan önce:** Kimlik doğrulama, her API işleminde sahiplik kontrolleri, yedekleme/geri yükleme ve kullanıcı verisi silme akışını tamamla. Bunlar bitmeden internete açma.
5. Bunlardan sonra doğrulanmış Chronos yazar/coğrafya/tarih verisini; daha ileride gerekçesi gösterilen, kullanıcı tarafından kabul/ret edilen semantik ilişki önerilerini ele al. Otomatik AI bağlantısını ve grafik altyapısını ilk iş olarak ekleme.

Yeni sohbette başlangıç mesajı olarak: **“Chronologos repo'sunda devam et. Önce `HANDOFF.md`, sonra `README.md` ve `PROJECT_PLAN.md` dosyalarını oku. 5174 portal görsel QA adımıyla başla; mevcut yerel SQLite verisini koru.”**
