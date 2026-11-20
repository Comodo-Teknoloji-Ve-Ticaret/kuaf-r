# Kuaför Randevu Takip Sistemi — Tasarım

Tarih: 2026-11-20 · Klasör: `~/Desktop/Comodo/Kuafor` · Repo: `Comodo-Teknoloji-Ve-Ticaret/Kuafor`

## 1. Amaç ve neden

Comodo'nun **birçok kuaföre satacağı** bir salon yönetim ürünü. Her salon kendi hesabıyla girer; bir işletmenin birden fazla şubesi olabilir. Günlük kullanım ağırlıklı olarak **resepsiyondaki bilgisayardan**; ekran **mobilde de tam kullanılabilir** olmalı.

Kullanıcının isteği: *kullanımı kolay, ama çok basit/sıradan görünmeyen* bir ekran.

Başarı: Resepsiyon eğitim almadan randevu ekleyip taşıyabiliyor, adisyonu kapatabiliyor; satış görüşmesinde demo "gerçek ürün" gibi duruyor.

## 2. Hedefler / hedef olmayanlar / kaçınılacaklar

**Hedefler (ilk sürüm — hepsi onaylandı)**
- Çok kiracılı yapı (salon = kiracı), şubeler, roller
- Çalışan sütunlu takvim (ana ekran)
- Müşteri yönetimi, hizmetler, personel
- Kasa / adisyon, veresiye, gider, gün sonu kapanış, prim
- Raporlar
- Ekstralar (kullanıcı "hepsi olsun" dedi): müşterinin online randevu sayfası, SMS/WhatsApp hatırlatma, ürün stok takibi, paket/seans satışı

**Hedef olmayanlar (ilk sürümde yok)**
- Online ödeme / kapora tahsilatı
- E-fatura, e-arşiv, yazar kasa / POS cihaz entegrasyonu
- Native mobil uygulama (web mobil uyumlu olacak)
- Ön yüz aşamasında gerçek SMS gönderimi (simüle edilir)

**Kaçınılacaklar (çalışsa bile başarısızlık sayılır)**
- Kalabalık, öğrenmesi zor ekranlar; en sık iş (randevu ekle/taşı, ödeme al) 2–3 tıktan fazla sürmemeli
- Bir salonun başka salonun verisini görmesi
- "Hazır şablon admin paneli" görünümü

## 3. Kısıtlar

- Yapı: `frontend/` TypeScript + React + Vite; `backend/` .NET Clean Architecture (frontend onaylandıktan sonra).
- Önce ön yüz, backend olmadan tek başına çalışır (mock + localStorage), veri erişimi arayüz arkasında → sonra HTTP'ye geçiş.
- GitHub org `Comodo-Teknoloji-Ve-Ticaret`, repo **Public** (Pages için), GitHub Actions ile `frontend/dist` Pages'e yayın. Her ilerleme commit + push.
- Arayüz dili Türkçe, para birimi TRY, saat dilimi Europe/Istanbul.

## 4. Yaklaşımlar

| | Yaklaşım | Artı | Eksi |
|---|---|---|---|
| **1 (seçildi)** | Tek uygulama, her salon ayrı hesap (çok kiracılı), şube desteği | Tek güncelleme herkese; yeni salon dakikalar içinde; abonelik modeline uygun | Giriş, rol ve veri ayrımı baştan doğru kurulmalı |
| 2 | Her salona ayrı kurulum | En basit başlangıç, tam izolasyon | N salon = N güncelleme/yedek |
| 3 | Önce tek salon, sonra genişlet | Hızlı ilk demo | Sonradan çoklu yapıya geçiş en pahalı yol |

Kullanıcı **1**'i seçti.

## 5. Görsel yön (kullanıcı kararı)

- **Varsayılan tema: "Ferah" (B)** — beyaz zemin, canlı pastel randevu kartları, mor/indigo vurgu (#6c5ce7), yumuşak köşeler, ince çizgiler.
- **Koyu tema seçeneği: "Gece" (A)** — kömür zemin, altın vurgu (#d4b06a), sol kenarlıklı kartlar. Kullanıcı başına açık/koyu/sistem seçimi.
- "Basit görünmesin" için: üst KPI şeridi (randevu, beklenen ciro, salondakiler, doluluk), "şu an" çizgisi, personel avatar renkleri, hizmet kategorisine göre kart renkleri, yumuşak geçişler/mikro animasyonlar, boş durumlar için özenli illüstratif metin.

## 6. Ürün tanımı

### 6.1 Kiracı, şube, kullanıcı, rol
- **Salon (kiracı)** → bir veya çok **Şube**. Her kayıt bir kiracıya, çoğu bir şubeye bağlı.
- Roller: **Salon Sahibi** (her şey, tüm şubeler), **Resepsiyon** (takvim, müşteri, kasa; raporlar sınırlı), **Personel** (kendi takvimi, kendi primi, kendi müşteri notları).
- **Comodo yöneticisi** (platform paneli): salon ekle/askıya al, abonelik durumu. *(Bizim kararımız: satılan ürün için gerekli.)*
- Üst barda şube seçici (birden fazla şube varsa).

### 6.2 Takvim (ana ekran)
- **Gün görünümü:** her çalışan bir sütun; 15 dk ızgara; mesai dışı ve molalar taralı; "şu an" çizgisi.
- **Hafta görünümü:** seçili çalışan(lar) için 7 gün.
- Boş hücreye tıkla → **hızlı randevu paneli** (sağdan kayan): müşteri ara/yeni ekle (telefonla), hizmet(ler) — süre otomatik toplanır, çalışan, saat, not.
- Sürükle-bırak ile taşıma (saat ve çalışan değişimi), alt kenardan çekerek süre uzatma.
- Çakışma / mesai dışı / izinli çalışan uyarısı (engellemez, onay ister).
- Durumlar ve renkleri: Bekliyor · Onaylandı · Geldi · İşlemde · Tamamlandı · Gelmedi · İptal.
- **Walk-in (randevusuz)**: tek tuşla, ilk müsait çalışana veya seçilene.
- Randevu detayında: "Adisyona aktar", "Hatırlatma gönder", "Tekrarla" (ör. 4 haftada bir).
- Zaman bloğu: mola, izin, toplantı.
- Kaynak etiketi: Resepsiyon / Online / Telefon.
- **Mobil:** tek çalışan sütunu + üstte çalışan seçici (kaydırarak geçiş), alt gezinme çubuğu, yüzen "+" butonu.

### 6.3 Müşteriler
- Liste + anlık arama (ad/telefon), etiketler (VIP, yeni, riskli).
- Müşteri kartı: iletişim, doğum günü, geçmiş randevular, toplam harcama, son ziyaret, gelmedi sayısı, **notlar / formül** (boya numarası vb.), aktif paketler, bakiye (veresiye), KVKK/ileti izni.
- Aynı telefonla mükerrer kaydı engelle.

### 6.4 Hizmetler
- Kategori (Kesim, Boya, Bakım, Fön, Tırnak, Sakal…), ad, süre, fiyat, renk.
- Çalışana özel süre/fiyat farkı (ör. kıdemli usta).
- Online randevuda gösterilsin / gösterilmesin.

### 6.5 Personel
- Profil, renk, şube, haftalık mesai, izin günleri, yapabildiği hizmetler.
- Prim oranları: hizmet % ve ürün % ayrı.

### 6.6 Kasa / Adisyon
- Adisyon: randevudan aktarılır veya boş açılır. Satırlar: hizmet (personelli), ürün, paket satışı, paketten seans kullanımı.
- Satır/toplam indirim (% veya ₺), bahşiş (opsiyonel, personele).
- Ödeme: Nakit, Kart, Havale/EFT, **Veresiye** — parçalı ödeme desteklenir.
- Müşteri bakiyesi ve veresiye tahsilatı.
- Gider girişi (kategori, tutar, açıklama).
- **Gün sonu kapanış:** sistemdeki nakit vs sayılan nakit, fark notu; kapanmış gün kilitlenir (sahip açabilir).
- Prim, kapanmış adisyon satırlarından hesaplanır.

### 6.7 Stok
- Ürün: ad, barkod (opsiyonel), kategori, satış fiyatı, alış fiyatı, stok, kritik seviye, tür (satış / salon kullanımı).
- Stok hareketleri: giriş, satış (adisyondan otomatik), kullanım/fire, sayım düzeltmesi.
- Kritik stok uyarısı (panelde rozet).

### 6.8 Paket / seans
- Paket tanımı: hizmet × adet (birden çok hizmet olabilir), fiyat, geçerlilik süresi (gün).
- Müşteriye satılan paket: kalan seanslar, bitiş tarihi; adisyonda "paketten düş".

### 6.9 Hatırlatma ve mesajlar
- Şablonlar (değişkenli): randevu onayı, X saat önce hatırlatma, iptal, doğum günü, "uzun süredir gelmediniz".
- Ön yüz aşamasında: gönderim **simüle edilir** ve "Mesaj kayıtları"na düşer; ayrıca **WhatsApp ile gönder** butonu hazır metinle `wa.me` linki açar (gerçekten çalışır, elle gönderim).
- Backend aşamasında: SMS sağlayıcısı arayüzü (ör. Netgsm/İleti Merkezi) — sağlayıcı seçimi sonra.

### 6.10 Online randevu sayfası (müşteri tarafı)
- Salona özel link: `/#/r/<salon-kodu>` — salon logosu/renkleri.
- Akış: şube → hizmet(ler) → çalışan (veya "fark etmez") → tarih & müsait saat → ad + telefon → onay + randevu kodu.
- Ayarlar: online randevu açık/kapalı, ne kadar ileri tarih, minimum önceden süre, otomatik onay mı yoksa resepsiyon onayı mı.
- Gelen online randevular takvimde "Online" etiketi ve onay bekliyor durumu ile görünür.

### 6.11 Raporlar
- Ciro (gün/hafta/ay, şube), ödeme tipi dağılımı, hizmet/ürün satışları, personel performansı ve prim, doluluk, gelmeyenler, yeni vs dönen müşteri, gider ve net.
- Basit grafikler + tablo; dışa aktarma CSV.

### 6.12 Ayarlar
- Salon bilgileri, logo, şubeler ve çalışma saatleri, kullanıcılar ve roller, mesaj şablonları, online randevu, tema.

## 7. Teknik yapı

### Frontend (ilk aşama)
- React 19 + TypeScript + Vite; katmanlı: `domain/` (tipler, kurallar: müsaitlik, çakışma, fiyat, prim), `application/` (servisler, repository arayüzleri), `infrastructure/` (localStorage repository'leri + seed; ileride HTTP), `components/` + `pages/`.
- Yönlendirme: hash router (GitHub Pages uyumlu).
- Tasarım: CSS değişkenleriyle iki tema (Ferah/Gece), ikonlar için hafif bir ikon seti (lucide), grafikler için hafif bir kütüphane.
- **Demo verisi:** 2 salon (biri 2 şubeli), her birinde 4–6 personel, ~40 hizmet, ~150 müşteri, son 60 güne yayılmış randevular/adisyonlar → raporlar dolu görünsün. Giriş ekranında demo kullanıcıları (Sahip / Resepsiyon / Personel / Comodo yöneticisi) tek tıkla seçilir. "Demo verisini sıfırla" butonu.
- Kurallar (müsaitlik, çakışma, prim, kasa toplamları) birim testleriyle (Vitest).

### Backend (frontend onayından sonra)
- .NET 10 Clean Architecture: Domain / Application / Infrastructure / WebApi + Tests (Detailing projesindeki düzen).
- Çok kiracılık: her varlıkta `TenantId`, EF Core global query filter; JWT içinde kiracı ve rol.
- Veritabanı: *bizim önerimiz* PostgreSQL + EF Core (satılan ürün için kalıcı veri şart); kesin seçim backend aşamasında.
- Domain kuralları frontend `domain/` ile birebir.

## 8. Builder'a bırakılanlar
- Bileşen kütüphanesi detayları, animasyon ayrıntıları, grafik kütüphanesi seçimi.
- Demo verisindeki isimler ve fiyatlar (gerçekçi Türkiye kuaför fiyatları).
- Ürün adı: geçici olarak **"Makas"**; kullanıcı başka bir ad verirse değişir.

## 9. Bizim verdiğimiz kararlar (kullanıcı kontrol etsin)
1. Comodo yöneticisi (platform) paneli eklendi.
2. SMS ön yüzde simüle; WhatsApp `wa.me` ile gerçek elle gönderim.
3. Online randevu varsayılan olarak "resepsiyon onayı gerekir".
4. Takvim ızgarası 15 dakika.
5. Gün sonu kapanışı günü kilitler, sadece sahip açabilir.
6. Backend veritabanı önerisi PostgreSQL.
