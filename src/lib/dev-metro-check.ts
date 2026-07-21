import { Platform } from 'react-native';

/** In dev, log a clear message if the emulator cannot reach Metro. */
export function checkDevMetroReachable(): void {
  if (!__DEV__ || Platform.OS !== 'android') return;

  const hosts = ['http://10.0.2.2:8081/status', 'http://127.0.0.1:8081/status'];

  void (async () => {
    for (const url of hosts) {
      try {
        const res = await fetch(url, { method: 'GET' });
        if (res.ok) return;
      } catch {
        /* try next */
      }
    }
    console.error(
      '[Local Marketplace] Cannot reach Metro on port 8081.\n' +
        '1. In a terminal: npm run start\n' +
        '2. Then: npm run android:open  (runs adb reverse + launches the app)\n' +
        'Do not open the app from the icon until Metro is running.'
    );
  })();
}
