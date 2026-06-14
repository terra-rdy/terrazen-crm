importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyCL22g_Oa85dCsSY9P1Ie1vlHQtoSRHnxk",
  authDomain: "terrazen-1e8be.firebaseapp.com",
  projectId: "terrazen-1e8be",
  storageBucket: "terrazen-1e8be.firebasestorage.app",
  messagingSenderId: "100982611909",
  appId: "1:100982611909:web:46d254e8576ce23bcaf5ac",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('Background message received:', payload);
  const title = payload.notification?.title ?? 'Notifikasi Baru';
  const body  = payload.notification?.body  ?? '';
  self.registration.showNotification(title, {
    body,
    icon: '/icon-192.png',
  });
});

// Handler untuk test dari DevTools
self.addEventListener('push', (event) => {
  console.log('Push event received:', event);
  const title = 'Test Notifikasi';
  const body  = event.data?.text() ?? 'Push test berhasil!';
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icon-192.png',
    })
  );
});