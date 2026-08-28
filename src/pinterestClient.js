const fs = require("fs");
const path = require("path");
const { pinterest, paths } = require("./config");
const logger = require("./logger");

const tokensFile = path.join(paths.root, "data", "pinterest-tokens.json");
const API = "https://api.pinterest.com/v5";

function basicAuthHeader() {
  return (
    "Basic " +
    Buffer.from(`${pinterest.clientId}:${pinterest.clientSecret}`).toString("base64")
  );
}

// CI: PINTEREST_REFRESH_TOKEN secret'i. Yerel: data/pinterest-tokens.json.
function loadRefreshToken() {
  if (pinterest.refreshToken) return pinterest.refreshToken;
  if (fs.existsSync(tokensFile)) {
    const t = JSON.parse(fs.readFileSync(tokensFile, "utf8"));
    if (t.refresh_token) return t.refresh_token;
  }
  throw new Error(
    "Pinterest refresh token yok. CI'da PINTEREST_REFRESH_TOKEN secret'ini ekle " +
      "ya da yerelde 'npm run auth' calistir."
  );
}

function saveTokensLocal(tokens) {
  fs.mkdirSync(path.dirname(tokensFile), { recursive: true });
  fs.writeFileSync(tokensFile, JSON.stringify(tokens, null, 2), "utf8");
}

async function pinterestFetch(url, opts = {}, { retries = 2 } = {}) {
  let lastBody = "";
  for (let i = 0; i <= retries; i++) {
    const res = await fetch(url, opts);
    if (res.ok) return res.json();
    lastBody = await res.text().catch(() => "");
    // Sadece 429 ve 5xx tekrar denenir; diger 4xx'lerde hemen hata ver.
    if (res.status !== 429 && res.status < 500) {
      throw new Error(`Pinterest ${res.status} ${url}: ${lastBody}`);
    }
    logger.warn(`Pinterest ${res.status} (deneme ${i + 1}/${retries + 1}): ${lastBody.slice(0, 200)}`);
    if (i < retries) await new Promise((r) => setTimeout(r, 4000 * (i + 1)));
  }
  throw new Error(`Pinterest istegi basarisiz: ${lastBody}`);
}

async function getAccessToken() {
  const refresh_token = loadRefreshToken();
  const data = await pinterestFetch(`${API}/oauth/token`, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token }),
  });
  // Pinterest rotasyon aciksa yeni refresh_token doner -> yerelde sakla, CI'da uyar.
  if (data.refresh_token && data.refresh_token !== refresh_token) {
    if (pinterest.refreshToken) {
      logger.warn(
        "Pinterest YENI bir refresh_token dondu (rotasyon acik). " +
          "PINTEREST_REFRESH_TOKEN secret'ini guncelle:\n" +
          data.refresh_token
      );
    } else {
      saveTokensLocal({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: Date.now() + data.expires_in * 1000,
      });
    }
  }
  return data.access_token;
}

async function resolveBoardId(accessToken) {
  if (pinterest.boardId) return pinterest.boardId;
  const headers = { Authorization: `Bearer ${accessToken}` };

  const list = await pinterestFetch(`${API}/boards?page_size=100`, { headers });
  const want = pinterest.boardName.trim().toLowerCase();
  const found = (list.items || []).find(
    (b) => (b.name || "").trim().toLowerCase() === want
  );
  if (found) {
    logger.info(`Pinterest panosu bulundu: "${found.name}" (${found.id})`);
    return found.id;
  }

  logger.info(`Pinterest panosu "${pinterest.boardName}" yok, olusturuluyor...`);
  const created = await pinterestFetch(`${API}/boards`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      name: pinterest.boardName,
      description: "Handmade-style Turkish kilim pillows & rugs. Patterns AI-designed.",
    }),
  });
  logger.info(`Pano olusturuldu: ${created.id}`);
  return created.id;
}

async function createSession() {
  require("./config").assertPinterest();
  const accessToken = await getAccessToken();
  const boardId = await resolveBoardId(accessToken);
  return { accessToken, boardId };
}

async function createPin(session, { title, description, altText, link, imageBuffer }) {
  const data = await pinterestFetch(`${API}/pins`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      board_id: session.boardId,
      title: title.slice(0, 100),
      description: (description || "").slice(0, 500),
      alt_text: (altText || "").slice(0, 500),
      link,
      media_source: {
        source_type: "image_base64",
        content_type: "image/jpeg",
        data: imageBuffer.toString("base64"),
      },
    }),
  });
  return data;
}

module.exports = { createSession, createPin, resolveBoardId, getAccessToken, tokensFile };
