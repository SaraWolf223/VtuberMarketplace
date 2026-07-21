import { Alert, Platform } from 'react-native';
import type { AlertButton, AlertOptions } from 'react-native';

export type WebAlertRequest = {
  id: number;
  title: string;
  message?: string;
  buttons?: AlertButton[];
  options?: AlertOptions;
};

type WebAlertListener = (request: WebAlertRequest) => void;

let nextWebAlertId = 1;
const listeners = new Set<WebAlertListener>();
const queuedAlerts: WebAlertRequest[] = [];

function webAlert(
  title: string,
  message?: string,
  buttons?: AlertButton[],
  options?: AlertOptions
): void {
  const request: WebAlertRequest = {
    id: nextWebAlertId,
    title,
    message,
    buttons,
    options,
  };
  nextWebAlertId += 1;

  if (listeners.size === 0) {
    queuedAlerts.push(request);
    return;
  }

  listeners.forEach((listener) => listener(request));
}

/**
 * Cross-platform replacement for `Alert.alert`. On web, react-native-web ships
 * `Alert.alert` as a no-op, so we route it through the app's web alert host.
 */
export function showAlert(
  title: string,
  message?: string,
  buttons?: AlertButton[],
  options?: AlertOptions
): void {
  if (Platform.OS !== 'web') {
    Alert.alert(title, message, buttons, options);
    return;
  }
  webAlert(title, message, buttons, options);
}

let installed = false;

/**
 * Patches react-native-web's no-op `Alert.alert` so existing call sites surface
 * in the app-owned web alert host. Native is left untouched.
 */
export function installWebAlertShim(): void {
  if (installed || Platform.OS !== 'web') return;
  installed = true;
  (Alert as unknown as { alert: typeof webAlert }).alert = (title, message, buttons, options) =>
    webAlert(title, message, buttons, options);
}

export function subscribeWebAlerts(listener: WebAlertListener): () => void {
  listeners.add(listener);

  while (queuedAlerts.length > 0) {
    const request = queuedAlerts.shift();
    if (request) listener(request);
  }

  return () => {
    listeners.delete(listener);
  };
}
