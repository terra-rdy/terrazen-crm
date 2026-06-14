import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';

export async function POST(req: NextRequest) {
  try {
    const { title, body, targetRole } = await req.json();

    // Ambil semua token dari Firestore berdasarkan role
    const tokensSnap = await adminDb.collection('fcm_tokens').get();

    if (tokensSnap.empty) {
      return NextResponse.json({ message: 'Tidak ada token' });
    }

    // Ambil uid semua sales
    const usersSnap = await adminDb.collection('users')
      .where('role', '==', targetRole ?? 'sales')
      .get();

    const salesUids = new Set(usersSnap.docs.map(d => d.id));

    // Filter token hanya untuk sales
    const tokens: string[] = [];
    tokensSnap.docs.forEach(d => {
      if (salesUids.has(d.id)) {
        tokens.push(d.data().token);
      }
    });

    if (tokens.length === 0) {
      return NextResponse.json({ message: 'Tidak ada sales yang terdaftar' });
    }

    // Kirim via Firebase Admin
    const { getMessaging } = await import('firebase-admin/messaging');
    const messaging = getMessaging();

    const results = await Promise.allSettled(
      tokens.map(token =>
        messaging.send({
          token,
          notification: { title, body },
          webpush: {
            notification: {
              title,
              body,
              icon: '/icon-192.png',
            },
          },
        })
      )
    );

    const success = results.filter(r => r.status === 'fulfilled').length;
    return NextResponse.json({ success, total: tokens.length });

  } catch (err: any) {
    console.error('Send notification error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}