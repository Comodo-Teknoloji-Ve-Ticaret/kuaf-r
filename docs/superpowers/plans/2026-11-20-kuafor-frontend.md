# Makas — Kuaför Randevu Sistemi (Frontend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Çok kiracılı kuaför yönetim panelinin backend'siz çalışan, demo verili, GitHub Pages'te yayınlanan TypeScript ön yüzü.

**Architecture:** React 19 + Vite. `domain/` saf TS kurallar (test edilir), `application/` repository arayüzleri ve servisler, `infrastructure/` localStorage implementasyonu + seed, `ui/` ortak bileşenler, `pages/` ekranlar. Tüm veri erişimi `Repos` arayüzü üzerinden; ileride HTTP implementasyonu takılır. Para tutarları **kuruş (integer)**.

**Tech Stack:** React 19, TypeScript 5, Vite, react-router-dom (HashRouter), lucide-react, Vitest, düz CSS (CSS değişkenleri, iki tema).

**Spec:** `docs/superpowers/specs/2026-11-20-kuafor-randevu-design.md`

## Global Constraints
- Arayüz dili Türkçe; para TRY, `Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY'})`; saat dilimi Europe/Istanbul (tarihler `YYYY-MM-DD` + dakika cinsinden gün içi saat olarak tutulur, Date objesi depolanmaz).
- Temalar: `data-theme="light"` (Ferah, vurgu `#6c5ce7`) ve `data-theme="dark"` (Gece, zemin `#121216`, vurgu `#d4b06a`); `system` seçeneği `prefers-color-scheme` izler.
- Takvim ızgarası 15 dk.
- Her kayıt `tenantId` taşır; repository'ler aktif kiracı dışındaki kaydı asla döndürmez.
- Durumlar: `pending | confirmed | arrived | in_service | completed | no_show | cancelled` → Bekliyor · Onaylandı · Geldi · İşlemde · Tamamlandı · Gelmedi · İptal.
- Online randevu varsayılan `requireApproval: true`.
- Kapanmış gün kilitli; yalnız `owner` açabilir.
- Vite `base: './'`, HashRouter; GitHub Actions `frontend/dist` → Pages.
- Mobil kırılım 768px: altında sol menü → alt gezinme, takvim tek personel sütunu.

## Review Focus
1. Telefon biçimleri (`0532 111 22 33`, `+90 532…`, `5321112233`) aynı müşteri sayılmalı → `normalizePhone` testi (Task 2), mükerrer engeli (Task 6).
2. Para yuvarlama: %15 indirim + parçalı ödeme toplamı kuruşu kuruşuna tutmalı → `ticketTotals` testi (Task 2).
3. Online randevu ile resepsiyonun aynı slotu kapması → `findSlots` dolu slotu dönmemeli, kayıt öncesi tekrar kontrol (Task 2, Task 11).
4. Bozuk / eski şemalı localStorage verisi → yükleme hatasında seed'e düşüp uyarı vermeli, çökmemeli (Task 3).
5. Kiracı sızıntısı: Salon A oturumunda Salon B müşteri id'siyle `get` → `undefined` (Task 3).

---

### Task 1: İskelet, tema, CI

**Files:** Create `frontend/` (Vite react-ts), `frontend/src/styles/tokens.css`, `frontend/src/styles/base.css`, `.github/workflows/pages.yml`, `README.md`

- [ ] `npm create vite@latest frontend -- --template react-ts`; ekle: `react-router-dom lucide-react`, dev: `vitest`.
- [ ] `vite.config.ts`: `base:'./'`, `test.environment:'node'`. `package.json` script `"test":"vitest run"`.
- [ ] `tokens.css`: iki tema için `--bg --surface --surface-2 --line --text --muted --accent --accent-contrast --danger --success --warning --radius --shadow` ve kategori renkleri `--cat-boya --cat-kesim --cat-bakim --cat-fon --cat-tirnak --cat-sakal` (her biri bg/border/fg üçlüsü; açık tema mockup B, koyu tema mockup A değerleri).
- [ ] Pages workflow (Node 22, `npm ci && npm run build` in frontend, upload `frontend/dist`).
- [ ] Doğrula: `npm run build` başarılı. Commit `chore: iskelet, tema ve Pages CI`.

### Task 2: Domain modeli ve kurallar

**Files:** Create `frontend/src/domain/types.ts`, `time.ts`, `phone.ts`, `money.ts`, `availability.ts`, `ticket.ts`, `commission.ts`; Test `frontend/src/domain/*.test.ts`

**Interfaces — Produces:**
- `types.ts`: `Tenant{id,name,slug,logoColor,plan,status:'active'|'suspended',onlineBooking:OnlineBookingSettings}`, `Branch{id,tenantId,name,address,phone,hours:WeekHours}`, `User{id,tenantId|null,name,role:'owner'|'reception'|'staff'|'platform',staffId?,branchIds}`, `Staff{id,tenantId,branchId,name,color,title,hours:WeekHours,serviceIds,serviceCommission,productCommission,active}`, `ServiceCategory`, `Service{id,tenantId,categoryId,name,duration,price,online,overrides:Record<staffId,{duration?,price?}>}`, `Customer{id,tenantId,name,phone,birthday?,tags,notes,consentSms,createdAt}`, `Appointment{id,tenantId,branchId,staffId,customerId|null,date,start,end,items:{serviceId,price,duration}[],status,source:'reception'|'online'|'phone'|'walkin',note,code,recurrenceId?}`, `TimeBlock{id,tenantId,staffId,date,start,end,kind:'break'|'leave'|'meeting',note}`, `Ticket{id,tenantId,branchId,date,customerId|null,appointmentId?,lines:TicketLine[],discount:Discount|null,tip,payments:Payment[],status:'open'|'closed'}`, `TicketLine{id,kind:'service'|'product'|'package_sale'|'package_use',refId,staffId?,qty,unitPrice,discount:Discount|null}`, `Discount{type:'percent'|'amount',value}`, `Payment{method:'cash'|'card'|'transfer'|'debt',amount}`, `Expense`, `DayClose{id,tenantId,branchId,date,expectedCash,countedCash,note,closedBy,locked}`, `Product{…,kind:'retail'|'professional',stock,critical,cost,price}`, `StockMove{productId,qty,kind:'in'|'sale'|'use'|'adjust',ticketId?}`, `PackageDef{id,items:{serviceId,count}[],price,validDays}`, `CustomerPackage{id,customerId,packageDefId,remaining:Record<serviceId,number>,expiresOn}`, `MessageTemplate`, `MessageLog`, `WeekHours = Record<0..6,{open:number,close:number}|null>`. Tüm saatler dakika (540 = 09:00), tutarlar kuruş.
- `time.ts`: `toHHMM(min:number):string`, `parseHHMM(s:string):number`, `addDays(date:string,n:number):string`, `weekday(date:string):0..6`, `todayIstanbul():string`.
- `phone.ts`: `normalizePhone(raw:string):string|null` → `"5321112233"` formatı; `formatPhone(n):string` → `"0532 111 22 33"`.
- `money.ts`: `formatTRY(kurus:number):string`, `applyDiscount(amount:number,d:Discount|null):number` (Math.round).
- `availability.ts`: `overlaps(a:{start,end},b):boolean`, `conflictsFor(appt, appts, blocks, staff):Conflict[]` (`'overlap'|'off_hours'|'leave'`), `findSlots(args:{date,duration,staff:Staff[],appts,blocks,branchHours,step?:15,minLeadMin?:number,nowMin?:number}):{staffId,start}[]`.
- `ticket.ts`: `ticketTotals(t:Ticket):{subtotal,discount,total,paid,remaining,debt}`.
- `commission.ts`: `commissionFor(staff:Staff,tickets:Ticket[]):{service:number,product:number,tip:number,total:number}` — yalnız `closed` adisyonlar, indirimden sonraki satır tutarı üzerinden.

- [ ] Testler (önce, başarısız görülmeli):
  - `normalizePhone('0532 111 22 33')`, `('+90 532 111 2233')`, `('5321112233')` hepsi `'5321112233'`; `('123')` → `null`.
  - `applyDiscount(10000,{type:'percent',value:15})` → `8500`; `applyDiscount(999,{type:'percent',value:33})` → `669`.
  - `ticketTotals`: satırlar 45000+30000, toplam %10 indirim, ödeme cash 40000 + card 20000 + debt 7500 → `total 67500, paid 60000, debt 7500, remaining 0`.
  - `overlaps({start:600,end:660},{start:660,end:720})` → `false`.
  - `findSlots`: 09:00–12:00 mesai, 10:00–11:00 dolu, 60 dk hizmet → `[540,660]`; `minLeadMin:120, nowMin:540` ise `540` dönmez.
  - `conflictsFor`: izinli personel → `['leave']`; mesai dışı → `['off_hours']`.
  - `commissionFor`: %40 hizmet, %10 ürün; açık adisyon sayılmaz.
- [ ] `cd frontend && npm test` → FAIL; uygula; → PASS. Commit `feat(domain): model ve kurallar`.

### Task 3: Veri katmanı + demo seed

**Files:** Create `frontend/src/application/repos.ts`, `frontend/src/infrastructure/localStore.ts`, `frontend/src/infrastructure/seed.ts`, `frontend/src/infrastructure/index.ts`; Test `frontend/src/infrastructure/localStore.test.ts`

**Interfaces — Produces:**
- `repos.ts`: `interface Collection<T extends {id:string}>{list(filter?:Partial<T>):T[]; get(id):T|undefined; upsert(item:Omit<T,'tenantId'>&{id?:string}):T; remove(id):void}`; `interface Repos{tenants, branches, users, staff, categories, services, customers, appointments, blocks, tickets, expenses, dayCloses, products, stockMoves, packageDefs, customerPackages, templates, messages}`; `createRepos(store:Store, tenantId:string|null):Repos` (platform kullanıcısı için `null` → tüm kiracılar sadece `tenants` üzerinde).
- `localStore.ts`: `interface Store{read():DB; write(db:DB):void; subscribe(fn):()=>void}`, `createLocalStore(key='makas:v1', storage=localStorage, seedFn=buildSeed):Store`; şema sürümü `DB.version=1`; parse hatası/sürüm uyumsuzluğu → seed + `store.recovered=true`. `resetDemo():void`.
- `seed.ts`: `buildSeed(today:string):DB` — deterministik (sabit tohumlu PRNG). Salon 1 "Studio Lara" (2 şube: Lara, Konyaaltı; 6 personel), Salon 2 "Berber Mert" (1 şube, 4 personel, erkek hizmetleri). ~40 hizmet, ~150 müşteri, bugün −60…+14 gün randevu, geçmiş günlere kapanmış adisyon ve gün sonu, 25 ürün (3'ü kritik), 4 paket tanımı, şablonlar. Demo kullanıcıları: her salonda owner/reception/staff + `platform` "Comodo Yönetici".
- `index.ts`: React `DataProvider`, `useRepos():Repos`, `useDb<T>(selector)` (store.subscribe ile yeniden render).

- [ ] Testler: kiracı A ile oluşturulan `customers.upsert` kaydı kiracı B'nin `get`'inde `undefined`; `list()` sadece aktif kiracı; bozuk JSON (`"{oops"`) → seed yüklenir, `recovered===true`; `buildSeed('2026-11-20')` iki çağrıda eşit.
- [ ] FAIL → uygula → PASS. Commit `feat(data): localStorage repository ve demo seed`.

### Task 4: Oturum, roller, uygulama kabuğu

**Files:** Create `frontend/src/app/session.tsx`, `frontend/src/app/App.tsx`, `frontend/src/app/routes.tsx`, `frontend/src/ui/Shell.tsx`, `frontend/src/ui/` (Button, Input, Select, Drawer, Modal, Badge, Avatar, Kpi, EmptyState, Toast, Tabs), `frontend/src/pages/Login.tsx`; Test `frontend/src/app/permissions.test.ts`

**Interfaces — Produces:** `useSession():{user,tenant,branchId,setBranch,logout,theme,setTheme}`; `can(role, perm:'calendar.all'|'cash'|'reports'|'settings'|'stock'|'customers'|'platform'):boolean`; rotalar `/takvim /musteriler /kasa /hizmetler /personel /stok /paketler /mesajlar /raporlar /ayarlar /platform /r/:slug /giris`.

- [ ] Test: `can('staff','cash')===false`, `can('reception','cash')===true`, `can('reception','settings')===false`, `can('owner','platform')===false`.
- [ ] Giriş: demo kullanıcı kartları (salon logosu, rol), tek tık giriş. Kabuk: sol menü (ikon+etiket, rol filtresi), üst bar (şube seçici, tema anahtarı Açık/Koyu/Sistem, kullanıcı menüsü, "Demo'yu sıfırla"), <768px alt gezinme + "Daha fazla" sayfası. `recovered` ise toast.
- [ ] `npm test && npm run build` PASS. Commit `feat(app): oturum, roller ve kabuk`.

### Task 5: Takvim

**Files:** Create `frontend/src/pages/calendar/CalendarPage.tsx`, `DayGrid.tsx`, `WeekGrid.tsx`, `AppointmentCard.tsx`, `AppointmentDrawer.tsx`, `useDragAppointment.ts`, `calendar.css`; Create `frontend/src/application/appointmentService.ts`; Test `frontend/src/application/appointmentService.test.ts`

**Interfaces — Produces:** `appointmentService(repos)`: `create(input):{appt,conflicts}`, `move(id,{staffId,date,start}):{appt,conflicts}`, `resize(id,end)`, `setStatus(id,status)`, `walkIn({staffId?,serviceIds,customerId?})` (ilk müsait personel, şimdi'ye yuvarlanmış 15 dk), `repeat(id,everyWeeks,count)`, `toTicket(id):Ticket` (tek açık adisyon; tekrar çağrıda aynısını döner). Kod biçimi `MK-XXXXXX`.

- [ ] Testler: `toTicket` iki kez → aynı ticket id; `walkIn` boş personel yoksa en yakın boşalan; `move` çakışmada kaydeder ama `conflicts` dolu döner; `repeat(id,4,3)` 3 yeni randevu, ortak `recurrenceId`.
- [ ] UI: üst KPI şeridi (randevu, beklenen ciro, salondakiler, doluluk %), Gün/Hafta, tarih ileri-geri + "Bugün", personel başlıkları avatar, 15 dk ızgara (saat çizgileri 60 dk'da belirgin), mesai dışı/blok taralı, kırmızı "şu an" çizgisi, kartlar kategori rengiyle (iptal soluk, gelmedi üstü çizili rozetli), pointer events ile sürükle (15 dk'ya yapış, sütun değişimi) ve alttan boyutlandır; çakışmada onay modalı. Boş hücre tık → sağ Drawer: müşteri arama (telefon/ad, "Yeni müşteri" satır içi), çoklu hizmet çipleri (süre/fiyat personele göre), personel, saat, not, kaydet. Kart tık → detay Drawer: durum adımları butonları, Adisyona aktar, WhatsApp hatırlatma, Tekrarla, İptal. "Randevusuz" butonu. Mobil: personel seçici şerit, tek sütun, FAB.
- [ ] PASS + build. Tarayıcıda elle kontrol: sürükle-bırak, mobil görünüm. Commit `feat(takvim): gün/hafta, sürükle-bırak, hızlı randevu`.

### Task 6: Müşteriler

**Files:** Create `frontend/src/pages/customers/CustomersPage.tsx`, `CustomerDetail.tsx`; Create `frontend/src/application/customerService.ts`; Test `customerService.test.ts`

**Interfaces:** `customerService(repos)`: `save(input):{ok:true,customer}|{ok:false,error:'duplicate_phone'|'invalid_phone',existingId?}`, `stats(id):{visits,totalSpent,lastVisit,noShows,balance}`, `search(q):Customer[]` (ad veya normalize telefon parçası).
- [ ] Test: `'0532 111 22 33'` kayıtlıyken `'+905321112233'` → `duplicate_phone` + `existingId`; `stats` gelmedi sayısı `no_show` randevulardan; `balance` veresiye − tahsilat.
- [ ] UI: arama + etiket filtresi listesi; detay sekmeleri Genel / Randevular / Satışlar / Paketler / Notlar & Formül; "Randevu ver", "WhatsApp". Commit `feat(musteri): liste, kart, mükerrer engeli`.

### Task 7: Hizmetler ve personel

**Files:** Create `frontend/src/pages/services/ServicesPage.tsx`, `frontend/src/pages/staff/StaffPage.tsx`, `StaffDetail.tsx`
- [ ] Hizmetler: kategori grupları, satır içi süre/fiyat düzenleme, çalışana özel fark tablosu, online görünürlük anahtarı. Personel: kart ızgarası, haftalık mesai editörü (gün başına aç/kapa + saatler), izin/blok ekleme, hizmet seçimi, prim oranları, bu ay prim özeti (`commissionFor`).
- [ ] Build PASS, elle kontrol. Commit `feat: hizmet ve personel yönetimi`.

### Task 8: Kasa

**Files:** Create `frontend/src/pages/cash/CashPage.tsx`, `TicketEditor.tsx`, `PaymentModal.tsx`, `DayClosePanel.tsx`, `ExpensesPanel.tsx`; Create `frontend/src/application/cashService.ts`; Test `cashService.test.ts`

**Interfaces:** `cashService(repos, user)`: `addLine(ticketId,line)`, `pay(ticketId,payments:Payment[]):{ok}|{ok:false,error:'overpaid'|'day_locked'}`, `close(ticketId)` (randevu → `completed`, ürün satışı → StockMove `sale`, paket satışı → CustomerPackage, `package_use` → kalan seans −1), `collectDebt(customerId,amount,method)`, `addExpense`, `expectedCash(branchId,date)`, `closeDay(branchId,date,counted,note)`, `reopenDay(id)` (owner değilse hata).
- [ ] Testler: kilitli günde `pay` → `day_locked`; fazla ödeme → `overpaid`; ürün satışı stok düşer; `package_use` kalan 0 iken hata `no_sessions`; `expectedCash` = nakit ödemeler + nakit tahsilat − nakit gider; reception `reopenDay` → hata.
- [ ] UI: sol açık adisyonlar listesi, sağ editör (hizmet/ürün/paket ekle arama, satır indirim, toplam indirim, bahşiş), Ödeme modalı (hızlı "Tamamı nakit/kart", parçalı, veresiye), gün özeti, giderler, gün sonu kapanış. Commit `feat(kasa): adisyon, ödeme, veresiye, gün sonu`.

### Task 9: Stok ve paketler

**Files:** Create `frontend/src/pages/stock/StockPage.tsx`, `frontend/src/pages/packages/PackagesPage.tsx`
- [ ] Stok: ürün listesi, kritik rozet (menüde de sayı), hareket ekle (giriş/kullanım/sayım), hareket geçmişi. Paketler: tanım CRUD, satılmış paketler (kalan, bitiş; süresi geçmişler soluk).
- [ ] Build PASS. Commit `feat: stok ve paket yönetimi`.

### Task 10: Mesajlar ve hatırlatma

**Files:** Create `frontend/src/domain/template.ts` (+test), `frontend/src/pages/messages/MessagesPage.tsx`, `frontend/src/application/messageService.ts`
**Interfaces:** `renderTemplate(tpl:string, vars:Record<string,string>):string` (`{musteri} {salon} {tarih} {saat} {hizmet} {personel}`; bilinmeyen değişken olduğu gibi kalır); `messageService.send(kind, appointmentId|customerId, channel:'sms'|'whatsapp')` → MessageLog (`status:'simulated'`), whatsapp ise `https://wa.me/90<phone>?text=…` döner; `dueReminders(now)` → hatırlatılacak randevular.
- [ ] Test `renderTemplate`. UI: şablon editörü (önizleme), gönderim kayıtları, "Yarınki randevulara hatırlatma gönder" toplu butonu, doğum günü listesi. Commit `feat: mesaj şablonları ve hatırlatma`.

### Task 11: Online randevu sayfası

**Files:** Create `frontend/src/pages/booking/BookingPage.tsx`, `booking.css`; Create `frontend/src/application/bookingService.ts`; Test `bookingService.test.ts`
**Interfaces:** `bookingService(store, slug)`: `info()`, `slots(branchId,serviceIds,staffId|'any',date)`, `book(input):{ok,code}|{ok:false,error:'slot_taken'|'disabled'|'invalid_phone'}` — kayıttan hemen önce slot yeniden doğrulanır; müşteri telefonla eşleştirilir/oluşturulur; `status = requireApproval ? 'pending':'confirmed'`, `source:'online'`.
- [ ] Testler: aynı slot ikinci `book` → `slot_taken`; online kapalı → `disabled`; `requireApproval` → `pending`.
- [ ] UI (oturumsuz, salon renkleriyle): adımlar şube → hizmet → personel/fark etmez → tarih şeridi + saatler → ad/telefon → onay kartı (kod, .ics indir). Takvimde online + bekleyen rozet, üst barda bekleyen onay sayısı. Commit `feat: online randevu sayfası`.

### Task 12: Raporlar

**Files:** Create `frontend/src/application/reportService.ts` (+test), `frontend/src/pages/reports/ReportsPage.tsx`, `frontend/src/ui/charts.tsx` (SVG çubuk/çizgi/halka, kütüphanesiz)
**Interfaces:** `reportService(repos)`: `revenue(range,branchId?)` gün bazlı seri, `byPayment`, `byService`, `byStaff` (ciro+prim), `occupancy`, `noShows`, `newVsReturning`, `expensesNet`; `toCSV(rows):string`.
- [ ] Test: `revenue` yalnız closed adisyonlar; `toCSV` `;` ayraç ve Türkçe karakter. UI: tarih aralığı (Bugün/7 gün/Bu ay/Geçen ay), KPI kartları, grafikler, tablolar, CSV indir. Commit `feat: raporlar`.

### Task 13: Ayarlar ve Comodo platform paneli

**Files:** Create `frontend/src/pages/settings/SettingsPage.tsx`, `frontend/src/pages/platform/PlatformPage.tsx`
- [ ] Ayarlar sekmeleri: Salon (ad, logo rengi, slug + online link kopyala), Şubeler & saatler, Kullanıcılar & roller, Online randevu (açık, ileri gün, min. önceden saat, onay gerekli), Tema. Platform: salon listesi (şube/personel/randevu sayısı, durum), yeni salon oluştur (sahip kullanıcısıyla), askıya al (askıdaki salona giriş engellenir ve booking `disabled`).
- [ ] Build PASS. Commit `feat: ayarlar ve platform paneli`.

### Task 14: Cila, mobil, yayın

- [ ] Tüm sayfaları 375px ve 1440px'te kontrol, boş durumlar, yükleme/geçiş animasyonları, klavye kısayolları (takvimde `N` yeni randevu, `T` bugün, ←/→ gün).
- [ ] `npm test && npm run build` PASS. README güncelle (özellikler, demo girişleri, yapı). GitHub'a push, Pages yayını kontrol. Commit `chore: cila ve yayın`.
