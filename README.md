# Chronologos

> **Okuduklarından doğan düşünceleri yaşayan bir gökyüzüne dönüştüren kişisel bir düşünce atlası.** Her not bir yıldız, aralarında kurduğun anlamlı ilişkiler ise takımyıldızlarının parçalarıdır.

Chronologos, kitapları bitirilmiş görevler olarak saymak yerine onlardan kalan düşünceleri, alıntıları ve bağlantıları korur. Projenin sanatsal imzası, ikinci bir ekranda sessizce açık kalabilen tam ekran 3D Atlas'tır. Kitaplık ve Notlar görünümleri, bu evrenin kişisel verilerle beslenmesini sağlar.

## Ürün döngüsü

**Kitap ekle → alıntı veya düşünce kaydet → Atlas'ta yıldızını bul → düşünceler arasında bağ kur → eski bir fikri yeniden keşfet.**

Atlas, aynı içeriğin başka bir gösterimi olmanın ötesinde, notların mekânsal ilişkilerini keşfetmeye yarar. Kütüphane ve not düzenleme ekranları işlevsel kullanım için ayrı tutulur; Atlas'ın üzerinde sürekli bir menü veya kontrol paneli bulunmaz.

## Üç görünüm

- **Atlas — `/` ve `/atlas`:** Tam ekran, yavaş hareketli 3D sahne. Ortadaki antik atlas estetiğindeki dünya Chronos'u; çevresindeki yıldızlar ve düşünce bağları Logos'u temsil eder. Sol üstteki karadelik benzeri portal, üzerine gelince beliren “Arşiv” etiketiyle Kitaplık veya Notlar görünümüne geçiş sunar.
- **Kitaplık — `/library`:** Kitap rafları, Goodreads CSV aktarımı, Open Library künye/kapakları, okuma durumu ve ilerlemesi, yıllık hedefler, 3D Yıldız Usturlabı ve kitap ayrıntıları.
- **Notlar — `/notes`:** Düşünce veya alıntı kaydetme; kaynak, sayfa/bölüm bilgisi, kişisel yorum, tema ve diğer notlarla elle kurulan ilişkileri yönetme alanı.

Görünümler aynı yerel API'yi ve veritabanını kullanır. Atlas ile Kütüphane ayrı sekmelerde veya pencerelerde açık kalabilir.

Arayüz Türkçe, İngilizce ve Almanca kullanılabilir. Kitaplık/Notlar yan menüsündeki veya Atlas ayarlarındaki dil seçimi hemen uygulanır ve bu cihazda hatırlanır; ilk açılışta Türkçe kullanılır. Kitap adları, notlar ve diğer kişisel içerikler çevrilmez. Çeviri sözlükleri `src/i18n/messages-*.json` içinde tutulur.

## Görsel dil ve verinin anlamı

- **Dünya / Chronos:** Fikirlerin tarihsel ve coğrafi köklerini temsil eden sanatsal merkez. Kitaplara hikâye konumu veya yazım şehri eklenebilir; yazar pusulası ve Atlas kitap işaretçileri bu kayıtları küreye taşır. Dekoratif dünya dokusu ve arka plan rotaları doğrulanmış tarihsel veri iddiası taşımaz.
- **Not yıldızları / Logos:** Her kayıtlı notun Atlas'ta kalıcı bir kimliği ve konumu olan bir yıldızı vardır. Var olan yıldızların yeri, yeni not eklendiğinde değişmez.
- **Düşünce bağları:** Kalıcı ilişkiyi kullanıcı kurar. İsteğe bağlı yerel AI en fazla üç aday, ilişki türü ve gerekçe önerebilir; hiçbir öneri kendiliğinden kaydedilmez.
- **Dekoratif gök:** Arka plandaki süs yıldızları ve takımyıldızları kişisel not olarak seçilemez. Görsel rotalar da tarihsel bir iddia taşımaz.

Yeni bir not kaydedilince yıldızı kısa bir parıltıyla sahneye gelir ve kullanıcı Atlas'a sinematik bir geçişle götürülür. Bir yıldız seçilince not kartı açılır, yıldız nabız gibi vurgulanır ve karta ince bir izdüşüm çizgisi uzanır. Atlas boşta ve sekme görünür durumdayken arada eski bir not hatırlatma kartı belirir; bu özellik Notlar görünümünden kapatılabilir. Portal geçişi, klavye odağı ve azaltılmış hareket tercihi desteklenir.

## Mevcut özellikler

- Kitap ve baskı/künye bilgilerini yerel veritabanında saklama; kitap ekleme, düzenleme, silme, arama ve okuma durumuna göre filtreleme.
- Goodreads CSV kitaplığını önizleyerek içe aktarma; Open Library'den eser/baskı arama ve katalog kapağını kitap ayrıntısında gösterme.
- Okuma ilerlemesi, kişiye göre düzenlenebilen yıllık hedef ve okuma durumuna göre kitaplıklar. Yıllık hedef, düz bir yüzde çubuğu yerine interaktif 3D Yıldız Usturlabı olarak sunulur.
- **Yıldız Usturlabı:** Hedef kadar içi boş yıldız taslağı, bitirilen kitaplarda sıcak altın/fildişi ışıklı yıldızlar ve o anda okunan kitaplarda hedef sayısına eklenmeyen turkuaz dış yörünge işaretleri gösterilir. Yeni tamamlanan kitap için kısa ışık izi oynar; usturlap halkaları yavaşça salınır.
- Yıllık yörüngedeki tamamlanmış yıldızın üzerine gelince kitap adı, yazarı ve bitiş tarihi; okunmakta olan yıldızda okuma yüzdesi görünür. Tıklama mevcut kitap fişini açar. Klavyeyle ok tuşları yıldızlar arasında gezinir, Enter fişi açar. Kronolojik yol seçili yıldızın komşularında belirir; ayrıca tüm yılın yolunu açıp kapatan bir düğme vardır.
- Usturlapta bitmiş/hedef/okunuyor durumları renk ve biçimle ayrılır. Tür alanı bulunmadığından halkalar kitap türü ya da uzunluğu iddiasında bulunmaz; dekoratif bilimsel alet iskeletidir. WebGL kullanılamadığında statik bir gökyüzü görünümü kalır; azaltılmış hareket ayarı salınımı ve yörünge nabzını durdurur.
- Yazar pusulası ve kitap hikâye konumları: şehir arama, koordinatı kaydetme ve okunan kitap işaretçilerini Atlas'ta açıp kapatma. Yakın işaretçiler kümelenir; tıklanınca ilgili kitaplar listelenir.
- Kaynağa bağlanabilen alıntı ve düşünceler; alıntı metni ile kişisel yorumu ayrı alanlarda tutma.
- Tema filtreleri ve notlar arasında kullanıcı tarafından kurulan, tür ve gerekçe içerebilen bağlantılar.
- Kalıcı Atlas yıldızları, yeni yıldızın sahneye gelişi, not kartı ve aralıklı eski not hatırlatmaları.
- Kişisel kitaplık, ilerleme ve hedefler, konumlar, notlar, temalar ve Atlas yerleşimleri için sürümlü JSON dışa aktarma (şema 8).
- Not ayrıntısında, kullanıcı istediğinde Ollama üzerinden yerel embedding ve dil modeliyle bağlantı adayı üretme. Ollama yoksa tema/kavram eşleştirmesi çalışmaya devam eder.
- Sekmeler arası güncelleme bildirimi ve periyodik yenileme.

İlk veri dilimini görmek için `npm run db:seed` komutuyla dört kitap ve dört özgün örnek düşünce eklenebilir. Seed işlemi tekrarlanabilir; aynı örnek kayıtları çoğaltmaz. Örnek içerikler demo olarak işaretlenir.

## Teknoloji ve mimari

- **Arayüz:** React 18, Vite, Tailwind CSS 4.
- **3D:** Three.js, React Three Fiber, Drei ve `@react-three/postprocessing` Bloom.
- **Yerel API:** Node.js HTTP sunucusu ve `node:sqlite`; isteğe bağlı AI çağrıları yalnızca `127.0.0.1:11434` üzerindeki Ollama servisine gider.
- **Veritabanı:** SQLite; SQL migration'ları `server/migrations/` altında tutulur. Kişisel arşiv uygulamanın kurulum dizininden ayrı saklanır.
- **Akış:** React görünümleri → `/api` yerel API'si → SQLite. Not yazıldığında kalıcı yıldız konumu veritabanına kaydedilir; Atlas bu veriyi API'den alır.

Geliştirme sırasında SQLite dosyası `server/data/chronologos.sqlite` konumunda oluşturulur ve Git'e eklenmez. Geliştirme sunucusu API'yi `127.0.0.1:4178` üzerinde, Vite arayüzünü ise kullanılabilir `127.0.0.1` adresinde açar. Vite 5173 kullanımdaysa bir sonraki portu seçebilir; terminalde yazan adresi açın. API portu doluysa `API_PORT=4179 npm run dev` ile farklı bir port seçilebilir.

### Kişisel verilerin saklanması ve yedeklenmesi

- Kitaplar, okuma durumu ve sayfa ilerlemesi, yıllık hedefler, kitap konumları, notlar, taslaklar, temalar, Atlas yıldız yerleşimleri ve düşünce bağlantıları yerel SQLite veritabanında kalıcı olarak saklanır. Uygulamayı kapatıp yeniden açmak verileri silmez.
- Kurulu Windows uygulaması veritabanını `%APPDATA%\Chronologos\chronologos.sqlite` konumunda tutar. Bu klasör kurulum klasöründen ayrıdır; uygulamayı güncellemek veya yeniden kurmak normalde arşivi silmez. Geliştirme sürümü `server/data/chronologos.sqlite` kullanır.
- **JSON yedeği** Notlar ekranındaki ⚙ Masa ayarları bölümünden indirilebilir. Dışa aktarma `schemaVersion: 8` biçiminde kitaplık/künye, okuma ilerlemesi ve hedefleri, konum bilgileri, notlar ve Atlas ilişkilerini içerir. Bu dosya taşınabilir bir arşiv kopyasıdır; şu an uygulamada JSON içe aktarma/geri yükleme ekranı yoktur.
- Atlas kitap işaretçileri, anı kartı tercihleri, yerleştirme sesi ve anı gösterim geçmişi tarayıcı/Electron `localStorage` alanında tutulur; JSON arşivine veya SQLite dosyasına dahil değildir. Electron güncellemeleri aynı uygulama veri klasörünü korur.
- Tam SQLite kopyasını elle yedeklemek için önce uygulamayı tamamen kapat, ardından yukarıdaki `chronologos.sqlite` dosyasını başka bir diske veya güvenli klasöre kopyala. Veritabanı WAL modunda çalıştığından uygulama açıkken yalnızca ana dosyayı kopyalama. Geri yükleme için uygulama kapalıyken yedek dosyayı aynı konuma geri koyabilirsin. Dosyayı güvenli yerde sakla; kişisel kitap ve not verilerini içerir.
- Yedekleri düzenli aralıklarla, özellikle uygulamayı başka bilgisayara taşımadan veya büyük değişikliklerden önce al. Uygulamaya JSON geri yükleme desteği eklendiğinde bu dışa aktarma biçimi taşınabilir yedek olarak kullanılabilecek.

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

## Windows masaüstü uygulaması

- Yerel geliştirme penceresini açmak için `npm run desktop:dev` komutunu kullan.
- Windows kurucusunu üretmek için `npm run desktop:installer` komutunu çalıştır. Bu sürümde kurulum dosyası `release/Chronologos-Setup-0.1.7.exe` konumuna çıkar; kurucu Başlat menüsü ve masaüstü kısayolu oluşturur.
- Masaüstü kabuğu React arayüzünden ve API’den ayrı kalır. Electron API sunucusunu kendi Node utility process’inde başlatır; arayüz `/api` isteklerini aynı yerel origin’den gönderir. Bu sınır, backend’in ileride büyütülmesini veya başka bir servise taşınmasını kolaylaştırır.
- Kurulu uygulamanın SQLite veritabanı Electron’un kullanıcı veri klasöründe tutulur. Geliştirme sürümü ilk açılışta klondaki veritabanını SQLite backup API’siyle kopyalar; kaynak dosyayı yerinde bırakır.
- Kurulu uygulamanın arşivi `%APPDATA%\Chronologos\chronologos.sqlite` içinde, kurulumdan ayrı saklanır. Güncelleme normalde arşivi silmez; tam kopya almak için uygulamayı kapatıp dosyayı yedekle.
- Yerel kurulu kopyada yalnızca arayüzü yenilemek için yeni Vite üretim çıktısı `resources/web` içine aktarılabilir; önce uygulamayı tamamen kapatıp mevcut `web` klasörünün sürümlü yedeğini al. `resources/server` ve `%APPDATA%\Chronologos` veritabanı bu işlemde değiştirilmez. Dosyalar değiştikten sonra uygulamayı yeniden aç.

## Proje haritası

- `src/scene/Chronos.jsx` — dünya küresi, antik atlas dokusu ve halkalar.
- `src/scene/earthTexture.js` — dünya dokusunun oluşturulması.
- `src/scene/Logos.jsx` — dekoratif ve kişisel yıldızlar, seçili notlar ve düşünce bağları.
- `src/scene/CelestialSphere.jsx` — ortak gök hareketi, portalın 3D izdüşümü ve seçili yıldızın karta bağlanması.
- `src/scene/NebulaBackdrop.jsx` — tam ekran nebula görseli ve portal çevresindeki mercek bükülmesi.
- `src/scene/ArchivePortal.jsx` — Kitaplık/Notlar portalı ve geçiş menüsü.
- `src/scene/AtlasApp.jsx` — Atlas sahnesi, API verisi ve not kartları.
- `src/library/LibraryApp.jsx`, `src/library/NotesApp.jsx` — kitaplık ve not yönetimi.
- `src/library/ReadingConstellation.jsx` — kitaplık yıllık hedefindeki 3D Yıldız Usturlabı, ışıklı kitap yıldızları, okunmakta olan kitap yörüngesi, kronolojik yol ve WebGL yedeği.
- `server/migrations/` — SQLite şema sürümleri.
- `server/database.js`, `server/index.js`, `server/thoughts.js` — veritabanı, yerel API ve not/Atlas kuralları.
- `server/seed.js` — tekrar çalıştırılabilir örnek veri.
- `PROJECT_PLAN.md` — ürün kapsamı, veri modeli ve aşamaların ayrıntılı planı.
- `HANDOFF.md` — yeni bir geliştirme sohbeti için mevcut durum ve ilk devam adımları.

## Kapsam ve güvenlik sınırları

Bu sürüm tek kullanıcılı, yerel bir uygulamadır. Şemada kullanıcı sahipliği alanları bulunsa da oturum açma ve API düzeyinde çok kullanıcılı yetkilendirme tamamlanmadı. Tam JSON dışa aktarma vardır; JSON içe aktarma/geri yükleme henüz yoktur. Uygulamayı internete açmadan veya başkalarına kullandırmadan önce kimlik doğrulama, sahiplik kontrolleri, uygulama içi geri yükleme, hesap/veri silme ve dağıtım güvenliği ele alınmalıdır.

Bulut AI, otomatik düşünce bağlantısı kaydı, Neo4j ve eksiksiz/doğrulanmış bir yazar-coğrafya-tarih kataloğu bu sürümde yoktur. Kitaplara eklenen yerler kaynak ve güven düzeyiyle kaydedilebilir; katalog kapsamı sınırlıdır. Yerel AI önerileri isteğe bağlıdır ve yalnızca kullanıcı “AI ile öner” dediğinde devreye girer. Yerel deneme için Ollama kurup şu modelleri indirebilirsin:

```bash
ollama pull qwen3-embedding:0.6b
ollama pull qwen3:0.6b
```

API varsayılan olarak bu model adlarını kullanır. `CHRONOLOGOS_EMBED_MODEL` ve `CHRONOLOGOS_CHAT_MODEL` ortam değişkenleriyle değiştirilebilir. Kurulu ve çalışan model yoksa AI düğmesi pasif kalır; yerel tema/kavram eşleşmeleri kullanılabilir. Yerel model not metinlerini yalnızca aynı cihazdaki Ollama işlemine yollar; önerileri kullanıcı gözden geçirip bağlantı tezgâhında onaylar.

## CV / portfolyo anlatısı

Chronologos; sanat yönetimiyle 3D görselleştirmeyi, kaynaklı kişisel bilgi kaydıyla yerel veri tasarımını tek bir ürün döngüsünde birleştirir. Portfolyo demosu şu akışı göstermelidir: **kitap ekle → kaynaklı not yaz → Atlas'ta yıldızını gör → düşünce bağı kur → yıldızdan notuna dön → uygulamayı yeniden açıp verinin korunduğunu doğrula.**

## Devam planı

Öncelik sırasındaki işler, kapsam ve tamamlanma ölçütleri [PROJECT_PLAN.md](PROJECT_PLAN.md) içinde tutulur. Yeni sohbet için kısa bağlam ve sıradaki somut adım [HANDOFF.md](HANDOFF.md) dosyasındadır.

### Kitaplık: uygulanan tasarım ve kalan işler

`/library` ekranı raf görünümünü, katalog ayrıntılarını ve Atlas bağlantılarını bir araya getirir. Aşağıdaki maddeler mevcut sürümün durumunu kaydeder; kalan işler `PROJECT_PLAN.md` içindedir.

#### 1. Sade ama sanat yoğun raf — uygulandı

- Görsel dili koyu mürekkep/lacivert zemin, sıcak kâğıt ve metal tonları, editoryal tipografi ve ince ayırıcılarla kur. Kapaklar kartların ana görsel öğesi olsun; çevredeki süslemeler sınırlı kalsın.
- Grid mevcut filtre, arama ve mobil uyumluluğu korusun. Kartlarda kapak, eser adı, yazar, okuma durumu ve varsa rezonans etiketleri göster; ikincil künye ayrıntılarını ve işlemleri detay görünümüne al.
- Gerçek kapak yoksa bugün kullanılan Chronologos sanat kapağı düşürülmüş görsel olarak kalsın. Kırık veya bulunamayan uzak görsel boş kart ya da bozuk resim bırakmasın.

**Durum:** Kitap sırtları, aramayla ve klavyeyle kullanılabilir raflar, filtreler, sayfalama ve kitap önizlemesi hazır. Kapak bulunamazsa tasarlanmış renkli kapak yedeği kullanılır.

#### 2. Kullanıcı denetimli Open Library künye araması ve kapakları — uygulandı

- Kitap formundan ISBN veya başlıkla “Adayları ara” eylemi sun. Tek ilk sağlayıcı Open Library olsun; sonuçlardan eser ve baskı seçilebilsin. Kullanıcı seçimi ve formu gözden geçirip kaydetmeden katalog verisi kitaplığı değiştirmesin.
- Arama sonucundan başlık, yazarların tamamı, özgün yayın yılı ve baskı alanlarıyla kapak kimliğini al. Çoklu yazarı tek bir ayraçlı metne birleştirme; mevcut ilişkisel yazar/baskı modeline aktar.
- Yalnız arama için gerekli ISBN veya başlığı dış servise ilet; kişisel notları ve yorumları gönderme. Seçilen künye yerelde saklansın; sağlayıcı bulunamazsa veya erişilemezse elle kayıt çalışmaya devam etsin.
- Eser kimliği ile baskı kimliğini ayrı tut. Farklı baskı seçilince eski baskı kaydını yerinde ezme; eski baskıya bağlı notların `edition_id` kaynak ilişkisi korunsun. Künye kaynağını ve kapak kimliğini JSON dışa aktarmaya ekle.

**Durum:** Eser ve baskı adayları kullanıcı onayıyla kaydedilir. Kitap ayrıntısında ISBN/katalog kapağı denenir; otomatik arama kapağı ancak başlık ve yazar eşleşirse kullanılır. Elle kitap ekleme dış katalogdan bağımsız çalışır.

#### 3. Okuma durumları ile Atlas bağlantılarını ayır — uygulandı

- Mevcut gerçek okuma durumlarını (`to_read`, `reading`, `read`, `paused`) koru; “Ara verdim” dahil durum filtrelerini gizleme veya veri değerlerini yeniden adlandırma.
- Okuma durumu kabinetlerini Atlas izi filtrelerinden ayrı tut: yıldızsız kitaplar, okurken notlananlar ve Atlas izi olanlar. Bu görünümler gerçek okuma durumunu değiştirmez; kitap birden fazla görünümde bulunabilir.

**Durum:** Gerçek okuma durumları ve Atlas notuyla ilişkisi ayrı görüntülenir. Okunmuş kitapların işaretçilerini Atlas ayarından açıp kapatabilir, yakın işaretçilere grup halinde erişebilirsin.

#### 4. Beş yıldız yerine rezonans — uygulandı

- Kitaba isteğe bağlı ve çoklu seçilebilir dört sabit rezonans etiketi ekle: **Dönüştürücü**, **Temel Taş**, **Sorgulatıcı**, **Katalizör**.
- Yeni kitap formu ve kartlarında 1–5 puan alanını gösterme. Mevcut puan sütununu ve değerlerini SQLite'ta ve JSON yedeğinde koru; eski puanları rezonans etiketlerine otomatik dönüştürme.
- Rezonans verisi için geriye dönük uyumlu migration ve dışa aktarma biçiminde sürüm güncellemesi ekle.

**Durum:** Rezonans etiketleri saklanır; eski sayısal puanlar veritabanında ve dışa aktarmada korunur.

#### 5. Kitap ayrıntısı ve sentez özeti — uygulandı

- Kitap kartı, kapak/künye, okuma durumu, kişisel değerlendirme ve rezonans etiketlerini gösteren ayrıntı görünümünü açsın. Sayfada aynı kitaba bağlı düşünce ve alıntılar listelensin; her nottan mevcut Atlas yıldızına gidilebilsin.
- Ayrıntıdan “Bu kitaptan not ekle” eylemi, seçili kitap ve baskıyı Notlar formunda kaynak olarak önceden seçsin.
- İstatistikleri tüketim hedefi yerine mevcut sentezden üret: bu ay eklenen notlar, kitaplar arası kurulan düşünce bağları ve en çok notla ilişkilenen tema. Özet sayıları ilgili not veya kitap görünümünü açsın; okuma hedefi, başarı puanı veya boş arşivde yapay veri üretme.

**Durum:** Kitap ayrıntısından kaynaklı nota ve Atlas yıldızına geçiş var. Yıllık hedef, kullanıcı tarafından yıl içinde değiştirilebilen ışıklı yörüngede gösterilir; okuma ilerlemesi kitap ayrıntısında güncellenebilir.

#### Veri güvenliği ve kontrol

- Yeni rezonans, sağlayıcı kimliği ve kapak bilgisi alanlarını mevcut SQLite verisini koruyan migration'larla ekle; kitap, baskı, yazar veya not kayıtlarını sıfırlama.
- JSON dışa aktarma yeni alanları ve rezonans etiketlerini kapsasın; eski alanlar ve puanlar korunmaya devam etsin.
- Künye araması, baskı seçimi, kitap kaydı, not ve Atlas geçişi kontrollerini `DATABASE_PATH` ile oluşturulmuş ayrı SQLite kopyasında yap. Ana yerel arşive demo veya deneme kaydı ekleme.

Kitaplık akışları yerel kişisel arşiv olarak çalışır. Bulut eşitleme ve ikinci bir katalog sağlayıcısı mevcut sürümün kapsamına girmez; kalan işler `PROJECT_PLAN.md` içinde izlenir.

### Notlar ekranı: Kâşifin Masası

`/notes`, ham metinleri Atlas'ta parlayacak düşüncelere dönüştüren çalışma alanıdır. Veritabanı alıntı metnini (`content`), kişisel yorumu (`commentary`) ve kaynağı (`library_entry_id`, `edition_id`, `source_locator`) ayrı tutar. Düşünce ilişkileri `supports`, `challenges`, `extends`, `echoes` ve `contrasts` türlerini ve isteğe bağlı gerekçeyi saklar. Aşağıdaki uygulama dilimleri tamamlandı; ürün kapsamı ve kalan görevler `PROJECT_PLAN.md` içinde tutulur.

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
- [x] Dışa aktarma biçiminin 6. sürümünde taslakları, hatırlatma/açılma verilerini, kitap ilerlemesini, yıllık hedefleri ve kitap konumlarını koru. Eski alanlar ve kimlikler de dışa aktarılır.
- [x] Goodreads içe aktarma, kitap kataloğu ve Atlas geçişlerinde kullanılacak migration'ları mevcut kişisel arşivi koruyacak şekilde ekle.
- [ ] JSON içe aktarma ve uygulama içi SQLite snapshot alma/geri yükleme ekle. Geri yüklemeden önce mevcut dosyanın kurtarma kopyası alınmalı; işlem ayrı veritabanı kopyasında doğrulanmalı.
- Atlas tercihleri ve anı geçmişi `localStorage` içinde kalır; SQLite/JSON dışa aktarması bu yerel arayüz tercihlerini içermez.

Notlar masası, taslaklar, bağlantılar ve unutulmuş yıldız uygulandı. Kalan veri taşıma işi JSON'un güvenli içe aktarılması ve uygulama içi tam SQLite yedeği/geri yüklemesidir. Nebula taslakları ve hatırlatma geçmişi bulut eşitlemesi veya AI çağrısı eklemez. Yerel AI bağlantı önerisi bu akıştan ayrıdır ve yalnız kullanıcının isteğiyle çalışır.

## Güncel uygulama özeti (Eylül 2026)

### Kitaplık ve okuma

- `/library`, Goodreads CSV önizlemeli aktarımı, Open Library eser/baskı seçimini, rafları, sayfalama ve kitap ayrıntılarını içerir. Kapak detayı yalnızca başlık ve yazar eşleşmesi yeterliyse arama sonucundan tamamlanır; belirsiz eşleşmede Chronologos kapağı kalır.
- Sayfa/yüzde ilerlemesi, okuma durumu, düzenlenebilir yıllık hedef yörüngesi ve kitap ayrıntısındaki dönüşüm görseli veritabanındaki kayıtları kullanır.
- Yıllık hedef görünümü gerçek React Three Fiber/Three.js sahnesidir: pirinç usturlap halkaları, altın ışık halesi taşıyan tamamlanmış kitap yıldızları, sönük kontur hedefleri ve turkuaz dış yörüngedeki okunmakta olan kitaplar bulunur. Okumakta olan kayıtlar hedef sayısını artırmaz; kalabalıkta dış yörünge en fazla 18 işaret çizer, sayı ve klavye gezinmesi bütün kayıtları kapsar.
- Tamamlanmış kitap yıldızları bitiş tarihine göre sıralanır. Yıldız etkileşimi kitap fişini açar; klavye gezinmesi, seçili kitaba bağlanan kısa kronolojik yol ve isteğe bağlı tam yol görünümü desteklenir. Yeni tamamlanan kitap yıldızına ışık hüzmesiyle ulaşır. Sahne görünür değilken veya uygulama sekmesi arka plandayken çizim döngüsü durur; düşük hareket tercihi sakin/sabit kompozisyon kullanır.
- Eser/yazar, seçilen baskı ve kişisel kitaplık kaydı ayrı tutulur. Sayısal puanlar korunur; yeni arayüz rezonans etiketlerini sunar.

### Yazar pusulası ve Atlas kitapları

- Kitap ayrıntısından konum adıyla arama yapıp yazar koordinatını kaydedebilirsin. Hikâyenin geçtiği yer ile yazım şehri ayrı temellendirilir; kaynak, güven düzeyi ve açıklama alanları saklanır.
- Atlas'ta okunan kitapların konum işaretçileri ayardan açılıp kapatılabilir. Yakın işaretçiler küme ve sayaç olarak görünür; seçilince kitap listesi açılır. Küre yeni hedefe yumuşakça döner ve kuzeyi sabit tutar.
- Konum kayıtları ve atlas işaretçileri sınırlı kullanıcı/katalog verisidir; dekoratif yıldız alanı doğrulanmış bir dünya tarihi veya eksiksiz coğrafi katalog değildir.

### Notlar ve geçiş

- `/notes`, alıntı metnini, kişisel yorumu ve kaynağı ayırır. Nebula hızlı taslakları kalıcıdır ve açıkça Atlas'a yerleştirilmeden yıldız olmaz.
- Beş tür düşünce bağı aranabilir, düzenlenebilir ve gerekçesiyle Atlas'ta incelenebilir. Günün Unutulmuş Yıldızı ve yerel Ollama önerileri isteğe bağlıdır.
- Not başarıyla kaydedilince yıldız Atlas'a gelir ve uygulama kullanıcıyı sahneye taşır. Azaltılmış hareket tercihi korunur.

### Veri saklama ve kalan işler

- Kurulu Windows uygulaması SQLite arşivini `%APPDATA%\Chronologos\chronologos.sqlite` içinde tutar; geliştirme kopyası `server/data/chronologos.sqlite` konumundadır. Bu dosyalar Git'e eklenmez.
- JSON dışa aktarma `schemaVersion: 8` ile kitaplık, ilerleme/hedef, konum, not/taslak, tema, hatırlatma ve Atlas verilerini içerir. Arayüz tercihleri ve anı geçmişi `localStorage` içindedir, JSON'a dahil değildir.
- JSON içe aktarma ve uygulama içi SQLite snapshot alma/geri yükleme henüz yoktur. Tam dosya kopyası için uygulamayı kapat; WAL etkin durumdayken açık veritabanını elle kopyalama.
- Otomatik test/lint komutu yoktur. `npm run build` ve geçici bir `DATABASE_PATH` kopyasında veri akışı kontrolü kullan. Uygulamayı internete açmadan önce PROJECT_PLAN'deki kimlik doğrulama, sahiplik ve geri yükleme işleri tamamlanmalıdır.

## 0.1.4 — Görsel güncelleme (2 Ekim 2026)

- Yeni C ve yıldız logosu; Kitaplık ve Notlar için ortak gezinme ve mürekkep/pirinç renkleri.
- Kitaplıkta **Raf / Kapaklar** görünüm seçimi; son seçim bu cihazda hatırlanır.
- Notlar ekranında taslak bulunmadığında da hızlı kayıt işlemleri görünür.
- Sonraki dört ürün eklemesi, `PROJECT_PLAN.md` içindeki TODO bölümünde bekleyen işler olarak kayıtlıdır.

## 0.1.5 — Okuma masası ve koleksiyonlar

- **Okumaya devam:** Aktif kitapların ilerlemesini Kitaplık ekranından kaydet; kitap ayrıntısını aç veya kaynak kitap seçili şekilde düşünce ekle. Toplam sayfa biliniyorsa sayfa, bilinmiyorsa yüzde girişi kullanılır.
- **Koleksiyonlar:** Kendi raflarını oluştur; “Koleksiyonları düzenle” alanında adını değiştir ve kitapları ekle/çıkar. Koleksiyon düğmeleri kitap listesini filtreler; arama, okuma durumu ve Raf/Kapaklar görünümü birlikte çalışır. Koleksiyonu silmek kitapları silmez.
- Koleksiyonlar ve üyelikler SQLite içinde saklanır ve JSON şema 8 arşivine dahil edilir.

## 0.1.6 — Logo ve doğrudan raf görünümü

C/yıldız logosu uygulama, favicon ve Windows simgesinde kullanılır. Logo dosyasına yeni adres verilerek eski önbellek giderilir. Raf seçimi doğrudan kitap sırtlarını açar; durum seçim kabinetleri kaldırıldı. Arama, koleksiyon ve okuma durumu filtreleri korunur.

## 0.1.7 — Yıldız Yolu

Kitaplık ekranındaki **Yıldız Yolu** bölümünde (`/library?view=timeline`) yıllık okuma geçmişi bulunur. Yıl, kayıt türü ve tarih aralığı filtreleri; aylık/mevsimlik yol, kitap bitişleri, düşünceler ve alıntılar aynı zaman çizelgesinde görünür. Aylık işaretlere tıklamak ilgili ayı filtreler. Yıl özeti her zaman seçilen yılın tamamını gösterir; demo kayıtlar özet sayılarında sayılmaz. Notlarla en sık ilişkilenen temalar gerçek kayıtlardan hesaplanır.

Bir yıldız seçildiğinde kâğıt tonunda kaynak fişi açılır. Kitabın aynı dönemdeki notlarına ince bağlantılar uzanır; bunlar ortak kaynak kitabını gösterir, elle kurulan anlamsal düşünce bağlantısı iddiası taşımaz. Alıntı ve kişisel yorum ayrı gösterilir. Tekrar okumalar çift halkalı yıldızlarla ve ayrı okuma geçmişi kayıtlarıyla korunur. Fişten kitap, not ve Atlas yıldızına geçilebilir.

Tarihi bilinmeyen bitişler **Tarihsiz izler** alanında korunur ve yıl toplamlarına eklenmez. Fişteki bitiş tarihi yalnızca seçilen okuma kaydını düzenler; tarih eklenen kayıt ilgili yılına taşınır. **Yeniden okumaya başla** ilerlemeyi sıfırlayıp yeni bir okuma oturumu başlatır; önceki bitişleri silmez. Usturlap, aynı yıl içinde aynı eseri bir kez sayar; Yıldız Yolu ise her okuma bitişini ayrı gösterir.

Migration 011 mevcut bilinen bitişleri okuma geçmişine taşır. Eski sürümlerde üzerine yazılmış ve artık saklanmayan eski bitiş tarihleri tahmin edilmez. JSON şema 8, okuma oturumunun tamamlanma durumu ile etkin oturum kimliğini içerir. Sayfa ilk açıldığında 40 iz gösterilir; daha fazlası düğmeyle açılır. Azaltılmış hareket tercihi desteklenir.
