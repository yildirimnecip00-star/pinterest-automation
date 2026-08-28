# Kurulum Rehberi (GitHub Actions ile tam otomatik)

Bu otomasyon **GitHub'in sunucularinda** her gun kendi kendine calisir — senin
bilgisayarinin acik olmasi gerekmez.

Her calismada sunlari yapar:

1. `AnatolianKilimHome` Etsy magazasinin **RSS akisini** okur (API anahtari gerekmez).
2. Ilanlari **pillow / mini-rug / rug** diye ayirir.
3. Her ilanin fotografini Pinterest'in onerdigi **2:3 (1000x1500)** formata getirir:
   krem zemin + altta marka seridinde urune ozel kisa baslik + `anatoliankilimhome`
   + `AI-designed pattern` yazisi.
4. JPEG'e "**AI ile uretildi**" metadata'si gomer (IPTC/XMP `DigitalSourceType`).
5. Claude ile (veya anahtar yoksa sablonla) **urune ozel baslik + aciklama + alt-text**
   uretir; aciklamada desenin AI ile tasarlandigini dogal bir cumleyle belirtir.
6. Etsy ilan linkini pin'e baglar ve **resmi Pinterest API'si** ile pin'i olusturur.
7. Gunde en fazla `MAX_PINS_PER_DAY` (30) pin atar, her ilani **sadece bir kez** pinler
   (`data/state.json`'da takip edilir, her calismada repoya commit'lenir).

---

## ⚠️ Onemli: Pinterest "Trial" vs "Standard" erisim

Yeni Pinterest uygulamalari **Trial** erisimiyle baslar. Trial'de olusturulan pinler
**yalnizca senin hesabinda gorunur** (sandbox) — baskalari goremez.

Herkese acik gercek pin atabilmek icin Pinterest'ten **Standard access** onayi almak
gerekir: Business hesap + gizlilik politikasi URL'si + kisa bir ekran kaydi ile basvuru
(bkz. `docs/standard-access-demo-script.md` ve `docs/privacy-policy.md`).

Iyi haber: **kod tarafinda hicbir sey degismez.** Trial'de sistemi tamamen kurup test
edersin; Standard onaylandiginda ayni token, ayni kod herkese acik pin atmaya baslar.

---

## Adim 1 — GitHub reposu

1. github.com'da yeni bir **private** repo ac (or. `pinterest-automation`).
2. Bu klasoru (`pinterest-automation/`) o repoya yukle:

   ```bash
   cd pinterest-automation
   git init
   git add .
   git commit -m "ilk kurulum"
   git branch -M main
   git remote add origin https://github.com/<KULLANICI>/<REPO>.git
   git push -u origin main
   ```

   > `.env` ve `node_modules/` `.gitignore`'da — yuklenmez, dogru olan bu.

## Adim 2 — Pinterest uygulamasi

1. https://developers.pinterest.com -> giris yap -> **Connect app** / **Create app**.
2. Uygulama ayarlarinda **Redirect URI** olarak `https://localhost/callback` ekle
   (calisan bir sayfa olmasi gerekmez).
3. **App ID (Client ID)** ve **App secret (Client Secret)** degerlerini not al.

## Adim 3 — Repo Secret'lari

GitHub repo -> **Settings -> Secrets and variables -> Actions -> New repository secret**.
Sunlari ekle:

| Secret | Deger |
|---|---|
| `PINTEREST_CLIENT_ID` | Adim 2'deki App ID |
| `PINTEREST_CLIENT_SECRET` | Adim 2'deki App secret |
| `ANTHROPIC_API_KEY` | (opsiyonel) console.anthropic.com API anahtari — yoksa sablon metin |

`PINTEREST_REFRESH_TOKEN` ve (istersen) `PINTEREST_BOARD_ID` sonraki adimda eklenecek.

## Adim 4 — Pinterest yetkilendirme (tek sefer)

1. Repo -> **Actions** sekmesi -> soldan **"Pinterest OAuth (tek seferlik)"** ->
   **Run workflow** (input'u BOS birak) -> calistir.
2. Acilan calismanin loglarinda bir **yetkilendirme URL'si** var. Onu tarayicida ac,
   Pinterest hesabinla (`mehmetnecibyildirim`) izin ver.
3. Tarayici `https://localhost/callback?code=XXXXX...` adresine gider (sayfa acilmasa
   da olur). Adres cubugundaki **`code=` sonrasi degeri** kopyala.
4. Ayni workflow'u tekrar **Run workflow** — bu sefer **code** alanina yapistir.
5. Yeni calismanin loglarinda:
   - `PINTEREST_REFRESH_TOKEN` -> repoya secret olarak ekle.
   - **Pano listesi** -> pin atmak istedigin panonun id'sini `PINTEREST_BOARD_ID`
     secret'i olarak ekle. (Hic pano yoksa: Pinterest'te bir pano olustur ve bu
     workflow'u tekrar calistir, ya da hic ekleme — sistem `PINTEREST_BOARD_NAME`
     ("Anatolian Kilim Home") adiyla otomatik pano olusturur.)

## Adim 5 — Ilk gercek pin (test)

1. Repo -> **Actions** -> **"Pinterest pin automation"** -> **Run workflow** ->
   `limit` = `1` -> calistir.
2. Loglarda `Pin olusturuldu: <id>` gorunmeli; ozet (Summary) sekmesinde detay var.
   `data/state.json` otomatik commit'lenir.
3. Trial erisimindeysen pin sadece senin hesabinda gorunur — bu **normal**.
4. Workflow'u tekrar calistir: ayni ilan tekrar pinlenmez ("Pinlenecek yeni ilan yok").

## Adim 6 — Otomatik gunluk calisma

`.github/workflows/pin.yml` zaten her gun **09:00 UTC** (~TR 12:00) calisacak sekilde
ayarli. Saati degistirmek icin dosyadaki `cron: "0 9 * * *"` satirini duzenle
([crontab.guru](https://crontab.guru)).

Durdurmak icin: Actions -> ilgili workflow -> **"..." -> Disable workflow**.

## Adim 7 — Standard access basvurusu (herkese acik pinler icin)

1. Pinterest hesabini **Business**'a cevir (ucretsiz, Settings -> Account management).
2. `docs/privacy-policy.md` dosyasini yayinla (repo -> Settings -> Pages -> Deploy from
   branch -> `main` -> `/docs`). Cikan URL'yi basvuruda kullan.
3. developers.pinterest.com -> uygulaman -> **Upgrade to Standard access**. Istenen kisa
   ekran kaydi icin `docs/standard-access-demo-script.md` senaryosunu izle.
4. Onay gelince: hicbir sey yapman gerekmez — bir sonraki gunluk calismada pinler
   herkese acik atilmaya baslar.

---

## Yerel test (opsiyonel)

Node.js 20+ kurulu ise, bu klasorde:

```bash
npm install
cp .env.example .env          # doldur (en azindan Pinterest degerleri)
npm run variants              # 5 tasariminin hepsini ornek urunlerde uretir
npm run dry-run               # secili tasarimda PIN ATMADAN 3 ornek uretir
npm run auth                  # yerelde refresh_token almak istersen
node src/index.js --count=1   # tek gercek pin
```

- `npm run variants` -> `preview/variants/_compare__*.jpg` karsilastirma montajlari.
  Begendigini `IMAGE_VARIANT` ile sec (repo -> Settings -> Variables -> `IMAGE_VARIANT`
  = `postcard` | `editorial` | `gallery` | `split` | `banner`). Varsayilan `postcard`.
- `npm run dry-run` -> `preview/<id>.jpg` + `.json` ile gorsel + metni kontrol et.

## Alternatif: kendi bilgisayarinda zamanlanmis gorev

GitHub Actions yerine Windows Gorev Zamanlayici kullanmak istersen (PC o saatte acik
olmali):

```powershell
powershell -ExecutionPolicy Bypass -File scripts\register-task.ps1 -Time "12:00"
```

## Sorun giderme

| Belirti | Cozum |
|---|---|
| `RSS'ten hic uygun ilan cikmadi` | `ETSY_SHOP_NAME` dogru mu? Basliklarda kategori kelimeleri var mi? |
| `Eksik Pinterest ayari` | `PINTEREST_CLIENT_ID` / `SECRET` secret'lari eksik |
| `Pinterest 401` | `PINTEREST_REFRESH_TOKEN` suresi dolmus (~1 yil) -> Adim 4'u tekrarla |
| Pin atiliyor ama gorunmuyor | Trial erisimindesin -> Adim 7 (Standard access) |
| Fontlar bozuk | `assets/fonts/*.ttf` repoda mi kontrol et |
