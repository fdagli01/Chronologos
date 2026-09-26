# Chronologos — Ürün ve Geliştirme Planı

## Uygulama durumu

- [x] Atlas ve Kütüphane ayrı rotalara ayrıldı; Atlas yalnızca `/` ve `/atlas` üzerinde lazy-load edilir.
- [x] İlk kitaplık veritabanı/API katmanı ve örnek kayıtlar eklendi. Yerel kitap ekleme, düzenleme, silme, arama ve durum filtresi çalışır.
- [x] Kitaba/baskıya bağlanabilen düşünce ve alıntı kayıtları; kişisel yorum ayrı alan.
- [x] Notların kalıcı Atlas yıldızlarına ve seçilebilir not kartlarına bağlanması.
- [x] Kullanıcının kurduğu düşünce bağları ve not teması filtresi.
- [x] Seçilen yıldızın nabız vurgusu ve karta uzanan izdüşüm çizgisi.
- [x] Sessiz, aralıklı eski not hatırlatmaları; sekme odağı, kullanıcı etkileşimi ve kapatma tercihi gözetilir.
- [ ] Hesap/kimlik doğrulama ve çok kullanıcılı yayınlama.
- [x] Kişisel arşiv için JSON dışa aktarma.
- [ ] Yedek içe aktarma, hesap/kimlik doğrulama ve çok kullanıcılı yayınlama.

İlk teslimler Atlas ile Kütüphane ayrımını, veritabanına bağlı kitaplığı, kaynaklı notları ve temel düşünce ağı akışını kapsar. Uygulama hâlâ tek kullanıcılı yerel modda çalışır; başka kullanıcılara açılmadan önce kimlik doğrulama, yedekten geri yükleme ve dağıtım güvenliği tamamlanmalıdır.

## Ürün fikri

Chronologos, okunan kitapları ve onlardan doğan kişisel düşünceleri tek bir yerde saklayan; bu içeriği hem kullanışlı bir kütüphane arayüzünde hem de sanatsal bir 3D düşünce atlasında gösteren kişisel bir uygulamadır.

Kütüphane kayıt ekleme, arama ve düzenleme alanıdır. Atlas, bu kayıtların düşünsel ve tarihsel ilişkilerini sessiz, tam ekran bir sanat eseri gibi sunar. Atlas uygulamanın dekoratif arka planı değil, aynı verinin ikinci ve daha keşif odaklı görünümüdür.

## Ekranların ilişkisi

- **Atlas (`/atlas`)**: Mevcut tam ekran WebGL kompozisyonu korunur. Menü, panel ve sürekli görünen kontroller eklenmez. İkinci monitörde tek başına açık kalabilir.
- **Kütüphane (`/library`)**: Kitap, okuma kaydı, alıntı ve notları yönetmek için ayrı, okunaklı ve erişilebilir arayüz.
- İki ekran aynı backend ve veritabanından beslenir. Bir not kütüphanede kaydedildiğinde Atlas veriyi alır; Atlas'taki bir yıldız seçildiğinde not ve kaynak bilgisi açılabilir.
- İki görünüm ayrı sekmelerde veya pencerelerde açılabilir. Kütüphane ile Atlas arasında gezinmek için bağlantılar bulunur; Atlas'ın sessiz görünümü sürekli arayüzle kirletilmez.

## Mimari yön

- Tek web uygulaması, tek backend API ve tek ilişkisel veritabanı.
- İlk yerel dilim, sürümlü SQL migration'ları ve Node `node:sqlite` API'si ile SQLite kullanır; ek veritabanı servisi kurulumu istemez. Repo `.node-version` ile kullanılan Node sürümünü belirtir.
- Kullanıcıya ait kayıtlar ilk şemadan itibaren `user_id` ile sahiplenilir. İlk dağıtım kişisel kullanım olabilir; çok kullanıcılı erişim ve hesap yönetimi daha sonra tamamlanır.
- Kitap kataloğu bilgileri ile kişisel kütüphane kayıtları ayrılır. Aynı kitap farklı kullanıcıların kütüphanelerinde yer alabilir; okuma geçmişi, notlar, puanlar ve Atlas yerleşimleri kişisel kalır.
- Kalıcı içerik veritabanında tutulur. Dönüş, parıltı ve geçici seçili yıldız gibi saniyelik görsel durumlar tarayıcıda hesaplanır.
- Yıldız konumları ve kimlikleri kararlı olmalıdır; sayfa yenileme veya yeni not ekleme var olan Atlas'ı rastgele değiştirmemelidir.
- AI embedding'leri, otomatik öneriler ve harici grafik altyapısı ilk sürümün ön koşulu değildir. Önce kaynaklı, kullanıcı tarafından kurulmuş veriler çalışır hâle gelir.

## Veri alanları

### İlk ürün dilimi

- **Eser ve yazar**: Başlık, yazar, özgün yayın yılı ve isteğe bağlı açıklama.
- **Kişisel kütüphane kaydı**: Okuma durumu (`to_read`, `reading`, `read`, `paused`), seçilen baskı, kişisel puan ve kısa değerlendirme.
- **Okuma oturumu**: Başlama ve bitiş tarihleri. Yeniden okuma, önceki kaydı ezmez.
- **Not**: Serbest düşünce metni, türü, oluşturma/düzenleme tarihleri ve sahibi. Bir kitaba bağlı olmak zorunda değildir.
- **Alıntı**: Alıntılanan metin ile kişisel yorum ayrı tutulur; sayfa, bölüm ve baskı kaynak olarak bağlanır.
- **Atlas yıldızı**: Not kimliği, yıldızın kararlı kimliği, tema ve saklanan yerleşim.

### İkinci dilim

- **Baskı**: ISBN, dil, yayınevi, yayın yılı ve çevirmen. Eser ile baskı ayrımı çeviri ve sayfa referanslarını doğru tutar.
- **Kaynak**: Bir not birden fazla kaynağa bağlanabilir; kitap, baskı, bölüm, sayfa veya web adresi olabilir.
- **Tema**: Kullanıcının oluşturduğu kavram kümeleri. Bir not birden fazla temaya katılabilir.
- **Düşünce ilişkisi**: İki not arasında `supports`, `challenges`, `extends`, `echoes` gibi türü olan bağ, kısa açıklama ve bağın kullanıcı ya da sistem önerisi olduğu bilgisi.
- **Tarihsel ilişki**: Yazar, yer, dönem ve ilişki türü; düşünsel benzerlik ile kanıtlanmış tarihsel etkilenme ayrı tutulur ve mümkünse kaynak gösterilir.

## Aşamalar ve tamamlanma ölçütleri

### 0 — Yapı ve görsel sınırları

- Atlas'ı ayrı bir tam ekran görünüm olarak sabitle.
- Kütüphane için ayrı bir rota ve görsel dil oluştur.
- Mevcut Atlas sahnesi kütüphane geliştirmelerinden etkilenmesin.

**Tamamlanmış sayılır:** `/atlas` sanat görünümünü, `/library` ise kütüphane uygulamasını açar; iki görünüm aynı uygulamada ayrı pencerelerde kullanılabilir.

### 1 — Veritabanı temeli ve kütüphane

- İlk şema ve migration yaklaşımını ekle.
- Kitap, yazar ve kişisel kütüphane kayıtlarını API üzerinden oluştur, görüntüle, güncelle ve sil.
- Okuma durumuna göre listeleme, arama ve temel filtreleme ekle.
- Kayıtların kullanıcı sahipliği alanlarını hazırla; ilk kişisel kullanımda hesap akışını gereksiz karmaşıklaştırma.

**Tamamlanmış sayılır:** Kitap kaydı veritabanına yazılır, kütüphanede görünür ve uygulama yeniden açıldığında korunur.

### 2 — Kaynaklı notlar ve alıntılar ✅

- Nota kitap/baskı/bölüm/sayfa kaynağı bağla.
- Alıntı metni ile kişisel yorumu ayrı göster.
- Kitapsız not oluşturmayı destekle.

**Tamamlanmış sayılır:** Kütüphaneden bir kaynağa bağlı not oluşturulup daha sonra düzenlenebilir.

### 3 — Kütüphane ile Atlas'ı bağlama ✅

- Veritabanındaki notlardan Atlas yıldız verisi üret.
- Her not için kararlı yıldız kimliği ve konumu sakla.
- Not kartı açıkken yıldızı nabız vurgusuyla tanımla ve hareketli gökyüzündeki izdüşümünü karta bağla.
- Yeni kayıt başarılı olduktan sonra yıldızı kontrollü biçimde sahneye getir; var olan yıldızlar ve takımyıldızları yerinde kalsın.
- Atlas yıldızından nota/kaynağa ve kitaptan ilgili yıldızlara geçiş ekle.

**Tamamlanmış sayılır:** Bir not eklenince Atlas'ta belirir; seçiminde not ve kaynağı bulunur.

### 4 — Düşünce ağı ve keşif (temel dilim tamamlandı)

- Kullanıcı notlar arasında ilişki kurabilir, tür ve gerekçe ekleyebilir.
- Temalara göre kütüphane ve not filtreleri ekle.
- Kullanıcı etkileşimi yokken eski notlardan birini seyrek aralıkla hatırlat; elle seçimde hatırlatmayı kes.
- Önerilen bağlantıları daha sonra ekle; önerilerin kabul/ret durumu ve gerekçesi açıkça gösterilir.

### 5 — Başka kullanıcılara açılmaya hazırlık (bekliyor)

- Kayıt, oturum, hesap ayarları ve kullanıcıya özel erişim kuralları.
- Her API isteğinde kayıt sahipliği denetimi.
- Veri dışa aktarma, hesap silme, yedekleme ve içe aktarma.
- Paylaşım ve ortak katalog davranışlarını kişisel kayıtlardan ayır.
- Mevcut JSON dışa aktarma yalnızca yerel kişisel arşiv içindir; geri yükleme ve hesap güvenliği tamamlanana kadar uygulamayı internete açma.

## CV'de gösterilecek hikâye

İlk portfolyo demosu şu uçtan uca akışı göstermeli: **kitap ekle → okuma durumunu değiştir → kaynağı belli bir not yaz → Atlas'ta yıldızını keşfet → yıldızdan nota dön → yeniden açınca verinin korunduğunu gör.**

Bu akış; sanat yönetimi, erişilebilir ürün arayüzü, ilişkisel veri tasarımı, API, kalıcı kayıt ve gerçek zamanlı 3D görselleştirmeyi tek bir anlatıda birleştirir.

## Kapsam dışında tutulacaklar (ilk sürüm)

Takipçi akışı, beğeni/yorum sosyal ağı, okuma yarışları, rozetler, genel amaçlı kitap tavsiye sistemi, otomatik AI sınıflandırması ve kapsamlı dünya düşünce tarihi kataloğu. Önce kişisel içerik akışı tamamlanır.
