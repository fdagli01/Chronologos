# Chronologos — Ürün ve Geliştirme Planı

## TODO — Sanatsal hatırlama deneyimi: Hafıza Takımyıldızı

4 Ekim 2026 kullanıcı kararı: Önce PC için geliştirilecek. Sanat ve vurucu deneyim öncelikli; mobil uyarlama daha sonra düşünülecek. Kullanıcı düz soru/textarea kartı akışını reddetti, düşünce bağlarını yeniden birleştirme metaforunu beğendi. Bu bölüm plan kaydıdır; ana uygulamaya entegrasyon henüz yapılmadı.

**Amaç:** Okunan kitaptan kalan düşünceyi hatırlamak, Atlas'taki bir yolu yeniden canlandırmak gibi hissettirmeli. Başarının merkezi doğru cevap puanı değil, kişinin kendi düşüncesiyle eski notu yeniden karşılaştırdığı an.

### Sahne ve etkileşim akışı

- [ ] Geniş PC ekranında Atlas'ın lacivert, altın, yıldız ve kâğıt estetiğini kullanan bir sahne kur. Standart form kartları ve sınav ilerleme çubuğu yerine gökyüzü, boşluk, derinlik ve güçlü tipografi öne çıksın.
- [ ] Girişte kaynak kitap ve not, gökyüzünde duran bir kitap sayfası gibi görünsün. Kaynak bilgileri okunabilir kalsın. Gerçek geri dönüş oturumunda eski notu baştan göstermeden hatırlamaya geçilebilsin; demo okuma adımı ile gecikmeli hatırlama birbirine karıştırılmasın.
- [ ] Hatırlamaya geçerken sayfa karanlığa çekilsin, çevre sakinleşsin, tek bir yıldız belirginleşsin. Kullanıcıya geniş bir soru sorulsun: “Bu kitaptan sende hangi düşünce kaldı?” İlk yanıt öncesinde ana fikri ele veren ipuçları veya eski not görünmesin.
- [ ] Yazarken yıldızın yanında ince ışık izleri oluşsun. Metin alanı zarif bir günlük yüzeyi gibi olsun; yazmayı ve okumayı zorlaştıran sürekli hareket kullanılmasın.
- [ ] “İzimi bıraktım” ile ilk serbest yanıt korunsun. İsteğe bağlı ipuçları ancak bundan sonra küçük takımyıldız işaretleri olarak açılsın; ipucundan önceki yanıt ayrı kalmalı.
- [ ] Eski not çağrıldığında ikinci yıldız derinlikten yaklaşsın. İki düşünce arasındaki kopuk çizgi parçaları birleşsin; kısa bir altın parıltı yolu tamamlasın. **En vurucu an bu yeniden bağ kurma anı olsun.**
- [ ] Buluşmadan sonra sahne sakinleşsin. Kullanıcının kendi sözleri ile kaynak not iki yıldızın altında rahat okunabilsin. Otomatik doğruluk puanı veya hatırlama başarısı iddiası kullanılmasın; isteğe bağlı öz değerlendirme sunulsun.
- [ ] Oturum sonunda ışık gökyüzüne karışsın ve kullanıcı Atlas'a sakin biçimde dönsün. Hatırlama izi geçici görsel katman olsun; her deneme kendiliğinden yeni not veya kalıcı düşünce bağı oluşturmasın. Kalıcı kayıt politikası entegrasyon öncesinde ayrıca belirlensin.

### Sanat yönetimi ve performans

- [ ] Az sayıda güçlü efekt kullan: odaklanan yıldız, sayfanın çekilmesi, yazıdan doğan iz, parçalı yolun birleşmesi ve son sönüş. Her hareket anlatıda bir göreve hizmet etsin.
- [ ] Mevcut Atlas estetiğiyle görsel bütünlük korunsun; efektlerin parlaklığı metnin okunurluğunu azaltmasın. Ses bu onaylanan kapsamın parçası değildir.
- [ ] Efektler olay sırasında kısa süre çalışsın; sürekli parçacık üretimi, her tuşta geometri kurma ve React kare başına güncelleme kullanılmasın. Geçici kaynaklar oturum sonunda temizlensin.
- [ ] Azaltılmış hareket tercihinde derinlik hareketi ve çizgi akışı sakin görünürlük değişimlerine dönüşsün. Klavye erişimi, odak yönetimi ve çıkış/yeniden başlatma korunsun.
- [ ] PC'de temsili büyük Atlas verisiyle sahneye giriş, yazma, buluşma ve çıkış sırasında kare süreleri ölçülsün. Sanatsal etki performans doğrulamasıyla birlikte teslim edilsin.

### Mevcut önizleme ve kabul ölçütleri

- [x] Kafka'nın *Dönüşüm* kitabı ve sentetik okuyucu notuyla kişisel arşivden bağımsız sanatsal önizleme hazırlandı: `agent-tasks/recall-preview/index.html`. Kullanıcı konsepti beğendi. Bu demo gerçek aralıklı hatırlama veya ana uygulama entegrasyonu değildir.
- [x] Gemini 3.1 Pro tasarım görüşü alındı: Boşluk → isteğe bağlı Takımyıldız ipuçları → Hizalanma. Kayıt: `agent-tasks/recall-art-consult/result.json`; bildirilen toplam 13.806 token, Codex kota ölçümü değildir.
- [ ] Önizlemeyi yukarıdaki güçlü sahne geçişleriyle geliştir; kullanıcıya hareketli olarak göster ve görsel geri bildirim al.
- [ ] İlk yanıt öncesi ipucu sızıntısı olmamasını, ipucundan önceki yanıtın korunmasını ve oturumların kalıcı not/bağları değiştirmemesini doğrula.
- [ ] Entegrasyonda gerçek kitap/not seçimi, geri dönüş zamanı ve oturum verisi gereksinimlerini tanımla. PDF'deki zamanlama önerisini herkese sabit bilimsel kural olarak uygulama.
- [ ] Mobil sürümün etkileşim ve görsel uyarlamasını PC deneyimi oturduktan sonra ayrı kapsam olarak ele al.

## Uygulama durumu

- [x] Türkçe/İngilizce/Almanca arayüz; cihazda kalıcı dil seçimi ve açık formları koruyan anlık değişim.

- [x] Atlas ve Kitaplık/Notlar ayrı rotalarda; Atlas lazy-load edilir ve tam ekran masaüstü Electron uygulaması olarak açılabilir.
- [x] SQLite kitaplık: Goodreads CSV aktarımı, Open Library künye/baskı araması, kapak gösterimi, kitap rafları, okuma ilerlemesi ve yıllık hedef.
- [x] Kitap ayrıntısından yazar pusulası ve hikâye konumu ekleme; okunan kitap işaretçilerini Atlas'ta gösterme, yakın işaretçileri kümeleme ve kitap listesine erişme.
- [x] Kaynaklı düşünce/alinti notları, Nebula taslakları, beş türü destekleyen düzenlenebilir bağlantılar ve unutulmuş yıldız hatırlatması.
- [x] Yeni not kaydından sonra azaltılmış hareket tercihini gözeten Atlas geçişi; yıldız seçimi, kart ve izdüşüm çizgisi.
- [x] Sürümlü JSON dışa aktarma (şema 8): kitaplık, ilerleme, hedefler, kitap/yazar konumları, notlar, taslaklar, temalar ve Atlas ilişkileri dahil.
- [x] Yerel uygulama verisini Windows kullanıcı klasöründe kurulumdan ayrı saklama; SQLite yedekleme adımları README'de açıklanıyor.
- [ ] JSON içe aktarma ve uygulama içi güvenli SQLite snapshot alma/geri yükleme.
- [ ] Hesap/kimlik doğrulama ve çok kullanıcılı yayınlama.

Masaüstü ve kişisel veri akışı teslim edildi. Uygulama tek kullanıcılı ve yerel çalışır; JSON dışa aktarma tam arşiv kopyasıdır, fakat JSON geri yükleme arayüzü yoktur. Başka kullanıcılara açılmadan önce kimlik doğrulama, sahiplik kontrolleri, güvenli geri yükleme ve dağıtım güvenliği tamamlanmalıdır.

## TODO — Sonraki kitaplık eklemeleri

2 Ekim 2026: Kullanıcı ilk dört eklemeyi seçti. Okumaya devam paneli ve özel koleksiyonlar 0.1.5, Yıldız Yolu zaman çizelgesi 0.1.7 sürümünde uygulandı; kitaplar arası bağlantı görünümü bekliyor.

- [x] **Okumaya devam paneli:** Okunmakta olan kitapları, sayfa/yüzde ilerlemesini ve hızlı “Düşünce ekle” işlemini göster. İlerleme kaydı yeniden açıldığında korunmalı; not formunda kaynak kitap önceden seçilmeli.
- [ ] **Kitaplar arası bağlantılar:** Farklı kitaplara bağlı alıntı/notları mevcut düşünce bağları üzerinden bir araya getir. Kullanıcı ilişki türünü ve gerekçeyi düzenleyebilmeli, iki kaynak nota ve Atlas yıldızlarına ulaşabilmeli.
- [x] **Okuma zaman çizelgesi:** Kitap bitişlerini ve notları tarih sırasıyla göster; tarih/tür filtreleri ekle. Tarihi bilinmeyen kayıtları ayrı göster; yeniden okuma geçmişini koru.
- [x] **Özel koleksiyonlar:** “Felsefe”, “Favoriler”, “Tekrar okunacaklar” gibi raflar oluşturma, yeniden adlandırma ve silme; kitapları birden fazla koleksiyona ekleme/çıkarma. Raf ve Kapaklar görünümlerinde filtreleme, SQLite saklama ve JSON dışa aktarma desteği ekle. Koleksiyon silmek kitapları silmemeli.

**Mevcut:** Eski düşünceleri yeniden hatırlatma Atlas'ta zaten çalışıyor; yeni bir bekleyen özellik olarak sayılmıyor.

**Teslim edilen görsel sürüm — 0.1.4:** Yeni C/yıldız logosu, ortak arşiv gezinmesi, arayüz renk/tipografi düzenlemeleri, kalıcı Raf/Kapaklar seçimi ve hızlı not kayıt işlemleri.

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
- İsteğe bağlı yerel AI yalnızca kullanıcı isteğiyle çalışır; bulut AI ve otomatik bağlantı kaydı yoktur.

## Veri alanları

### İlk ürün dilimi

- **Eser ve yazar**: Başlık, yazar, özgün yayın yılı ve isteğe bağlı açıklama.
- **Kişisel kütüphane kaydı**: Okuma durumu (`to_read`, `reading`, `read`, `paused`), seçilen baskı, kişisel puan ve kısa değerlendirme.
- **Okuma oturumu**: Başlama ve bitiş tarihleri. Yeniden okuma, önceki kaydı ezmez.
- **Okuma ilerlemesi ve yıllık hedef**: Sayfa/yüzde ilerlemesi ile kullanıcı tarafından yıl bazında düzenlenebilen kitap hedefi.
- **Yazar ve hikâye konumu**: Yazar pusulasının koordinatları; kitabın hikâye konumu veya yazım şehri, kaynak/not ve güven düzeyi.
- **Not**: Serbest düşünce metni, türü, oluşturma/düzenleme tarihleri ve sahibi. Bir kitaba bağlı olmak zorunda değildir.
- **Alıntı**: Alıntılanan metin ile kişisel yorum ayrı tutulur; sayfa, bölüm ve baskı kaynak olarak bağlanır.
- **Atlas yıldızı**: Not kimliği, yıldızın kararlı kimliği, tema ve saklanan yerleşim.

### İkinci dilim

- **Baskı**: ISBN, dil, yayınevi, yayın yılı ve çevirmen. Eser ile baskı ayrımı çeviri ve sayfa referanslarını doğru tutar.
- **Kaynak**: Bir not birden fazla kaynağa bağlanabilir; kitap, baskı, bölüm, sayfa veya web adresi olabilir.
- **Tema**: Kullanıcının oluşturduğu kavram kümeleri. Bir not birden fazla temaya katılabilir.
- **Düşünce ilişkisi**: İki not arasında `supports`, `challenges`, `extends`, `echoes` gibi türü olan bağ, kısa açıklama ve bağın kullanıcı ya da sistem önerisi olduğu bilgisi.
- **Tarihsel ilişki**: Yazar, yer, dönem ve ilişki türü; düşünsel benzerlik ile kanıtlanmış tarihsel etkilenme ayrı tutulur ve mümkünse kaynak gösterilir.
- **Atlas kitap işaretçisi**: Okunmuş kitapların kayıtlı coğrafi koordinatları; yakın işaretçiler küme halinde seçilebilir ve kitap listesi açar.

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
- [x] Ollama yerel embedding + dil modeli ile en fazla üç bağlantı adayı, ilişki türü ve gerekçe öner; kullanıcı gözden geçirip kaydetmeden kalıcı bağlantı oluşturma. Ollama yoksa tema/kavram eşleştirmesi kullanılabilir.

### 5 — Başka kullanıcılara açılmaya hazırlık (bekliyor)

- Kayıt, oturum, hesap ayarları ve kullanıcıya özel erişim kuralları.
- Her API isteğinde kayıt sahipliği denetimi.
- Hesap silme, uygulama içi tam SQLite yedeği/geri yükleme ve doğrulanmış JSON içe aktarma. JSON şema 8 dışa aktarma hazır; mevcut tam kurtarma yolu uygulama kapalıyken SQLite dosyasını elle kopyalamaktır.
- Paylaşım ve ortak katalog davranışlarını kişisel kayıtlardan ayır.
- Mevcut JSON dışa aktarma yalnızca yerel kişisel arşiv içindir; geri yükleme ve hesap güvenliği tamamlanana kadar uygulamayı internete açma.

### 6 — Masaüstü Atlas ve coğrafi kitap keşfi ✅

- Windows kurucusu, masaüstü kısayolu ve kullanıcı veri klasöründe kalıcı SQLite arşivi tamamlandı.
- Yıllık okuma yörüngesi, kitap ilerleme göstergesi ve kitap ayrıntısındaki mum görseli eklendi.
- Yazar pusulası, hikâye konumu araması ve okunan kitapların Atlas işaretçileri eklendi. İşaretçiler küme halinde açılır; küre son hedefe kuzeyi sabit tutarak yumuşakça yönelir.
- Yeni not başarıyla kaydedildiğinde kullanıcı azaltılmış hareket tercihi gözetilerek Atlas'a geçirilir.
- Goodreads aktarımı, Open Library künye/kapakları ve kitaplıkta kapak eşleşmesi için başlık+yazar doğrulaması tamamlandı.

## CV'de gösterilecek hikâye

İlk portfolyo demosu şu uçtan uca akışı göstermeli: **kitap ekle → okuma durumunu değiştir → kaynağı belli bir not yaz → Atlas'ta yıldızını keşfet → yıldızdan nota dön → yeniden açınca verinin korunduğunu gör.**

Bu akış; sanat yönetimi, erişilebilir ürün arayüzü, ilişkisel veri tasarımı, API, kalıcı kayıt ve gerçek zamanlı 3D görselleştirmeyi tek bir anlatıda birleştirir.

## Kapsam dışında tutulacaklar (ilk sürüm)

Takipçi akışı, beğeni/yorum sosyal ağı, okuma yarışları, rozetler, genel amaçlı kitap tavsiye sistemi, bulut AI bağlantı analizi ve kapsamlı dünya düşünce tarihi kataloğu. Önce kişisel içerik akışı tamamlanır.

## 0.1.5 teslimi — 2 Ekim 2026

Okumaya devam panelinde tüm okunmakta olan kitaplar filtrelerden bağımsız görünür; sayfa/yüzde ilerlemesi kaydedilir, ayrıntılar açılır ve kaynak kitabı seçili Notlar formuna geçilir. Koleksiyonlar oluşturulabilir, yeniden adlandırılabilir, silinebilir; bir kitap birden fazla koleksiyona eklenebilir. Koleksiyon filtresi arama/okuma durumu ve Raf/Kapaklar ile birleşir. Migration 010 mevcut veriyi korur; JSON şema 8 koleksiyonları ve üyelikleri içerir.

## 0.1.7 teslimi — Yıldız Yolu

- [x] Yıl, tür ve tarih aralığı filtreleri; aylık işaretlerden hızlı ay seçimi.
- [x] Yıllık bitiş/düşünce/alıntı/aktif ay özeti; gerçek notlara bağlı en sık temalar.
- [x] Mevsim etiketleri, ince yıldız yolu, seçili eserin kaynak notlarına bağlantılar ve kâğıt fişi.
- [x] Okuma oturumları migration 011 ile korunur; yeniden okuma yeni oturum başlatır ve ilerlemeyi sıfırlar.
- [x] Tarihsiz bitişleri ayrı bulutsu alanında tutma; seçilen okumanın tarihini düzeltme/ekleme.
- [x] JSON şema 8 içinde tamamlanma durumu ve etkin oturum ilişkisi.
- [x] Dar ekranda tek sütun, azaltılmış hareket, büyük arşivlerde kademeli gösterim.
