const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { image, paths } = require("./config");
const logger = require("./logger");

// ── Fontconfig: paketle gelen fontlari sharp/librsvg'e tanit (sharp'tan ONCE) ──
const FONT_DIR = path.join(paths.root, "assets", "fonts");
(function setupFontconfig() {
  try {
    const cacheDir = path.join(os.tmpdir(), "fontconfig-cache");
    fs.mkdirSync(cacheDir, { recursive: true });
    const d = FONT_DIR.replace(/\\/g, "/");
    const c = cacheDir.replace(/\\/g, "/");
    const conf = `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <dir>${d}</dir>
  <cachedir>${c}</cachedir>
  <match target="pattern"><test name="family"><string>serif</string></test>
    <edit name="family" mode="prepend" binding="strong"><string>Playfair Display</string></edit></match>
  <match target="pattern"><test name="family"><string>sans-serif</string></test>
    <edit name="family" mode="prepend" binding="strong"><string>Poppins</string></edit></match>
</fontconfig>
`;
    const confPath = path.join(os.tmpdir(), "pin-fonts.conf");
    fs.writeFileSync(confPath, conf, "utf8");
    process.env.FONTCONFIG_FILE = confPath;
    process.env.FONTCONFIG_PATH = FONT_DIR;
  } catch (err) {
    logger.warn(`Fontconfig kurulamadi: ${err.message}`);
  }
})();

const sharp = require("sharp");
const { exiftool } = require("exiftool-vendored");

const W = 1000;
const H = 1500; // 2:3

// ── yardimcilar ──
function esc(s) {
  return String(s).replace(/[<>&'"]/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c])
  );
}
function hexToRgb(hex, alpha = 1) {
  const h = String(hex).replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
    alpha,
  };
}
function wrap(text, maxChars, maxLines) {
  const words = String(text).replace(/\s+/g, " ").trim().split(" ");
  const lines = [];
  let cur = "";
  for (const w of words) {
    const nx = cur ? `${cur} ${w}` : w;
    if (nx.length > maxChars && cur) {
      lines.push(cur);
      cur = w;
      if (lines.length === maxLines) break;
    } else cur = nx;
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  return lines.slice(0, maxLines);
}
// "Cream Oushak Rug\n5.2 x 9.1 ft" -> { main, sub }
function titleParts(label) {
  const [main, ...rest] = String(label).split("\n");
  return { main: (main || "").trim(), sub: rest.join(" ").trim() };
}
async function cover(src) {
  return sharp(src)
    .resize(W, H, { fit: "cover", position: "attention" })
    .toBuffer();
}
function svg(inner) {
  return Buffer.from(
    `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`
  );
}
function eyebrow(category) {
  const map = {
    pillow: "AI-DESIGNED · KILIM PILLOW",
    "mini-rug": "AI-DESIGNED · ACCENT RUG",
    rug: "AI-DESIGNED · OUSHAK RUG",
  };
  return map[category] || "AI-DESIGNED PATTERN";
}

const SERIF = "Playfair Display, Georgia, serif";
const SANS = "Poppins, Helvetica, Arial, sans-serif";

// ─────────────────────────────────────────────────────────────
// VARYANT 1 — "editorial": tam kadraj foto + alt karartma + serif baslik
// ─────────────────────────────────────────────────────────────
async function vEditorial(src, { label, category }) {
  const bg = await cover(src);
  const { main, sub } = titleParts(label);
  let size = 64;
  let lines = wrap(main, 17, 2);
  if (lines.join(" ").length > 20) {
    size = 52;
    lines = wrap(main, 21, 2);
  }
  const blockH = lines.length * (size + 8);
  const eyebrowY = H - 236 - blockH;
  let y = eyebrowY + 52;
  const titleTspans = lines
    .map((ln) => {
      const t = `<text x="72" y="${y}" font-family="${SERIF}" font-weight="700" font-size="${size}" fill="#FFFFFF">${esc(
        ln
      )}</text>`;
      y += size + 8;
      return t;
    })
    .join("");

  const overlay = svg(`
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0.30" stop-color="#1E1612" stop-opacity="0"/>
      <stop offset="0.72" stop-color="#1E1612" stop-opacity="0.55"/>
      <stop offset="1" stop-color="#1E1612" stop-opacity="0.92"/>
    </linearGradient></defs>
    <rect x="0" y="0" width="${W}" height="${H}" fill="url(#g)"/>
    <text x="74" y="${eyebrowY}" font-family="${SANS}" font-size="23" letter-spacing="5" fill="#EED9C4">${esc(
    eyebrow(category)
  )}</text>
    ${titleTspans}
    <line x1="74" y1="${y + 6}" x2="150" y2="${y + 6}" stroke="#FFFFFF" stroke-opacity="0.55" stroke-width="2"/>
    <text x="74" y="${y + 46}" font-family="${SANS}" font-size="25" fill="#FFFFFF" fill-opacity="0.95">${esc(
    image.shopHandle
  )}${sub ? "  ·  " + esc(sub) : ""}</text>
    <text x="74" y="${y + 82}" font-family="${SANS}" font-size="22" letter-spacing="3" fill="#EED9C4" fill-opacity="0.9">SHOP ON ETSY →</text>
  `);
  return sharp(bg).composite([{ input: overlay, left: 0, top: 0 }]).jpeg({ quality: 88 }).toBuffer();
}

// ─────────────────────────────────────────────────────────────
// VARYANT 2 — "gallery": krem paspartu + ince cerceve + alt serif baslik
// ─────────────────────────────────────────────────────────────
async function vGallery(src, { label, category }) {
  const cream = hexToRgb(image.brandCream);
  const M = 88;
  const photoW = W - M * 2;
  const photoTop = 88;
  const photoH = 1030;
  const photo = await sharp(src)
    .resize(photoW, photoH, { fit: "cover", position: "attention" })
    .toBuffer();

  const { main, sub } = titleParts(label);
  const tSize = main.length > 22 ? 40 : 48;
  const lines = wrap(main, 26, 2);
  let ty = photoTop + photoH + 118;
  const titleTspans = lines
    .map((ln) => {
      const t = `<text x="${W / 2}" y="${ty}" text-anchor="middle" font-family="${SERIF}" font-weight="700" font-size="${tSize}" fill="#3B2A21">${esc(
        ln
      )}</text>`;
      ty += tSize + 6;
      return t;
    })
    .join("");

  const overlay = svg(`
    <rect x="${M - 16}" y="${photoTop - 16}" width="${photoW + 32}" height="${photoH + 32}" fill="none" stroke="#3B2A21" stroke-opacity="0.32" stroke-width="1.5"/>
    <text x="${W / 2}" y="${photoTop + photoH + 66}" text-anchor="middle" font-family="${SANS}" font-size="21" letter-spacing="6" fill="#8C4A32">${esc(
    eyebrow(category)
  )}</text>
    ${titleTspans}
    <line x1="${W / 2 - 64}" y1="${ty + 4}" x2="${W / 2 + 64}" y2="${ty + 4}" stroke="#3B2A21" stroke-opacity="0.38" stroke-width="1.5"/>
    <text x="${W / 2}" y="${ty + 48}" text-anchor="middle" font-family="${SANS}" font-size="22" letter-spacing="3" fill="#3B2A21" fill-opacity="0.78">${esc(
    image.shopHandle.toUpperCase()
  )}${sub ? "  ·  " + esc(sub) : ""}</text>
  `);

  return sharp({ create: { width: W, height: H, channels: 3, background: cream } })
    .composite([
      { input: photo, left: M, top: photoTop },
      { input: overlay, left: 0, top: 0 },
    ])
    .jpeg({ quality: 88 })
    .toBuffer();
}

// ─────────────────────────────────────────────────────────────
// VARYANT 3 — "split": ust foto + alt sicak kum zemin, sol hizali serif
// ─────────────────────────────────────────────────────────────
async function vSplit(src, { label, category }) {
  const sand = hexToRgb(image.brandSand);
  const topH = 950;
  const photo = await sharp(src)
    .resize(W, topH, { fit: "cover", position: "attention" })
    .toBuffer();
  const { main, sub } = titleParts(label);
  const tSize = main.length > 20 ? 44 : 52;
  const lines = wrap(main, 22, 2);
  const eyebrowY = topH + 118;
  let ty = eyebrowY + 62;
  const titleTop = ty - tSize;
  const titleTspans = lines
    .map((ln) => {
      const t = `<text x="90" y="${ty}" font-family="${SERIF}" font-weight="700" font-size="${tSize}" fill="#3B2A21">${esc(
        ln
      )}</text>`;
      ty += tSize + 10;
      return t;
    })
    .join("");
  const barH = lines.length * (tSize + 10) - 10;

  const overlay = svg(`
    <rect x="0" y="${topH}" width="${W}" height="${H - topH}" fill="rgb(${sand.r},${sand.g},${sand.b})"/>
    <text x="90" y="${eyebrowY}" font-family="${SANS}" font-size="21" letter-spacing="5" fill="#8C4A32">${esc(
    eyebrow(category)
  )}</text>
    <rect x="66" y="${titleTop}" width="5" height="${barH}" fill="#B5654A"/>
    ${titleTspans}
    <text x="90" y="${ty + 24}" font-family="${SANS}" font-size="24" fill="#3B2A21" fill-opacity="0.82">${esc(
    image.shopHandle
  )}${sub ? "  ·  " + esc(sub) : ""}</text>
    <text x="${W - 90}" y="${H - 56}" text-anchor="end" font-family="${SANS}" font-size="23" letter-spacing="2" fill="#8C4A32">SHOP ON ETSY →</text>
  `);
  return sharp({ create: { width: W, height: H, channels: 3, background: sand } })
    .composite([
      { input: photo, left: 0, top: 0 },
      { input: overlay, left: 0, top: 0 },
    ])
    .jpeg({ quality: 88 })
    .toBuffer();
}

// ─────────────────────────────────────────────────────────────
// VARYANT 4 — "postcard": tam kadraj foto + alta yuvarlak kose krem kart
// ─────────────────────────────────────────────────────────────
async function vPostcard(src, { label, category }) {
  const bg = await cover(src);
  const { main, sub } = titleParts(label);
  const cardW = 884;
  const cardH = 384;
  const cardX = (W - cardW) / 2;
  const cardY = H - cardH - 72;
  const tSize = main.length > 24 ? 38 : 44;
  const lines = wrap(main, 28, 2);
  let ty = cardY + 130;
  const titleTspans = lines
    .map((ln) => {
      const t = `<text x="${W / 2}" y="${ty}" text-anchor="middle" font-family="${SERIF}" font-weight="700" font-size="${tSize}" fill="#3B2A21">${esc(
        ln
      )}</text>`;
      ty += tSize + 6;
      return t;
    })
    .join("");

  const overlay = svg(`
    <rect x="0" y="0" width="${W}" height="${H}" fill="#1E1612" fill-opacity="0.12"/>
    <rect x="${cardX + 8}" y="${cardY + 12}" width="${cardW}" height="${cardH}" rx="20" fill="#1E1612" fill-opacity="0.25"/>
    <rect x="${cardX}" y="${cardY}" width="${cardW}" height="${cardH}" rx="20" fill="${image.brandCream}"/>
    <text x="${W / 2}" y="${cardY + 74}" text-anchor="middle" font-family="${SANS}" font-size="22" letter-spacing="5" fill="#8C4A32">${esc(
    eyebrow(category)
  )}</text>
    ${titleTspans}
    <line x1="${W / 2 - 60}" y1="${ty + 6}" x2="${W / 2 + 60}" y2="${ty + 6}" stroke="#3B2A21" stroke-opacity="0.4" stroke-width="2"/>
    <text x="${W / 2}" y="${ty + 52}" text-anchor="middle" font-family="${SANS}" font-size="23" letter-spacing="2" fill="#3B2A21" fill-opacity="0.85">${esc(
    image.shopHandle
  )}${sub ? "  ·  " + esc(sub) : ""}  ·  SHOP ON ETSY →</text>
  `);
  return sharp(bg).composite([{ input: overlay, left: 0, top: 0 }]).jpeg({ quality: 88 }).toBuffer();
}

// ─────────────────────────────────────────────────────────────
// VARYANT 5 — "banner": ust marka seridi + tam kadraj foto + alt yari saydam kum bar
// ─────────────────────────────────────────────────────────────
async function vBanner(src, { label, category }) {
  const bg = await cover(src);
  const { main, sub } = titleParts(label);
  const stripH = 120;
  const barH = 216;
  const tSize = main.length > 24 ? 40 : 46;
  const lines = wrap(main, 28, 2);
  let ty = H - barH + (barH - lines.length * (tSize + 4)) / 2 + tSize;
  const titleTspans = lines
    .map((ln) => {
      const t = `<text x="${W / 2}" y="${ty}" text-anchor="middle" font-family="${SERIF}" font-weight="700" font-size="${tSize}" fill="#3B2A21">${esc(
        ln
      )}</text>`;
      ty += tSize + 4;
      return t;
    })
    .join("");

  const overlay = svg(`
    <rect x="0" y="0" width="${W}" height="${stripH}" fill="#8C4A32"/>
    <text x="${W / 2}" y="${stripH / 2 + 4}" text-anchor="middle" font-family="${SANS}" font-size="30" letter-spacing="6" fill="#F7F1E8">ANATOLIAN KILIM HOME</text>
    <text x="${W / 2}" y="${stripH / 2 + 40}" text-anchor="middle" font-family="${SANS}" font-size="19" letter-spacing="4" fill="#F7F1E8" fill-opacity="0.8">${esc(
    eyebrow(category)
  )}</text>
    <rect x="0" y="${H - barH}" width="${W}" height="${barH}" fill="${image.brandCream}" fill-opacity="0.94"/>
    ${titleTspans}
    <text x="${W / 2}" y="${H - 44}" text-anchor="middle" font-family="${SANS}" font-size="23" letter-spacing="2" fill="#8C4A32">${
    sub ? esc(sub) + "  ·  " : ""
  }SHOP ON ETSY →</text>
  `);
  return sharp(bg).composite([{ input: overlay, left: 0, top: 0 }]).jpeg({ quality: 88 }).toBuffer();
}

// eski: bulanik arka plan
async function vBlur(src) {
  const background = await sharp(src).resize(W, H, { fit: "cover" }).modulate({ brightness: 0.85 }).blur(48).toBuffer();
  const foreground = await sharp(src).resize(W, H, { fit: "inside", withoutEnlargement: true }).toBuffer();
  return sharp(background).composite([{ input: foreground, gravity: "center" }]).jpeg({ quality: 90 }).toBuffer();
}

const VARIANTS = {
  editorial: vEditorial,
  gallery: vGallery,
  split: vSplit,
  postcard: vPostcard,
  banner: vBanner,
  blur: vBlur,
};

async function renderVariant(name, srcBuf, opts) {
  const fn = VARIANTS[name] || VARIANTS.editorial;
  return fn(srcBuf, opts);
}

// ── AI metadata ──
async function writeAiMetadata(buf, { title } = {}) {
  const tmp = path.join(os.tmpdir(), `pin-${crypto.randomBytes(6).toString("hex")}.jpg`);
  try {
    fs.writeFileSync(tmp, buf);
    await exiftool.write(
      tmp,
      {
        "XMP-iptcExt:DigitalSourceType":
          "https://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia",
        "XMP-dc:Description": title
          ? `${title} — pattern created using generative AI tools.`
          : "Pattern created using generative AI tools.",
        "IPTC:Credit": "AI-assisted design",
        "XMP-xmp:CreatorTool": "Anatolian Kilim Home / generative AI",
      },
      ["-overwrite_original", "-m"]
    );
    return fs.readFileSync(tmp);
  } catch (err) {
    logger.warn(`AI metadata yazilamadi: ${err.message}`);
    return buf;
  } finally {
    fs.existsSync(tmp) && fs.unlinkSync(tmp);
  }
}

async function downloadImage(url) {
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0", Accept: "image/*,*/*" } });
  if (!res.ok) throw new Error(`Gorsel indirilemedi (${res.status}): ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

async function toPinterestPin(sourceUrl, { label = "", metaTitle = "", category = "" } = {}) {
  const src = await downloadImage(sourceUrl);
  const out = await renderVariant(image.variant, src, { label, category });
  return writeAiMetadata(out, { title: metaTitle || String(label).replace(/\n/g, " ") });
}

async function shutdown() {
  try {
    await exiftool.end();
  } catch {
    /* yoksay */
  }
}

module.exports = {
  toPinterestPin,
  renderVariant,
  downloadImage,
  writeAiMetadata,
  shutdown,
  VARIANT_NAMES: Object.keys(VARIANTS),
};
