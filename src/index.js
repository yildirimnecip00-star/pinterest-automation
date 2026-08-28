const fs = require("fs");
const path = require("path");
const config = require("./config");
const logger = require("./logger");
const state = require("./state");
const etsy = require("./etsyClient");
const imageProcessor = require("./imageProcessor");
const captionGenerator = require("./captionGenerator");
const pinterest = require("./pinterestClient");

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const countArg = args.find((a) => a.startsWith("--count="));
const explicitCount = countArg ? parseInt(countArg.split("=")[1], 10) : null;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function randomLocalDelayMs() {
  const { minDelayMinutes, maxDelayMinutes } = config.schedule;
  return (minDelayMinutes + Math.random() * (maxDelayMinutes - minDelayMinutes)) * 60_000;
}

function lastPinnedAt(st, listingId) {
  const rows = (st.history || []).filter((h) => h.listingId === listingId);
  if (!rows.length) return null;
  return new Date(rows[rows.length - 1].pinnedAt).getTime();
}

function isEligible(st, listing) {
  const id = String(listing.listingId);
  if (!state.hasBeenPinned(st, id)) return true;
  const { repinAfterDays } = config.schedule;
  if (repinAfterDays > 0) {
    const last = lastPinnedAt(st, id);
    if (last && Date.now() - last > repinAfterDays * 86_400_000) return true;
  }
  return false;
}

const summaryLines = [];
function summary(line) {
  summaryLines.push(line);
}
function flushSummary() {
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summaryLines.join("\n") + "\n");
  }
}

async function main() {
  logger.info(`===== Calisma basladi ${dryRun ? "(DRY RUN)" : ""} =====`);
  summary(`### Pinterest otomasyonu — ${new Date().toISOString()}`);

  const st = state.load();
  const remainingToday = state.remainingToday(st, config.schedule.maxPinsPerDay);
  if (!dryRun && remainingToday <= 0) {
    logger.info(`Gunluk limit (${config.schedule.maxPinsPerDay}) dolu, cikiliyor.`);
    summary(`Gunluk limit dolu (${config.schedule.maxPinsPerDay}). Pin atilmadi.`);
    return;
  }

  const listings = await etsy.fetchListings();
  const eligible = listings.filter((l) => isEligible(st, l));

  const runCap = Math.min(
    config.schedule.perRunLimit,
    dryRun ? 3 : remainingToday
  );
  const limit = explicitCount ?? runCap;
  const toProcess = eligible.slice(0, limit);

  summary(
    `- Toplam uygun ilan: **${listings.length}**, yeni/pinlenebilir: **${eligible.length}**, ` +
      `bu calismada islenecek: **${toProcess.length}** (gunluk kalan: ${remainingToday})`
  );

  if (toProcess.length === 0) {
    logger.info("Pinlenecek yeni ilan yok.");
    summary("Pinlenecek yeni ilan yok.");
    return;
  }

  if (dryRun) {
    fs.mkdirSync(path.join(config.paths.root, "preview"), { recursive: true });
  }

  let ok = 0;
  let fail = 0;
  let session = null;

  for (let i = 0; i < toProcess.length; i++) {
    const listing = toProcess[i];
    const id = String(listing.listingId);
    try {
      logger.info(`[${id}] (${listing.category}) "${listing.title.slice(0, 70)}"`);
      const caption = await captionGenerator.generateCaption(listing, st.recentTitleOpeners);
      const imageBuffer = await imageProcessor.toPinterestPin(listing.imageUrl, {
        label: listing.label || caption.title,
        metaTitle: caption.title,
        category: listing.category,
      });
      const opener = caption.title.split(/\s+/).slice(0, 2).join(" ");

      if (dryRun) {
        const base = path.join(config.paths.root, "preview", id);
        fs.writeFileSync(`${base}.jpg`, imageBuffer);
        fs.writeFileSync(
          `${base}.json`,
          JSON.stringify({ ...caption, link: listing.url, category: listing.category }, null, 2)
        );
        logger.info(`[${id}] Onizleme: preview/${id}.jpg / .json`);
        ok++;
      } else {
        if (!session) session = await pinterest.createSession();
        const pin = await pinterest.createPin(session, {
          title: caption.title,
          description: caption.description,
          altText: caption.altText,
          link: listing.url,
          imageBuffer,
        });
        state.recordPin(st, id, pin.id, opener);
        state.save(st);
        logger.info(`[${id}] Pin olusturuldu: ${pin.id}`);
        summary(`- ✅ ${listing.category} — [${caption.title}](${listing.url}) → pin \`${pin.id}\``);
        ok++;
      }
    } catch (err) {
      fail++;
      logger.error(`[${id}] HATA: ${err.message}`);
      summary(`- ❌ ${id} — ${err.message}`);
    }

    if (i < toProcess.length - 1) {
      const ms = config.isCI
        ? config.schedule.pinDelaySeconds * 1000
        : dryRun
        ? 0
        : randomLocalDelayMs();
      if (ms > 0) {
        logger.info(`Sonraki pin icin ${(ms / 1000).toFixed(0)} sn bekleniyor...`);
        await sleep(ms);
      }
    }
  }

  summary(`\n**Sonuc:** ${ok} basarili, ${fail} hatali.`);
  logger.info(`===== Bitti: ${ok} basarili, ${fail} hatali =====`);
}

main()
  .catch((err) => {
    logger.error(`Beklenmeyen hata: ${err.stack || err.message}`);
    summary(`\n**KRITIK HATA:** ${err.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await imageProcessor.shutdown();
    flushSummary();
  });
