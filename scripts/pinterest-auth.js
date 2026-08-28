// Pinterest OAuth — tek seferlik yetkilendirme.
//
// Yerel (interaktif):   npm run auth
//   1) Ekrandaki linki ac, izin ver, yonlendirilen URL'yi yapistir.
//   2) refresh_token data/pinterest-tokens.json'a yazilir + panolar listelenir.
//
// GitHub Actions (auth.yml):
//   - PINTEREST_AUTH_CODE bos  -> yetkilendirme URL'sini yazar
//   - PINTEREST_AUTH_CODE dolu -> token takas eder, refresh_token + panolari loglar
//
// Gerekli env: PINTEREST_CLIENT_ID, PINTEREST_CLIENT_SECRET, (ops.) PINTEREST_REDIRECT_URI
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const fs = require("fs");

const CLIENT_ID = process.env.PINTEREST_CLIENT_ID;
const CLIENT_SECRET = process.env.PINTEREST_CLIENT_SECRET;
const REDIRECT_URI = process.env.PINTEREST_REDIRECT_URI || "https://localhost/callback";
const SCOPES = "boards:read,boards:write,pins:read,pins:write,user_accounts:read";

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("PINTEREST_CLIENT_ID ve PINTEREST_CLIENT_SECRET gerekli.");
  process.exit(1);
}

const authorizeUrl =
  `https://www.pinterest.com/oauth/?client_id=${encodeURIComponent(CLIENT_ID)}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
  `&response_type=code&scope=${encodeURIComponent(SCOPES)}&state=setup`;

const basicAuth =
  "Basic " + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");

async function exchange(code) {
  const res = await fetch("https://api.pinterest.com/v5/oauth/token", {
    method: "POST",
    headers: { Authorization: basicAuth, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    console.error("Token alma hatasi:", JSON.stringify(data));
    process.exit(1);
  }
  return data;
}

async function listBoards(accessToken) {
  const res = await fetch("https://api.pinterest.com/v5/boards?page_size=100", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  if (res.ok && data.items) {
    console.log("\nPanolar (PINTEREST_BOARD_ID icin birini sec):");
    if (!data.items.length) console.log("  (hic pano yok — biri gerekliyse Pinterest'te olustur)");
    for (const b of data.items) console.log(`  ${b.id}  ->  ${b.name}`);
  } else {
    console.log("Pano listesi alinamadi:", JSON.stringify(data));
  }
}

function printResult(data) {
  console.log("\n================ SONUC ================");
  console.log("PINTEREST_REFRESH_TOKEN (bunu repo Secret'ina ekle):\n");
  console.log(data.refresh_token);
  console.log("\n(access_token ~30 gun, refresh_token ~1 yil gecerli.)");
  console.log("======================================");
}

async function ciFlow() {
  const code = (process.env.PINTEREST_AUTH_CODE || "").trim();
  if (!code) {
    console.log("1) Su URL'yi tarayicida ac, Pinterest hesabinla izin ver:\n");
    console.log(authorizeUrl);
    console.log(
      `\n2) Yonlendirilen "${REDIRECT_URI}?code=..." adresindeki code degerini kopyala.`
    );
    console.log("3) Bu workflow'u tekrar calistir, 'code' alanina yapistir.");
    return;
  }
  const data = await exchange(code);
  printResult(data);
  await listBoards(data.access_token);
}

async function localFlow() {
  const readline = require("readline");
  console.log("\n1) Su adresi tarayicida ac ve izin ver:\n");
  console.log(authorizeUrl);
  console.log(
    `\n2) "${REDIRECT_URI}" adresine yonlendirileceksin (sayfa acilmasa da olur).`
  );
  console.log("3) Adres cubugundaki TAM URL'yi kopyalayip yapistir.\n");
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const pasted = await new Promise((r) => rl.question("Yonlendirilen URL: ", r));
  rl.close();
  let code;
  try {
    code = new URL(pasted.trim()).searchParams.get("code");
  } catch {
    console.error("Gecerli URL degil.");
    process.exit(1);
  }
  if (!code) {
    console.error("URL'de 'code' yok (izni reddetmis olabilirsin).");
    process.exit(1);
  }
  const data = await exchange(code);
  const tokens = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
  };
  const dataDir = path.join(__dirname, "..", "data");
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, "pinterest-tokens.json"), JSON.stringify(tokens, null, 2));
  console.log("\nKaydedildi: data/pinterest-tokens.json");
  printResult(data);
  await listBoards(data.access_token);
}

(process.env.CI ? ciFlow() : localFlow()).catch((e) => {
  console.error(e);
  process.exit(1);
});
