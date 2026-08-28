const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

function csv(value, fallback) {
  return (value || fallback)
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

const isCI = !!process.env.CI;

// Etsy magaza adi: https://anatoliankilimhome.etsy.com -> RSS icin "AnatolianKilimHome"
// (RSS yolu buyuk/kucuk harfe duyarsiz calisiyor ama kanonik hali boyle).
const shopName = process.env.ETSY_SHOP_NAME || "AnatolianKilimHome";

module.exports = {
  isCI,
  etsy: {
    shopName,
    rssUrl: `https://www.etsy.com/shop/${shopName}/rss`,
    shopUrl: `https://www.etsy.com/shop/${shopName}`,
    // Baslik bu kelimelerden birini iceriyorsa ilgili kategoriye girer.
    // Sira onemli: "mini-rug" kontrolu "rug"tan once yapilir (index.js/etsyClient.js).
    categories: {
      pillow: csv(process.env.ETSY_PILLOW_KEYWORDS, "pillow,cushion,pillowcase,lumbar,sham"),
      "mini-rug": csv(
        process.env.ETSY_MINI_RUG_KEYWORDS,
        "mini rug,small rug,accent rug,mat,doormat,bath rug,kitchen rug,2x3,3x5"
      ),
      rug: csv(process.env.ETSY_RUG_KEYWORDS, "rug,carpet,kilim,oushak,runner"),
    },
    // Bu kelimelerden biri gecen ilanlar tamamen atlanir (ornek: dijital urun).
    excludeKeywords: csv(process.env.ETSY_EXCLUDE_KEYWORDS, "digital,printable,pdf,pattern only,mockup"),
  },
  pinterest: {
    clientId: process.env.PINTEREST_CLIENT_ID || "",
    clientSecret: process.env.PINTEREST_CLIENT_SECRET || "",
    redirectUri: process.env.PINTEREST_REDIRECT_URI || "https://localhost/callback",
    // Ikisinden biri yeterli: dogrudan board id, yoksa isimle bul/olustur.
    boardId: process.env.PINTEREST_BOARD_ID || "",
    boardName: process.env.PINTEREST_BOARD_NAME || "Anatolian Kilim Home",
    // CI'da bu secret'tan; yerelde data/pinterest-tokens.json'dan okunur.
    refreshToken: process.env.PINTEREST_REFRESH_TOKEN || "",
  },
  anthropic: {
    // Opsiyonel: yoksa captionGenerator sablon moduna duser.
    apiKey: process.env.ANTHROPIC_API_KEY || "",
    model: process.env.ANTHROPIC_MODEL || "claude-opus-5",
  },
  image: {
    // Pin gorsel tasarimi: editorial | gallery | split | postcard | banner | blur
    variant: (process.env.IMAGE_VARIANT ||
      (process.env.IMAGE_STYLE === "blur" ? "blur" : "postcard")).toLowerCase(),
    brandCream: process.env.IMAGE_CREAM || "#F4EDE4",
    brandSand: process.env.IMAGE_SAND || "#E7DCCB",
    brandDark: process.env.IMAGE_DARK || "#3B2A21",
    brandTerracotta: process.env.IMAGE_TERRACOTTA || "#8C4A32",
    shopHandle: process.env.IMAGE_SHOP_HANDLE || "anatoliankilimhome",
  },
  schedule: {
    maxPinsPerDay: parseInt(process.env.MAX_PINS_PER_DAY || "30", 10),
    // Tek calismada en fazla kac pin (workflow_dispatch input'u buraya gecer).
    perRunLimit: parseInt(process.env.PER_RUN_LIMIT || "30", 10),
    // CI: pinler arasi sabit kisa bekleme (sn). Yerel: rastgele dakika araligi.
    pinDelaySeconds: parseFloat(process.env.PIN_DELAY_SECONDS || "8"),
    minDelayMinutes: parseFloat(process.env.MIN_DELAY_MINUTES || "3"),
    maxDelayMinutes: parseFloat(process.env.MAX_DELAY_MINUTES || "8"),
    // Bir ilani kac gun sonra "taze pin" olarak tekrar yayinlayabilir (0 = asla).
    repinAfterDays: parseInt(process.env.REPIN_AFTER_DAYS || "0", 10),
  },
  paths: {
    root: path.join(__dirname, ".."),
  },
  // Pinterest'e gercek istek atmadan once cagrilir (dry-run bunu atlar).
  assertPinterest() {
    const missing = [];
    if (!this.pinterest.clientId) missing.push("PINTEREST_CLIENT_ID");
    if (!this.pinterest.clientSecret) missing.push("PINTEREST_CLIENT_SECRET");
    if (missing.length) {
      throw new Error(`Eksik Pinterest ayari: ${missing.join(", ")}`);
    }
  },
};
