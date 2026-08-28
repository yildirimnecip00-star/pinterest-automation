# Anatolian Kilim Home — Etsy → Pinterest otomasyonu

Etsy magazasindaki urunleri (pillow / mini-rug / rug) her gun otomatik olarak
Pinterest'e, urune ozel baslik + aciklama + Etsy linki ile, 2:3 markali gorsel ve
"AI ile tasarlandi" isareti ile pinler. GitHub Actions'ta calisir; bilgisayarin
kapali olsa da devam eder.

## Nasil calisir

```
Etsy RSS  ──▶  kategorize  ──▶  Claude/sablon ile metin  ──▶  1000x1500 markali gorsel
(anahtarsiz)     (pillow/rug)      (baslik+aciklama+alt)         + IPTC/XMP AI metadata
                                                                        │
                                            Pinterest API v5  ◀─────────┘
                                            POST /v5/pins (link = Etsy ilani)
```

- Gunde en fazla **30 pin**, her ilan **bir kez** (`data/state.json`).
- Metin uretimi: `ANTHROPIC_API_KEY` varsa Claude (`claude-opus-5`), yoksa sablon.
- 5 gorsel tasarimi: `postcard` (varsayilan), `editorial`, `gallery`, `split`, `banner`
  — hepsini gormek icin `npm run variants`, secmek icin `IMAGE_VARIANT`.

## Kurulum

Adim adim: **[SETUP.md](SETUP.md)**

Kisaca: private repo → Pinterest app → repo Secret'lari → `auth.yml` ile bir kez
yetkilendir → `pin.yml` gunluk cron. Herkese acik pinler icin Pinterest **Standard
access** basvurusu (bkz. [docs/](docs/)).

## Yerel test

```bash
npm install
cp .env.example .env
npm run dry-run    # pin ATMADAN preview/ klasorune ornek uretir
```

## Dosyalar

| Yol | Ne yapar |
|---|---|
| `src/etsyClient.js` | Magaza RSS'ini okur, kategorize eder, gorseli 1140px'e yukseltir |
| `src/imageProcessor.js` | 2:3 markali pin gorseli + AI metadata (`exiftool`) |
| `src/captionGenerator.js` | Urune ozel baslik/aciklama (Claude veya sablon) |
| `src/pinterestClient.js` | OAuth refresh, pano bul/olustur, `POST /v5/pins` |
| `src/index.js` | Orkestrasyon, gunluk limit, state, ozet |
| `.github/workflows/pin.yml` | Gunluk cron |
| `.github/workflows/auth.yml` | Tek seferlik OAuth yardimcisi |
