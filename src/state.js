const fs = require("fs");
const path = require("path");
const { paths } = require("./config");

const dataDir = path.join(paths.root, "data");
fs.mkdirSync(dataDir, { recursive: true });
const stateFile = path.join(dataDir, "state.json");

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function load() {
  if (!fs.existsSync(stateFile)) {
    return { pinnedListingIds: [], history: [], lastRunDate: null, pinsToday: 0, recentTitleOpeners: [] };
  }
  const data = JSON.parse(fs.readFileSync(stateFile, "utf8"));
  if (data.lastRunDate !== todayStr()) {
    data.pinsToday = 0;
    data.lastRunDate = todayStr();
  }
  data.recentTitleOpeners = data.recentTitleOpeners || [];
  return data;
}

function save(state) {
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2), "utf8");
}

function hasBeenPinned(state, listingId) {
  return state.pinnedListingIds.includes(listingId);
}

function recordPin(state, listingId, pinId, titleOpener) {
  state.pinnedListingIds.push(listingId);
  state.history.push({ listingId, pinId, pinnedAt: new Date().toISOString() });
  state.pinsToday += 1;
  if (titleOpener) {
    state.recentTitleOpeners.push(titleOpener);
    state.recentTitleOpeners = state.recentTitleOpeners.slice(-15);
  }
}

function remainingToday(state, maxPerDay) {
  return Math.max(0, maxPerDay - state.pinsToday);
}

module.exports = { load, save, hasBeenPinned, recordPin, remainingToday };
