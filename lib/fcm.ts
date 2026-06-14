import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export const requestNotificationPermission = async (userId: string) => {
  if (typeof window === 'undefined') return null;
  if (!('Notification' in window)) return null;
  if (!('serviceWorker' in navigator)) return null;

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('Notifikasi ditolak');
      return null;
    }

    // Register service worker dulu
    let swRegistration: ServiceWorkerRegistration;
    try {
      swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
        scope: '/',
      });
      // Tunggu service worker aktif
      await navigator.serviceWorker.ready;
    } catch (swErr) {
      console.error('Service worker gagal register:', swErr);
      return null;
    }

    const { getMessaging, getToken } = await import('firebase/messaging');
    const { app } = await import('@/lib/firebase');

    const messaging = getMessaging(app);
    const token = await getToken(messaging, {
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: swRegistration,
    });

    if (token) {
      await setDoc(doc(db, 'fcm_tokens', userId), {
        token,
        updatedAt: new Date(),
      });
      console.log('FCM Token tersimpan');
    }

    return token;
  } catch (err) {
    console.error('Error FCM:', err);
    return null;
  }
};

export const onForegroundMessage = async (callback: (payload: any) => void) => {
  if (typeof window === 'undefined') return;
  const { getMessaging, onMessage } = await import('firebase/messaging');
  const { app } = await import('@/lib/firebase');
  const messaging = getMessaging(app);
  return onMessage(messaging, callback);
};