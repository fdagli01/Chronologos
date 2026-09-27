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
- **Düşünce bağları:** Kalıcı ilişkiyi kullanıcı kurar. İsteğe bağlı yerel AI en fazla üç aday, ilişki türü ve gerekçe önerebilir; hiçbir öneri kendiliğinden kaydedilmez.
- **Dekoratif gök:** Arka plandaki süs yıldızları ve takımyıldızları kişisel not olarak seçilemez. Görsel rotalar da tarihsel bir iddia taşımaz.

Yeni bir not kaydedilince yıldızı kısa bir parıltıyla sahneye gelir. Bir yıldız seçilince not kartı açılır, yıldız nabız gibi vurgulanır ve karta ince bir izdüşüm çizgisi uzanır. Atlas boşta ve sekme görünür durumdayken arada eski bir not hatırlatma kartı belirir; bu özellik Notlar görünümünden kapatılabilir. Portal geçişi, klavye odağı ve azaltılmış hareket tercihi desteklenir.

## Mevcut özellikler

- Kitap ve baskı/künye bilgilerini yerel veritabanında saklama; kitap ekleme, düzenleme, silme, arama ve okuma durumuna göre filtreleme.
- Kaynağa bağlanabilen alıntı ve düşünceler; alıntı metni ile kişisel yorumu ayrı alanlarda tutma.
- Tema filtreleri ve notlar arasında kullanıcı tarafından kurulan, tür ve gerekçe içerebilen bağlantılar.
- Kalıcı Atlas yıldızları, yeni yıldızın sahneye gelişi, not kartı ve aralıklı eski not hatırlatmaları.
- Kişisel kitaplık, notlar, temalar ve Atlas yerleşimleri için JSON dışa aktarma.
- Not ayrıntısında, kullanıcı istediğinde Ollama üzerinden yerel embedding ve dil modeliyle bağlantı adayı üretme. Ollama yoksa tema/kavram eşleştirmesi çalışmaya devam eder.
- Sekmeler arası güncelleme bildirimi ve periyodik yenileme.

İlk veri dilimini görmek için `npm run db:seed` komutuyla dört kitap ve dört özgün örnek düşünce eklenebilir. Seed işlemi tekrarlanabilir; aynı örnek kayıtları çoğaltmaz. Örnek içerikler demo olarak işaretlenir.

## Teknoloji ve mimari

- **Arayüz:** React 18, Vite, Tailwind CSS 4.
- **3D:** Three.js, React Three Fiber, Drei ve `@react-three/postprocessing` Bloom.
- **Yerel API:** Node.js HTTP sunucusu ve `node:sqlite`; isteğe bağlı AI çağrıları yalnızca `127.0.0.1:11434` üzerindeki Ollama servisine gider.
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

Bulut AI, otomatik bağlantı kaydı, Neo4j ve doğrulanmış yazar/coğrafya/tarih verisi uygulamada yoktur. Yerel AI önerileri isteğe bağlıdır ve yalnızca kullanıcı “AI ile öner” dediğinde devreye girer. Yerel deneme için Ollama kurup şu modelleri indirebilirsin:

```bash
ollama pull qwen3-embedding:0.6b
ollama pull qwen3:0.6b
```

API varsayılan olarak bu model adlarını kullanır. `CHRONOLOGOS_EMBED_MODEL` ve `CHRONOLOGOS_CHAT_MODEL` ortam değişkenleriyle değiştirilebilir. Kurulu ve çalışan model yoksa AI düğmesi pasif kalır; yerel tema/kavram eşleşmeleri kullanılabilir. Yerel model not metinlerini yalnızca aynı cihazdaki Ollama işlemine yollar; önerileri kullanıcı gözden geçirip bağlantı tezgâhında onaylar.

## CV / portfolyo anlatısı

Chronologos; sanat yönetimiyle 3D görselleştirmeyi, kaynaklı kişisel bilgi kaydıyla yerel veri tasarımını tek bir ürün döngüsünde birleştirir. Portfolyo demosu şu akışı göstermelidir: **kitap ekle → kaynaklı not yaz → Atlas'ta yıldızını gör → düşünce bağı kur → yıldızdan notuna dön → uygulamayı yeniden açıp verinin korunduğunu doğrula.**

## Devam planı

Öncelik sırasındaki işler, kapsam ve tamamlanma ölçütleri [PROJECT_PLAN.md](PROJECT_PLAN.md) içinde tutulur. Yeni sohbet için kısa bağlam ve sıradaki somut adım [HANDOFF.md](HANDOFF.md) dosyasındadır.

### Kitaplık: görsel raf ve düşünsel derinlik yol haritası

`/library` ekranında duygu ve düzen birlikte bulunmalı: kitap kapakları rafın görsel odağı olur; arama, okuma durumu ve düzenleme kontrolleri sade ve kolay bulunur kalır. Mevcut ekran zaten duyarlı bir kitap kartı ızgarası ve dört okuma durumu içeriyor. Yol haritası tabloyu ızgaraya çevirmek yerine kapağı, eser/baskı künyesini ve kitap ile Atlas notları arasındaki bağı zenginleştirir.

#### 1. Sade ama sanat yoğun raf

- Görsel dili koyu mürekkep/lacivert zemin, sıcak kâğıt ve metal tonları, editoryal tipografi ve ince ayırıcılarla kur. Kapaklar kartların ana görsel öğesi olsun; çevredeki süslemeler sınırlı kalsın.
- Grid mevcut filtre, arama ve mobil uyumluluğu korusun. Kartlarda kapak, eser adı, yazar, okuma durumu ve varsa rezonans etiketleri göster; ikincil künye ayrıntılarını ve işlemleri detay görünümüne al.
- Gerçek kapak yoksa bugün kullanılan Chronologos sanat kapağı düşürülmüş görsel olarak kalsın. Kırık veya bulunamayan uzak görsel boş kart ya da bozuk resim bırakmasın.

**Tamamlanma ölçütü:** Kütüphane görsel olarak kitap kapaklarının oluşturduğu bir raf gibi algılanır; dar ekranda da arama, filtre ve temel kitap işlemleri kolayca kullanılabilir.

#### 2. Kullanıcı denetimli Open Library künye araması

- Kitap formundan ISBN veya başlıkla “Adayları ara” eylemi sun. Tek ilk sağlayıcı Open Library olsun; sonuçlardan eser ve baskı seçilebilsin. Kullanıcı seçimi ve formu gözden geçirip kaydetmeden katalog verisi kitaplığı değiştirmesin.
- Arama sonucundan başlık, yazarların tamamı, özgün yayın yılı ve baskı alanlarıyla kapak kimliğini al. Çoklu yazarı tek bir ayraçlı metne birleştirme; mevcut ilişkisel yazar/baskı modeline aktar.
- Yalnız arama için gerekli ISBN veya başlığı dış servise ilet; kişisel notları ve yorumları gönderme. Seçilen künye yerelde saklansın; sağlayıcı bulunamazsa veya erişilemezse elle kayıt çalışmaya devam etsin.
- Eser kimliği ile baskı kimliğini ayrı tut. Farklı baskı seçilince eski baskı kaydını yerinde ezme; eski baskıya bağlı notların `edition_id` kaynak ilişkisi korunsun. Künye kaynağını ve kapak kimliğini JSON dışa aktarmaya ekle.

**Tamamlanma ölçütü:** ISBN ve başlık araması birden fazla adayı gösterebilir; kullanıcı doğru baskıyı seçip alanları düzelterek kaydeder. Dış servis kapalıyken elle kitap ekleme ve kapak yedeği çalışır.

#### 3. Okuma durumları ile düşünsel rafları ayır

- Mevcut gerçek okuma durumlarını (`to_read`, `reading`, `read`, `paused`) koru; “Ara verdim” dahil durum filtrelerini gizleme veya veri değerlerini yeniden adlandırma.
- Bunların yanında arşiv içeriğinden türetilen düşünsel raflar ekle: **Keşfedilecekler** — henüz Atlas notu olmayan kitaplar; **Zihinde İşlenenler** — okunuyor durumunda ve en az bir notu olan kitaplar; **Gökkubbede Yeri Olanlar** — en az bir Atlas notuna kaynak olan kitaplar. Düşünsel raflar gerçek okuma durumunu değiştirmesin ve bir kitap birden çok görünümde yer alabilsin.

**Tamamlanma ölçütü:** Kitap bitmiş olsa da yıldızsız kalabilir; henüz okunurken notu Atlas'a yerleşmiş olabilir. Filtreler bu iki bilgiyi birbirine karıştırmaz.

#### 4. Beş yıldız yerine rezonans

- Kitaba isteğe bağlı ve çoklu seçilebilir dört sabit rezonans etiketi ekle: **Dönüştürücü**, **Temel Taş**, **Sorgulatıcı**, **Katalizör**.
- Yeni kitap formu ve kartlarında 1–5 puan alanını gösterme. Mevcut puan sütununu ve değerlerini SQLite'ta ve JSON yedeğinde koru; eski puanları rezonans etiketlerine otomatik dönüştürme.
- Rezonans verisi için geriye dönük uyumlu migration ve dışa aktarma biçiminde sürüm güncellemesi ekle.

**Tamamlanma ölçütü:** Kullanıcı sıfır, bir veya birden fazla rezonans etiketi seçebilir; eski arşiv puanları kaybolmaz ve yeni veriler yedeklenebilir.

#### 5. Kitap ayrıntısı ve sentez özeti

- Kitap kartı, kapak/künye, okuma durumu, kişisel değerlendirme ve rezonans etiketlerini gösteren ayrıntı görünümünü açsın. Sayfada aynı kitaba bağlı düşünce ve alıntılar listelensin; her nottan mevcut Atlas yıldızına gidilebilsin.
- Ayrıntıdan “Bu kitaptan not ekle” eylemi, seçili kitap ve baskıyı Notlar formunda kaynak olarak önceden seçsin.
- İstatistikleri tüketim hedefi yerine mevcut sentezden üret: bu ay eklenen notlar, kitaplar arası kurulan düşünce bağları ve en çok notla ilişkilenen tema. Özet sayıları ilgili not veya kitap görünümünü açsın; okuma hedefi, başarı puanı veya boş arşivde yapay veri üretme.

**Tamamlanma ölçütü:** Kullanıcı kitap ayrıntısından kaynağa bağlı nota, oradan Atlas yıldızına geçebilir; sentez özetleri veritabanındaki gerçek kayıtlarla tutarlıdır.

#### Veri güvenliği ve kontrol

- Yeni rezonans, sağlayıcı kimliği ve kapak bilgisi alanlarını mevcut SQLite verisini koruyan migration'larla ekle; kitap, baskı, yazar veya not kayıtlarını sıfırlama.
- JSON dışa aktarma yeni alanları ve rezonans etiketlerini kapsasın; eski alanlar ve puanlar korunmaya devam etsin.
- Künye araması, baskı seçimi, kitap kaydı, not ve Atlas geçişi kontrollerini `DATABASE_PATH` ile oluşturulmuş ayrı SQLite kopyasında yap. Ana yerel arşive demo veya deneme kaydı ekleme.

Bu yol haritası önce yerel kişisel kitaplığı geliştirir. Bulut eşitleme, AI önerileri ve ikinci bir katalog sağlayıcısı bu dilimin kapsamına girmez.

### Notlar ekranı: Kâşifin Masası

`/notes`, ham metinleri Atlas'ta parlayacak düşüncelere dönüştüren bir çalışma alanıdır. Mevcut veritabanı alıntı metnini (`content`), kişisel yorumu (`commentary`) ve kaynağı (`library_entry_id`, `edition_id`, `source_locator`) ayrı tutar. Mevcut düşünce ilişkileri `supports`, `challenges`, `extends`, `echoes` ve `contrasts` türlerini ve isteğe bağlı gerekçeyi saklar. Bu yol haritasının ilk uygulama dilimi aşağıdaki akışları ekler; mevcut yerel kişisel arşiv akışı korunur.

#### 1. Alıntı ile kişisel sesi görsel olarak ayır — uygulandı

- Alıntı formunda yazarın metnini parşömen/daktilo hissi veren bir alıntı alanında; kişisel yorumu ise ayrı, sade bir sentez alanında göster. Kitap, baskı ve sayfa/bölüm bilgisini kaynak satırında tut.
- Not kartlarında ve Atlas'taki yıldız kartında aynı iki ses ayrımını koru. Kaynak eksikse açıkça eksik olduğunu belirt; kaynak bilgisi uydurma.
- Not araması alıntı ve düşünce metninin yanında kişisel yorumu ve kaynak konumunu da kapsasın.

**Tamamlanma ölçütü:** Bir alıntının yazarı, kullanıcının yorumu ve kaynak bilgisi görsel olarak ayırt edilir; arama bu alanlardaki eşleşmeleri bulur.

#### 2. Nebula hızlı yakalama ve taslakları yıldızlara dönüştürme — uygulandı

- Düşünce metniyle çalışan, Enter ile kaydeden hızlı yakalama alanı ekle. Hızlı yakalama kayıtlarını SQLite'ta Atlas notlarından ayrı, kalıcı Nebula taslakları olarak sakla; kaynak, yorum ve tema sonradan eklenebilsin.
- Taslaklar Atlas API'sine/yıldız listesine dahil edilmesin ve Atlas koordinatı almasın. “Atlas'a yerleştir” işlemi taslağı kaynak bilgileriyle tamamlanmış nota dönüştürsün ve not ile kalıcı yıldızını tek transaction içinde oluştursun.
- Taslaklar için ayrı oluşturma, listeleme, güncelleme ve yerleştirme API işlemleri ekle. JSON arşiv dışa aktarmasına taslakları dahil et ve biçim sürümünü artır; var olan alanları ve kayıtları koru.

**Tamamlanma ölçütü:** Taslak sayfa yenilemesinden sonra Nebula'da kalır, Atlas'ta görünmez; yerleştirilince tek bir kalıcı nota/yıldıza dönüşür ve yıldız konumu yenileme sonrasında değişmez.

#### 3. Düşünce bağlantısı tezgâhı — uygulandı

- Bir nottan “Bir düşünceyle bağla” eylemiyle tezgâhı aç. Bağlanacak hedefi aranabilir not listesinden bulup çalışma alanına sürükleyerek seç; aynı işlemi klavye ve dokunmatik kullanım için sürükleme gerektirmeyen bir seçim yolu ile destekle.
- İki notun kısa önizlemesini ve ilişkinin yönünü cümle olarak göster. `supports`, `challenges` ve `extends` ana seçenekler olsun; mevcut `echoes` ve `contrasts` türlerini de diğer seçeneklerde koru.
- Mevcut isteğe bağlı gerekçeyi bağlantı listesinde ve Atlas'ta seçili bağlantı ayrıntısında göster. İlişki türü ve gerekçe sonradan düzenlenebilsin; güncelleme API'si ekle.
- Bağlantı renklerini türlere göre ayır: destekler için yeşil/altın, sorgular için pas/kırmızı, genişletir için mavi, yankılar için menekşe ve karşıtlık için gümüş. Renk tek başına anlam taşımasın; tür etiketi ve yön bilgisi de gösterilsin.

**Tamamlanma ölçütü:** Kullanıcı not arayıp/taşıyarak yönü belli beş ilişki türünden biriyle bağ kurabilir; gerekçeyi daha sonra görebilir ve düzenleyebilir. Klavye veya dokunmatik kullanım sürükle-bırak olmadan tamamlanabilir.

#### 4. Günün Unutulmuş Yıldızı — uygulandı

- Notlar ekranının üstünde günde bir kez aynı adayı gösteren sakin bir hatırlatma bölümü ekle. Aday, hatırlatma özelliği etkinleştirildikten sonra bilinçli olarak açılmamış ve en az altı aylık bir not olsun.
- Açılma geçmişi özelliğin etkinleştiği tarihten itibaren tutulur; geçmiş kayıtların daha önce hiç açılmadığı varsayılmaz. Not listesinin yüklenmesi, arka plan API yenilemesi veya hatırlatma kartının görünmesi açılma sayılmaz. Notu Notlar'da bilinçli açmak veya Atlas'ta yıldızını seçmek açılma zamanını günceller.
- Açılma zamanını ve günlük adayı SQLite'ta sakla ki aynı gün açık sekmeler aynı notu göstersin. Uygun aday yoksa başka bir notu “unutulmuş” diye gösterme.
- Atlas'ın mevcut boşta-hatırlatma davranışını ayrı tut. Günlük Notlar hatırlatması için işletim sistemi bildirimi veya arka plan zamanlayıcısı ekleme.

**Tamamlanma ölçütü:** Açılma kaydı yalnızca bilinçli etkileşimde güncellenir; günlük aday sekmeler arasında tutarlı kalır ve altı aylık koşula uyan not yoksa bölüm uygun bir boş durum gösterir.

#### Veri güvenliği ve kontrol

- [x] Yeni taslak, açılma geçmişi ve günlük aday verisi için geriye dönük uyumlu SQLite migration’ları oluştur. Migration mevcut kullanıcı verisini silmemeli veya yeniden üretmemeli.
- [x] Dışa aktarma biçiminin yeni sürümünde taslaklar ile gerekli hatırlatma/açılma verisini koru (şema sürümü 3). Eski sürüm alanlarını kaybetme.
- Yazma ve akış kontrollerini ana `server/data/chronologos.sqlite` dosyası yerine `DATABASE_PATH` ile oluşturulmuş ayrı bir SQLite kopyasında yap.
- Kontrol akışı: hızlı taslak oluştur → yenile → Atlas'ta görünmediğini doğrula → kaynağı/temayı ekle → Atlas'a yerleştir → yıldız konumunu yenileme sonrasında doğrula; sonra iki notu bağla, gerekçeyi güncelle ve günlük hatırlatma koşullarını sınayıp aynı gün iki sekmede aynı adayı doğrula.

Bu yol haritası yerel kişisel arşiv içindir. Nebula taslakları ve hatırlatma geçmişi bulut eşitlemesi veya AI çağrısı eklemez. Yerel AI bağlantı önerisi bu akıştan ayrıdır ve yalnız kullanıcının isteğiyle çalışır.

## Recent implementation summary (September 2026)

This section summarizes the latest implementation for contributors continuing work on another machine. The product plan above remains the source of truth for longer-term scope.

### Library

- Replaced the main cover grid with a responsive bookshelf made of keyboard-accessible book spines. Spine height and thickness use edition page counts when available; stable book-specific styling avoids guessing genre from appearance.
- Added a paper-like catalog card with edition metadata, reading status, resonance tags, and notes linked to the selected book.
- Added an explicit Open Library search flow. The user chooses a work and edition and reviews the returned details before saving; only the search term is sent to Open Library.
- Added edition and resonance storage through a backward-compatible SQLite migration. Existing numeric ratings remain stored and exported even though the new interface emphasizes resonance tags.

### Notes workbench

- Kept `/notes` separate from the library and organized it into a Workbench and Archive view. Quote text, personal commentary, and source location remain separate fields.
- Added persistent Nebula drafts, quick capture, draft editing, and an explicit placement action. Drafts are kept out of Atlas until placed; placement creates the note and its persistent star in one database transaction.
- Added a searchable connection drawer for the five supported directed relationship types, with rationale editing and keyboard/touch selection.
- Added the opt-in Forgotten Star reminder and a settings panel for JSON backup, reminders, and placement sound. The daily reminder's eligibility clock starts when that feature is enabled.
- Latest usability improvements increase archive and source contrast, give each note one prominent Open action with secondary actions in a menu, simplify the empty Nebula state, shorten the default thought form, and use one searchable target picker in the connection drawer.

### Atlas and optional local AI

- Atlas note cards show outgoing and incoming relationship direction, relationship type, and any saved rationale. Newly placed stars can use a short visual arrival effect and the optional placement sound preference.
- Local AI suggestions are opt-in and use Ollama on `127.0.0.1`. Suggestions are limited to three candidates and are never saved as links without the user's review. Theme and term matching remain available without Ollama.
- The Atlas route is lazy-loaded. The current production build reports an approximately 1.07 MB minified Atlas chunk (about 301 kB gzip); Vite warns because its default chunk-size threshold is measured before gzip. This is a performance follow-up, not a build failure.

### Data and validation notes

- SQLite migrations `003_library_enrichment.sql` and `004_notes_workbench.sql` extend the existing schema without resetting the personal archive. `server/data/*.sqlite` and its SQLite sidecar files are ignored by Git and must remain local.
- JSON export is versioned and includes the enriched library and workbench data. Import/restore and multi-user authentication are not implemented; do not expose this local prototype publicly.
- `npm run build` is the available automated project check. There is no automated test script yet; verify data-writing flows with a disposable SQLite copy rather than the primary local database.
