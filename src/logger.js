const fs = require("fs");
const path = require("path");
const { paths } = require("./config");

const logsDir = path.join(paths.root, "logs");
fs.mkdirSync(logsDir, { recursive: true });

function fileFor(date = new Date()) {
  const d = date.toISOString().slice(0, 10);
  return path.join(logsDir, `${d}.log`);
}

function write(level, msg) {
  const line = `[${new Date().toISOString()}] [${level}] ${msg}`;
  console.log(line);
  fs.appendFileSync(fileFor(), line + "\n", "utf8");
}

module.exports = {
  info: (msg) => write("INFO", msg),
  warn: (msg) => write("WARN", msg),
  error: (msg) => write("ERROR", msg),
};
