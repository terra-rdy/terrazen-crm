'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      if (!firebaseUser) {
        router.push('/login');
        return;
      }

      try {
        const snap = await getDocs(collection(db, 'users'));
        const users = snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
        const me = users.find(u => u.id === firebaseUser.uid);

        if (me?.role === 'admin') {
          router.push('/dashboard');
        } else {
          router.push('/leads');
        }
      } catch {
        router.push('/login');
      }
    });

    return () => unsubscribe();
  }, [router]);

  return null;
}