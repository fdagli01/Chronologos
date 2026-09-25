# Chronologos

Chronologos, düşüncelerin zaman ve mekân içindeki yolculuğunu resmeden canlı bir düşünce atlasıdır. Uygulama, okunan kitapları tamamlanmış işler olarak saymak yerine; notları, alıntıları, yazarları ve fikirler arasındaki bağları kişisel bir evrenin parçaları olarak ele alır.

## Görsel yaklaşım

Ekranın merkezinde, eski harita estetiği taşıyan ve yavaşça dönen bir dünya bulunur. Chronos adı verilen bu katman; fikirlerin tarihsel ve coğrafi köklerini, yazarları ve dönemleri temsil eder.

Dünyayı çevreleyen Logos katmanında notlar yıldızlar, aralarındaki anlam ilişkileri ise ışıklı çizgiler olarak görünür. Sahne, sürekli ve sakin hareket eden, tablo gibi izlenebilen bir üç boyutlu kompozisyon olarak tasarlanmıştır.

## Mevcut aşama

İlk aşama, arayüz öğeleri yerine görsel sahneye odaklanan Sessiz Mod deneyimidir. Dünya, yıldızlar ve örnek düşünce bağlantıları şu anda yerel ve örnek verilerle çizilir. Gösterilen rotalar süsleme amaçlıdır; tarihsel bir iddia taşımaz.

## Yerel ortamda çalıştırma

```bash
npm install
npm run dev
```

Vite'ın verdiği yerel adresi tarayıcıda açın. Üretim sürümünü oluşturmak için `npm run build` komutunu çalıştırın.

## Proje yapısı

- `src/scene/Chronos.jsx`, dönen dünyayı ve pirinç renkli gök halkalarını oluşturur.
- `src/scene/LivingEarth.jsx`, dünya üzerindeki yavaş ışık hareketlerini ve kıyı parıltılarını ekler.
- `src/scene/earthTexture.js`, gerçek kıta biçimlerini eski atlas görünümünde bir dokuya dönüştürür.
- `src/scene/Logos.jsx`, yıldızları ve aralarındaki bağlantıları üç boyutlu sahnede çizer.
- `src/data/universe.js`, şu an kullanılan örnek notları ve ilişkileri içerir.
- `src/scene/Planetarium.jsx`, sahne katmanlarını ve parıltı efektini bir araya getirir.

## İlerideki geliştirmeler

- Sahneyi hedeflenen ekranda daha da iyileştirmek.
- Gerçek kitapları, notları ve alıntıları evrene eklemek.
- Bir yazardan onunla ilişkili notlara, bir nottan da tarihsel kaynaklarına geçişi sağlamak.
- Notları kalıcı olarak saklamak ve anlam ilişkileri için yapay zekâ destekli öneriler eklemek.
