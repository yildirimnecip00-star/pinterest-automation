# Pinterest Standard Access — demo videosu senaryosu

Pinterest, Standard access basvurusunda uygulamanin API'yi kullanarak bir islem
tamamladigini gosteren **kisa bir ekran kaydi** ister (~30-60 sn). Asagidaki adimlari
ekran kaydi alirken uygula.

## Hazirlik

- GitHub reposu, Secret'lar ve `PINTEREST_REFRESH_TOKEN` kurulu olsun (SETUP.md Adim 1-4).
- Ekran kaydi araci: Windows'ta **Xbox Game Bar** (`Win + G`) veya herhangi bir kayit
  uygulamasi.

## Kayit adimlari

1. **Uygulama kimligini goster (3-5 sn).**
   developers.pinterest.com -> uygulaman -> App ID gorunecek sekilde bir an bekle.

2. **Otomasyonu baslat (5 sn).**
   GitHub repo -> **Actions** -> "Pinterest pin automation" -> **Run workflow** ->
   `limit` = `1` -> yesil butona bas.

3. **Calismayi ac ve loglari goster (15-20 sn).**
   Baslayan calismaya tikla -> "Pin at" adimini ac. Su satirlar gorunmeli:
   - `Etsy: N uygun ilan bulundu`
   - `Pinterest panosu bulundu / Pano olusturuldu`
   - `Pin olusturuldu: <PIN_ID>`

4. **Summary sekmesini goster (5 sn).**
   Calismanin **Summary** kismindaki `✅ ... → pin <id>` satirini goster.

5. **Pinterest'te sonucu goster (10 sn).**
   pinterest.com -> profilin -> ilgili pano -> yeni olusan pin'i ac. Pin'in
   gorseli (2:3, alt seritte baslik), aciklamasi ve **Etsy linki** gorunsun.
   (Trial erisimindeysen pin yalniz sana gorunur; yine de kayit icin yeterli.)

## Basvuru metni (ornek)

> This is a private automation for my own Etsy shop (Anatolian Kilim Home). It reads
> my shop's public RSS feed, formats each product image to a 2:3 Pin, generates a
> product-specific title and description, discloses that the pattern is AI-designed
> (in text and in image metadata), and creates a Pin on my own Pinterest account via
> POST /v5/pins with the listing URL as the destination link. It runs once per day on
> GitHub Actions, max 30 Pins/day. No third-party users. Privacy policy:
> https://<KULLANICI>.github.io/<REPO>/

## Notlar

- Video 10 MB altinda ve mp4 olsun.
- Yuz / kisisel bilgi gorunmesin; sadece tarayici sekmeleri yeterli.
