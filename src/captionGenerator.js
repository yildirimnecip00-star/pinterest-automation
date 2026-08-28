const { anthropic } = require("./config");
const logger = require("./logger");

let client = null;
if (anthropic.apiKey) {
  const Anthropic = require("@anthropic-ai/sdk");
  client = new Anthropic({ apiKey: anthropic.apiKey });
}

const CATEGORY_HINT = {
  pillow:
    "a Turkish-kilim-patterned throw pillow / cushion cover for sofas, beds and reading nooks",
  "mini-rug":
    "a small accent rug / mat for kitchens, bathrooms, entryways and bedsides",
  rug: "a vintage-style Oushak / Turkish area rug for living rooms and dining rooms",
};

const CATEGORY_TAGS = {
  pillow: ["#throwpillow", "#kilimpillow", "#aidesign"],
  "mini-rug": ["#accentrug", "#kitchenrug", "#aidesign"],
  rug: ["#arearug", "#oushakrug", "#aidesign"],
};

function firstColorWord(title) {
  const colors = [
    "cream", "beige", "ivory", "rust", "sage", "green", "blue", "taupe",
    "charcoal", "grey", "gray", "brown", "terracotta", "gold", "pink",
  ];
  const t = (title || "").toLowerCase();
  return colors.find((c) => t.includes(c)) || "";
}

function clampTitle(s) {
  s = String(s).replace(/\s+/g, " ").trim();
  return s.length <= 100 ? s : s.slice(0, 97).trimEnd() + "…";
}
function clampDesc(s) {
  s = String(s).replace(/\s+/g, " ").trim();
  return s.length <= 480 ? s : s.slice(0, 477).trimEnd() + "…";
}

const CATEGORY_NOUN = {
  pillow: "Turkish kilim throw pillow covers",
  "mini-rug": "small Turkish-style accent rug",
  rug: "vintage-style Oushak area rug",
};

// ── Sablon modu (ANTHROPIC_API_KEY yoksa) ──
function buildTemplateCaption(listing) {
  const color = listing.color || firstColorWord(listing.title);
  const cap = color ? color[0].toUpperCase() + color.slice(1) : "";
  const noun = CATEGORY_NOUN[listing.category] || "handmade-style home textile";
  const tags = (CATEGORY_TAGS[listing.category] || ["#homedecor", "#aidesign"]).join(" ");
  const sizePart = listing.size ? ` (${listing.size})` : "";

  const title = clampTitle(
    `${cap} ${noun}${sizePart} — AI-designed pattern | Anatolian Kilim Home`
  );
  const description = clampDesc(
    `${cap ? cap + "-toned " : ""}${noun}${sizePart}. ` +
      `The pattern is AI-designed, then produced as a real, usable piece — so you get a one-of-a-kind look without the vintage price tag. ` +
      `It sits happily in modern, boho and traditional rooms alike. ` +
      `Tap through for full sizing, more photos and the price on Etsy. ${tags}`
  );
  const altText = `${cap ? cap + " " : ""}${noun}${sizePart} with an AI-designed Turkish kilim style pattern, styled in a bright room.`.slice(0, 250);
  return { title, description, altText };
}

function stripJsonFences(text) {
  return text.replace(/^```(json)?/i, "").replace(/```$/, "").trim();
}

async function generateWithClaude(listing, recentTitleOpeners) {
  const system = `You write Pinterest pin copy for the Etsy shop "Anatolian Kilim Home".
The shop sells handmade-style Turkish / Oushak kilim home goods (throw pillows, small accent rugs, and area rugs). The decorative PATTERNS are designed with generative AI, then produced as real physical products.
Write in English only. Output MUST be a single valid JSON object and nothing else.`;

  const user = `Product:
- Category: ${listing.category} (${CATEGORY_HINT[listing.category] || ""})
- Title: ${listing.title}
- Price: ${listing.price || "n/a"}
- Shop description (truncated): ${(listing.description || "").slice(0, 600)}
- Product image: ${listing.imageUrl}

Title openers already used (do NOT start with these, avoid sounding repetitive):
${recentTitleOpeners && recentTitleOpeners.length ? recentTitleOpeners.map((o) => `- ${o}`).join("\n") : "(none yet)"}

Return ONLY a JSON object with these fields:
{
  "title": "Pinterest pin title, <= 100 chars, specific to THIS product, natural, no keyword stuffing",
  "description": "2-4 sentence description specific to this product, <= 470 chars. Naturally state within a sentence that the pattern/design is AI-designed (e.g. 'AI-designed pattern') - embedded in prose, not an ad. Include a light call-to-action to view it on Etsy. End with 2-3 relevant hashtags including #aidesign.",
  "alt_text": "one sentence, <= 240 chars, plain description of the image for accessibility"
}`;

  const response = await client.messages.create({
    model: anthropic.model,
    max_tokens: 1024,
    output_config: { effort: "low" },
    system,
    messages: [{ role: "user", content: user }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock) throw new Error("Claude metin blogu dondurmedi");
  const parsed = JSON.parse(stripJsonFences(textBlock.text));
  if (!parsed.title || !parsed.description) {
    throw new Error(`Claude yanitinda title/description eksik: ${textBlock.text.slice(0, 200)}`);
  }
  return {
    title: clampTitle(parsed.title),
    description: clampDesc(parsed.description),
    altText: clampDesc(parsed.alt_text || parsed.title).slice(0, 250),
  };
}

async function generateCaption(listing, recentTitleOpeners = []) {
  if (!client) {
    logger.info("ANTHROPIC_API_KEY yok -> sablon modu");
    return buildTemplateCaption(listing);
  }
  try {
    return await generateWithClaude(listing, recentTitleOpeners);
  } catch (err) {
    logger.warn(`Claude caption uretemedi, sablona dusuluyor: ${err.message}`);
    return buildTemplateCaption(listing);
  }
}

module.exports = { generateCaption, buildTemplateCaption };
