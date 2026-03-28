importScripts('https://www.gstatic.com/firebasejs/12.10.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.10.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyDlJI90SX46io5Tj-FOEkd35tT0JzsBK-8",
  authDomain: "mayatrack-c740f.firebaseapp.com",
  projectId: "mayatrack-c740f",
  storageBucket: "mayatrack-c740f.firebasestorage.app",
  messagingSenderId: "884250869220",
  appId: "1:884250869220:web:7a4d94a9c28c3d6c175bf1",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification || {};
  if (!title) return;

  self.registration.showNotification(title, {
    body: body || '',
    icon: 'pwa-192x192.png',
    badge: 'pwa-192x192.png',
    tag: 'medication-reminder',
    renotify: true,
    vibrate: [200, 100, 200],
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('/mayaTrack') && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow('/mayaTrack/');
      }
    })
  );
});
