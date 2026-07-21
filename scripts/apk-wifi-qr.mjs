// Serve the freshly built debug APK over the LAN and print a QR code so a
// physical phone can download + sideload it over Wi-Fi (no USB/adb needed).
//
//   node scripts/apk-wifi-qr.mjs [port]
//
// Then start a static server on the same port (see console output).
import os from 'node:os';
import fs from 'node:fs';
import QRCode from 'qrcode';

const PORT = process.argv[2] || '8088';
const APK_SRC = 'android/app/build/outputs/apk/debug/app-debug.apk';
const SERVE_DIR = '.apk-serve';
const SERVE_NAME = 'localmarketplace.apk';
const QR_PNG = 'apk-download-qr.png';

if (!fs.existsSync(APK_SRC)) {
  console.error(`APK not found at ${APK_SRC} — build it first (npm run android:build:device).`);
  process.exit(1);
}

// Pick the most likely LAN IPv4 (prefer 192.168.* / 10.* over virtual adapters).
function pickLanIp() {
  const ifaces = os.networkInterfaces();
  const candidates = [];
  for (const name of Object.keys(ifaces)) {
    for (const i of ifaces[name] ?? []) {
      if (i.family === 'IPv4' && !i.internal) candidates.push({ name, addr: i.address });
    }
  }
  const score = (a) =>
    a.startsWith('192.168.') ? 3 : a.startsWith('10.') ? 2 : a.startsWith('172.') ? 1 : 0;
  candidates.sort((a, b) => score(b.addr) - score(a.addr));
  return candidates[0]?.addr ?? null;
}

const ip = pickLanIp();
if (!ip) {
  console.error('No LAN IPv4 address found. Are you connected to Wi-Fi?');
  process.exit(1);
}

fs.mkdirSync(SERVE_DIR, { recursive: true });
fs.copyFileSync(APK_SRC, `${SERVE_DIR}/${SERVE_NAME}`);

const url = `http://${ip}:${PORT}/${SERVE_NAME}`;
await QRCode.toFile(QR_PNG, url, { width: 360, margin: 2 });
const sizeMb = (fs.statSync(APK_SRC).size / 1024 / 1024).toFixed(1);

console.log('');
console.log('=== Local Marketplace APK over Wi-Fi ===');
console.log(`APK      : ${sizeMb} MB (arm64-v8a)`);
console.log(`Download : ${url}`);
console.log(`QR image : ${QR_PNG}`);
console.log('');
console.log('Now start the server (separate terminal, keep it open):');
console.log(`  python -m http.server ${PORT} --directory ${SERVE_DIR}`);
console.log('');
console.log('On your phone (same Wi-Fi): scan the QR, download, tap to install.');
console.log('(Allow "install unknown apps" for your browser if prompted.)');
