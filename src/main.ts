import { App } from './app/app';

const canvas = document.getElementById('game') as HTMLCanvasElement;
new App(canvas);

// Installable + offline (only for the built site served over http/https; not in dev or the desktop app)
if (import.meta.env.PROD && 'serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
// remember the browser's install prompt so the title screen can offer an "Install" button
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  (window as any).__installPrompt = e;
});
