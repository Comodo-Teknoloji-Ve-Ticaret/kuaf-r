# Makas: Kuaför Randevu & Salon Yönetimi

Comodo'nun kuaförlere sattığı çok kiracılı (çok salonlu) salon yönetim ürünü. Resepsiyondaki bilgisayardan kullanılmak üzere tasarlandı, telefonda da tam çalışır.

**Canlı demo:** GitHub Pages (`frontend/dist`). Giriş ekranında demo hesapları tek tıkla seçilir.

## Özellikler

| Modül | İçerik |
|---|---|
| **Takvim** | Personel sütunlu gün görünümü, hafta görünümü, 15 dk ızgara, sürükle-bırak taşıma, alttan çekerek süre uzatma, çakışma/mesai/izin uyarısı, "şu an" çizgisi, randevusuz müşteri, tekrarlayan randevu, durum akışı (Bekliyor → Onaylandı → Geldi → İşlemde → Tamamlandı / Gelmedi / İptal), kısayollar (`N`, `T`, `←`/`→`) |
| **Müşteriler** | Ad/telefon ile anlık arama, mükerrer telefon engeli (0532…/+90… aynı sayılır), müşteri kartı: geçmiş, harcama, bakiye, gelmedi sayısı, boya formülü notları, paketler, CSV |
| **Kasa** | Randevudan tek tıkla adisyon, hizmet/ürün/paket satışı/paketten kullanım, satır ve toplam indirim, bahşiş, nakit/kart/havale/veresiye ve parçalı ödeme, para üstü, veresiye tahsilatı, giderler, gün sonu kapanışı (kilitlenir, sadece sahip açar) |
| **Hizmetler** | Kategoriler (takvim rengi), satır içi süre/fiyat düzenleme, personele özel fiyat/süre, online görünürlük |
| **Personel** | Haftalık mesai, izin/mola, yapabildiği hizmetler, hizmet ve ürün prim oranları, aylık prim özeti; personel rolü için "Primlerim" |
| **Stok** | Satış / salon kullanımı ürünleri, giriş/kullanım/sayım, hareket geçmişi, kritik stok uyarısı, satışta otomatik düşüm |
| **Paketler** | Seans paketleri (ör. 5'li fön), geçerlilik süresi, satılan paketler ve kalan seans takibi |
| **Mesajlar** | Değişkenli şablonlar ve canlı önizleme, yarınki randevulara toplu hatırlatma, doğum günü kutlaması, WhatsApp ile gönderim, gönderim kaydı (SMS demo modunda simüle edilir) |
| **Online randevu** | Salona özel link (`#/r/<salon>`): şube → hizmet → uzman ("fark etmez") → gün & saat → bilgiler → onay kodu + takvime ekle (.ics). Onay gerekliliği, ileri tarih ve minimum süre ayarlanır |
| **Raporlar** | Ciro (önceki döneme göre), ortalama sepet, net, doluluk, yeni/dönen müşteri, gelmeme oranı, günlük ciro grafiği, ödeme yöntemleri, en çok kazandıran hizmetler, personel performansı ve prim, CSV |
| **Ayarlar** | Salon bilgisi ve marka rengi, şubeler ve çalışma saatleri, kullanıcılar ve roller, online randevu, tema |
| **Platform (Comodo)** | Salon listesi, yeni salon + sahip hesabı oluşturma, askıya alma |

**Roller:** Salon Sahibi (her şey) · Resepsiyon (takvim, müşteri, kasa, stok, mesaj) · Personel (kendi takvimi ve primi) · Comodo Yönetici (platform).

**Tema:** Ferah (açık, varsayılan) ve Gece (koyu); kullanıcı menüsünden veya Ayarlar → Görünüm'den.

## Yapı

```
frontend/   React 19 + TypeScript + Vite
  src/domain/          Saf kurallar: müsaitlik/çakışma, adisyon toplamları, prim, telefon, para, tarih (testli)
  src/application/     Repository arayüzleri ve servisler: randevu, müşteri, kasa, stok, mesaj, online randevu, rapor, platform (testli)
  src/infrastructure/  localStorage deposu, demo verisi (2 salon, 3 şube), React sağlayıcıları
  src/ui/              Ortak bileşenler, kabuk, grafikler, tema değişkenleri
  src/pages/           Ekranlar
backend/    .NET Clean Architecture (frontend onayından sonra)
docs/superpowers/      Tasarım dokümanı ve uygulama planı
```

Tüm veri erişimi `Repos` arayüzünden geçer; her kayıt `tenantId` taşır ve bir salon başka salonun verisini göremez. Backend aşamasında aynı arayüzün HTTP implementasyonu takılacak.

Para tutarları kuruş (tam sayı), saatler gün içi dakika, tarihler `YYYY-MM-DD` (Europe/Istanbul) olarak tutulur.

## Çalıştırma

```bash
cd frontend
npm install
npm run dev      # geliştirme
npm test         # Vitest birim testleri
npm run build    # üretim derlemesi (frontend/dist)
```

Demo verisi tarayıcıda (`localStorage`) saklanır; kullanıcı menüsündeki **Demo verisini sıfırla** ile yenilenir. Eski demo verisi açılışta haftalık adımlarla bugüne kaydırılır.
