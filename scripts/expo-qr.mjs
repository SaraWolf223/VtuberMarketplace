import { networkInterfaces } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';

const port = Number(process.argv[2] || 8081);
const ipOverride = process.argv[3];

function lanIp() {
  const entries = Object.entries(networkInterfaces());
  // Prefer a Wi-Fi/WLAN adapter for physical-device QR (phones are usually on Wi-Fi).
  const wifiFirst = entries.sort(([a], [b]) => {
    const score = (n) => (/wi-?fi|wlan|wireless/i.test(n) ? 0 : 1);
    return score(a) - score(b);
  });
  for (const [, infos] of wifiFirst) {
    for (const info of infos ?? []) {
      const v4 = info.family === 'IPv4' || info.family === 4;
      if (v4 && !info.internal) return info.address;
    }
  }
  return '127.0.0.1';
}

const host = ipOverride || lanIp();
const url = `exp://${host}:${port}`;
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'expo-qr.png');

await QRCode.toFile(out, url, { width: 320, margin: 2 });

console.log('Expo Go URL:', url);
console.log('QR image:', out);
