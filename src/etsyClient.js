const { XMLParser } = require("fast-xml-parser");
const { etsy } = require("./config");
const logger = require("./logger");

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchText(url, { tries = 3 } = {}) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": UA,
          Accept: "application/rss+xml, application/xml, text/xml, */*",
          "Accept-Language": "en-US,en;q=0.9",
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      lastErr = err;
      logger.warn(`Etsy istegi basarisiz (${i + 1}/${tries}) ${url}: ${err.message}`);
      if (i < tries - 1) await sleep(1500 * (i + 1));
    }
  }
  throw new Error(`Etsy istegi ${tries} denemede alinamadi: ${lastErr.message}`);
}

function listingIdFromLink(link) {
  const m = /\/listing\/(\d+)/.exec(link || "");
  return m ? m[1] : null;
}

function firstImageFromHtml(html) {
  const m = /<img[^>]+src="([^"]+)"/i.exec(html || "");
  return m ? m[1] : null;
}

function priceFromHtml(html) {
  const m = /<p class="price">([^<]+)<\/p>/i.exec(html || "");
  return m ? m[1].trim() : "";
}

// il_570xN / il_680xN / il_794xN -> il_1140xN (Pinterest icin yuksek cozunurluk)
function upgradeImage(url) {
  if (!url) return url;
  return url.replace(/il_\d+xN\./, "il_1140xN.");
}

// Kisa aciklama: <p class="description"> icindeki ilk paragraf(lar), etiket temizlenmis
function shortDescriptionFromHtml(html) {
  const m = /<p class="description">([\s\S]*?)<\/p>/i.exec(html || "");
  if (!m) return "";
  return m[1]
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;#39;/g, "'")
    .replace(/&amp;quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 900);
}

const COLOR_WORDS = [
  "cream", "beige", "ivory", "rust", "sage", "green", "blue", "navy", "taupe",
  "charcoal", "grey", "gray", "brown", "terracotta", "gold", "pink", "black", "white",
  "burgundy", "mustard", "tan", "camel", "red", "orange", "coral", "olive", "plum",
];

function colorWord(title) {
  const t = (title || "").toLowerCase();
  return COLOR_WORDS.find((c) => t.includes(c)) || "";
}

// Sadece acikca "ft/feet" birimi yazan olculeri alir (yastik "16x16" -> es gecilir).
function sizeText(title) {
  const m = /(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(ft|feet|foot)\b/i.exec(title || "");
  if (!m) return "";
  return `${m[1]} x ${m[2]} ft`;
}

// Pin gorselinin alt seridinde gosterilecek KISA baslik (SEO basligi ayri).
function shortLabel(title, category) {
  const color = colorWord(title);
  const cap = color ? color[0].toUpperCase() + color.slice(1) : "";
  if (category === "pillow") {
    return `${cap} Kilim Pillow Covers`.trim();
  }
  if (category === "mini-rug") {
    return `${cap} Turkish Accent Rug`.trim();
  }
  const oushak = /oushak/i.test(title) ? "Oushak" : "Turkish";
  const size = sizeText(title);
  return `${cap} ${oushak} Rug`.trim() + (size ? `\n${size}` : "");
}

function categorize(title) {
  const t = (title || "").toLowerCase();
  if (etsy.excludeKeywords.some((k) => t.includes(k))) return null;
  // Sira: mini-rug once (daha spesifik), sonra pillow, sonra genel rug.
  if (etsy.categories["mini-rug"].some((k) => t.includes(k))) return "mini-rug";
  if (etsy.categories.pillow.some((k) => t.includes(k))) return "pillow";
  if (etsy.categories.rug.some((k) => t.includes(k))) return "rug";
  return null;
}

function parseRss(xml) {
  const parser = new XMLParser({ ignoreAttributes: false, htmlEntities: true });
  const doc = parser.parse(xml);
  let items = doc?.rss?.channel?.item ?? [];
  if (!Array.isArray(items)) items = [items];

  const listings = [];
  for (const it of items) {
    const link = String(it.link || "").replace(/\?ref=rss.*$/, "");
    const listingId = listingIdFromLink(link);
    if (!listingId) continue;
    const html = typeof it.description === "string" ? it.description : "";
    const title = String(it.title || "").trim();
    const category = categorize(title);
    if (!category) {
      logger.info(`Atlaniyor (kategori yok): "${title.slice(0, 60)}"`);
      continue;
    }
    const imageUrl = upgradeImage(firstImageFromHtml(html));
    if (!imageUrl) {
      logger.warn(`Atlaniyor (gorsel yok): "${title.slice(0, 60)}"`);
      continue;
    }
    listings.push({
      listingId,
      title,
      url: link,
      imageUrl,
      category,
      label: shortLabel(title, category),
      color: colorWord(title),
      size: sizeText(title),
      price: priceFromHtml(html),
      description: shortDescriptionFromHtml(html),
      pubDate: it.pubDate || null,
    });
  }
  return listings;
}

async function fetchListings() {
  logger.info(`Etsy RSS okunuyor: ${etsy.rssUrl}`);
  const xml = await fetchText(etsy.rssUrl);
  const listings = parseRss(xml);
  const byCat = listings.reduce((acc, l) => {
    acc[l.category] = (acc[l.category] || 0) + 1;
    return acc;
  }, {});
  logger.info(
    `Etsy: ${listings.length} uygun ilan bulundu ` +
      `(${Object.entries(byCat).map(([k, v]) => `${k}:${v}`).join(", ") || "-"})`
  );
  if (listings.length === 0) {
    throw new Error(
      "RSS'ten hic uygun ilan cikmadi. Magaza adi (ETSY_SHOP_NAME) dogru mu, " +
        "kategori anahtar kelimeleri ilan basliklarini kapsiyor mu kontrol et."
    );
  }
  return listings;
}

function mainImageUrl(listing) {
  return listing.imageUrl;
}

module.exports = { fetchListings, mainImageUrl, categorize, parseRss };
