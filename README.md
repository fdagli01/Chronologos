# Chronologos

> **Okuduklarından doğan düşünceleri yaşayan bir gökyüzüne dönüştüren kişisel bir düşünce atlası.** Her not bir yıldız, aralarında kurduğun anlamlı ilişkiler ise takımyıldızlarının parçalarıdır.

Chronologos, kitapları bitirilmiş görevler olarak saymak yerine onlardan kalan düşünceleri, alıntıları ve bağlantıları korur. Projenin sanatsal imzası, ikinci bir ekranda sessizce açık kalabilen tam ekran 3D Atlas'tır. Kitaplık ve Notlar görünümleri, bu evrenin kişisel verilerle beslenmesini sağlar.

## Ürün döngüsü

**Kitap ekle → alıntı veya düşünce kaydet → Atlas'ta yıldızını bul → düşünceler arasında bağ kur → eski bir fikri yeniden keşfet.**

Atlas, aynı içeriğin başka bir gösterimi olmanın ötesinde, notların mekânsal ilişkilerini keşfetmeye yarar. Kütüphane ve not düzenleme ekranları işlevsel kullanım için ayrı tutulur; Atlas'ın üzerinde sürekli bir menü veya kontrol paneli bulunmaz.

## Üç görünüm

- **Atlas — `/` ve `/atlas`:** Tam ekran, yavaş hareketli 3D sahne. Ortadaki antik atlas estetiğindeki dünya Chronos'u; çevresindeki yıldızlar ve düşünce bağları Logos'u temsil eder. Sol üstteki karadelik benzeri portal, üzerine gelince beliren “Arşiv” etiketiyle Kitaplık veya Notlar görünümüne geçiş sunar.
- **Kitaplık — `/library`:** Kitap ekleme ve düzenleme, arama, okuma durumu, puan ve kısa değerlendirme alanı.
- **Notlar — `/notes`:** Düşünce veya alıntı kaydetme; kaynak, sayfa/bölüm bilgisi, kişisel yorum, tema ve diğer notlarla elle kurulan ilişkileri yönetme alanı.

Görünümler aynı yerel API'yi ve veritabanını kullanır. Atlas ile Kütüphane ayrı sekmelerde veya pencerelerde açık kalabilir.

## Görsel dil ve verinin anlamı

- **Dünya / Chronos:** Fikirlerin tarihsel ve coğrafi köklerini temsil eden sanatsal merkez. Mevcut dünya görseli yazar konumlarının veya doğrulanmış tarihsel rotaların veri haritası değildir; bu kayıtlar henüz uygulamaya eklenmedi.
- **Not yıldızları / Logos:** Her kayıtlı notun Atlas'ta kalıcı bir kimliği ve konumu olan bir yıldızı vardır. Var olan yıldızların yeri, yeni not eklendiğinde değişmez.
- **Düşünce bağları:** Kullanıcının iki not arasında kurduğu ilişkilerdir. Otomatik AI/embedding bağlantısı değildir.
- **Dekoratif gök:** Arka plandaki süs yıldızları ve takımyıldızları kişisel not olarak seçilemez. Görsel rotalar da tarihsel bir iddia taşımaz.

Yeni bir not kaydedilince yıldızı kısa bir parıltıyla sahneye gelir. Bir yıldız seçilince not kartı açılır, yıldız nabız gibi vurgulanır ve karta ince bir izdüşüm çizgisi uzanır. Atlas boşta ve sekme görünür durumdayken arada eski bir not hatırlatma kartı belirir; bu özellik Notlar görünümünden kapatılabilir. Portal geçişi, klavye odağı ve azaltılmış hareket tercihi desteklenir.

## Mevcut özellikler

- Kitap ve baskı/künye bilgilerini yerel veritabanında saklama; kitap ekleme, düzenleme, silme, arama ve okuma durumuna göre filtreleme.
- Kaynağa bağlanabilen alıntı ve düşünceler; alıntı metni ile kişisel yorumu ayrı alanlarda tutma.
- Tema filtreleri ve notlar arasında kullanıcı tarafından kurulan, tür ve gerekçe içerebilen bağlantılar.
- Kalıcı Atlas yıldızları, yeni yıldızın sahneye gelişi, not kartı ve aralıklı eski not hatırlatmaları.
- Kişisel kitaplık, notlar, temalar ve Atlas yerleşimleri için JSON dışa aktarma.
- Sekmeler arası güncelleme bildirimi ve periyodik yenileme.

İlk veri dilimini görmek için `npm run db:seed` komutuyla dört kitap ve dört özgün örnek düşünce eklenebilir. Seed işlemi tekrarlanabilir; aynı örnek kayıtları çoğaltmaz. Örnek içerikler demo olarak işaretlenir.

## Teknoloji ve mimari

- **Arayüz:** React 18, Vite, Tailwind CSS 4.
- **3D:** Three.js, React Three Fiber, Drei ve `@react-three/postprocessing` Bloom.
- **Yerel API:** Node.js HTTP sunucusu ve `node:sqlite`.
- **Veritabanı:** SQLite; SQL migration'ları `server/migrations/` altında tutulur.
- **Akış:** React görünümleri → `/api` yerel API'si → SQLite. Not yazıldığında kalıcı yıldız konumu veritabanına kaydedilir; Atlas bu veriyi API'den alır.

SQLite dosyası `server/data/chronologos.sqlite` konumunda oluşturulur ve Git'e eklenmez. Geliştirme sunucusu API'yi `127.0.0.1:4178` üzerinde, Vite arayüzünü ise kullanılabilir `127.0.0.1` adresinde açar. Vite 5173 kullanımdaysa bir sonraki portu seçebilir; terminalde yazan adresi açın. API portu doluysa `API_PORT=4179 npm run dev` ile farklı bir port seçilebilir.

## Yerel kurulum

Node.js **24.14 veya üstü** gerekir (`.node-version` dosyası proje sürümünü belirtir).

```bash
npm ci
npm run db:seed   # İsteğe bağlı demo kitap ve düşünceler
npm run dev
```

Terminalde gösterilen Vite adresini açın; çoğunlukla `http://localhost:5173/`. Çalışan uygulama örneği için doğrudan `/atlas`, `/library` veya `/notes` yoluna gidebilirsiniz.

Arayüz ve API ayrı terminallerde çalıştırılacaksa:

```bash
npm run dev:api
npm run dev:ui
```

Üretim derlemesini ve önizlemesini çalıştırmak için:

```bash
npm run build
npm run preview
```

## Proje haritası

- `src/scene/Chronos.jsx` — dünya küresi, antik atlas dokusu ve halkalar.
- `src/scene/earthTexture.js` — dünya dokusunun oluşturulması.
- `src/scene/Logos.jsx` — dekoratif ve kişisel yıldızlar, seçili notlar ve düşünce bağları.
- `src/scene/CelestialSphere.jsx` — ortak gök hareketi, portalın 3D izdüşümü ve seçili yıldızın karta bağlanması.
- `src/scene/NebulaBackdrop.jsx` — tam ekran nebula görseli ve portal çevresindeki mercek bükülmesi.
- `src/scene/ArchivePortal.jsx` — Kitaplık/Notlar portalı ve geçiş menüsü.
- `src/scene/AtlasApp.jsx` — Atlas sahnesi, API verisi ve not kartları.
- `src/library/LibraryApp.jsx`, `src/library/NotesApp.jsx` — kitaplık ve not yönetimi.
- `server/migrations/` — SQLite şema sürümleri.
- `server/database.js`, `server/index.js`, `server/thoughts.js` — veritabanı, yerel API ve not/Atlas kuralları.
- `server/seed.js` — tekrar çalıştırılabilir örnek veri.
- `PROJECT_PLAN.md` — ürün kapsamı, veri modeli ve aşamaların ayrıntılı planı.
- `HANDOFF.md` — yeni bir geliştirme sohbeti için mevcut durum ve ilk devam adımları.

## Kapsam ve güvenlik sınırları

Bu sürüm tek kullanıcılı, yerel bir prototiptir. Şemada kullanıcı sahipliği alanları bulunsa da oturum açma ve API düzeyinde çok kullanıcılı yetkilendirme tamamlanmadı. JSON dışa aktarma vardır; içe aktarma/geri yükleme henüz yoktur. Uygulamayı internete açmadan veya başkalarına kullandırmadan önce kimlik doğrulama, sahiplik kontrolleri, geri yükleme, hesap/veri silme ve dağıtım güvenliği ele alınmalıdır.

AI embedding'leri, otomatik anlamsal bağlantı önerileri, Neo4j ve doğrulanmış yazar/coğrafya/tarih verisi henüz uygulanmadı. Bunlar ilk kişisel veri akışının ön koşulu değildir; ürün planındaki sonraki aşamalardır.

## CV / portfolyo anlatısı

Chronologos; sanat yönetimiyle 3D görselleştirmeyi, kaynaklı kişisel bilgi kaydıyla yerel veri tasarımını tek bir ürün döngüsünde birleştirir. Portfolyo demosu şu akışı göstermelidir: **kitap ekle → kaynaklı not yaz → Atlas'ta yıldızını gör → düşünce bağı kur → yıldızdan notuna dön → uygulamayı yeniden açıp verinin korunduğunu doğrula.**

## Devam planı

Öncelik sırasındaki işler, kapsam ve tamamlanma ölçütleri [PROJECT_PLAN.md](PROJECT_PLAN.md) içinde tutulur. Yeni sohbet için kısa bağlam ve sıradaki somut adım [HANDOFF.md](HANDOFF.md) dosyasındadır.
