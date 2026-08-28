// Her tasarim varyantini ornek urunlerde uretir + karsilastirma montaji yapar.
// Calistir:  node scripts/preview-variants.js  [urun_sayisi=2]
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const etsy = require("../src/etsyClient");
const img = require("../src/imageProcessor");

const OUT = path.join(__dirname, "..", "preview", "variants");
const VARIANTS = img.VARIANT_NAMES.filter((v) => v !== "blur");

async function main() {
  const n = parseInt(process.argv[2] || "2", 10);
  fs.mkdirSync(OUT, { recursive: true });

  const all = await etsy.fetchListings();
  // Cesitlilik icin: ilk rug + ilk pillow + ... sonra sirayla doldur
  const picks = [];
  for (const cat of ["rug", "pillow", "mini-rug"]) {
    const hit = all.find((l) => l.category === cat && !picks.includes(l));
    if (hit) picks.push(hit);
  }
  for (const l of all) {
    if (picks.length >= n) break;
    if (!picks.includes(l)) picks.push(l);
  }
  picks.length = Math.min(picks.length, n);

  for (const listing of picks) {
    console.log(`\n=== ${listing.listingId} (${listing.category}) ${listing.title.slice(0, 60)}`);
    const src = await img.downloadImage(listing.imageUrl);
    const tiles = [];
    for (const v of VARIANTS) {
      const buf = await img.renderVariant(v, src, {
        label: listing.label,
        category: listing.category,
      });
      const file = path.join(OUT, `${v}__${listing.listingId}.jpg`);
      fs.writeFileSync(file, buf);
      console.log(`  ${v.padEnd(9)} -> preview/variants/${path.basename(file)}`);
      // montaj icin kucult + etiket
      const cell = await sharp(buf).resize(360, 540).toBuffer();
      const label = Buffer.from(
        `<svg width="360" height="46" xmlns="http://www.w3.org/2000/svg"><rect width="360" height="46" fill="#1E1612"/><text x="180" y="30" text-anchor="middle" font-family="sans-serif" font-size="22" fill="#fff" letter-spacing="2">${v.toUpperCase()}</text></svg>`
      );
      const labelled = await sharp({
        create: { width: 360, height: 586, channels: 3, background: "#1E1612" },
      })
        .composite([
          { input: cell, left: 0, top: 0 },
          { input: label, left: 0, top: 540 },
        ])
        .png()
        .toBuffer();
      tiles.push(labelled);
    }
    const montW = 360 * tiles.length;
    const montage = await sharp({
      create: { width: montW, height: 586, channels: 3, background: "#1E1612" },
    })
      .composite(tiles.map((t, i) => ({ input: t, left: i * 360, top: 0 })))
      .jpeg({ quality: 82 })
      .toBuffer();
    const mfile = path.join(OUT, `_compare__${listing.category}__${listing.listingId}.jpg`);
    fs.writeFileSync(mfile, montage);
    console.log(`  MONTAJ    -> preview/variants/${path.basename(mfile)}`);
  }

  await img.shutdown();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
