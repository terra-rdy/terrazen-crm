import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { getMessaging } from 'firebase-admin/messaging';

export async function POST(req: NextRequest) {
  try {
    const { title, body, targetRole, targetUid, data } = await req.json();

    let tokens: string[] = [];

    if (targetUid) {
      const tokenDoc = await adminDb.collection('fcm_tokens').doc(targetUid).get();
      if (tokenDoc.exists) {
        const t = tokenDoc.data()?.token;
        if (t) tokens.push(t);
      }
    } else {
      const tokensSnap = await adminDb.collection('fcm_tokens')
        .where('role', '==', targetRole ?? 'sales')
        .get();

      tokensSnap.docs.forEach(d => {
        const t = d.data().token;
        if (t) tokens.push(t);
      });
    }

    if (tokens.length === 0) {
      return NextResponse.json({ message: 'Tidak ada token ditemukan' });
    }

    const messaging = getMessaging();

    // Data-only message (TIDAK ada field "notification"), supaya Notifee
    // yang menampilkan notifikasi (untuk action buttons), bukan sistem default.
    const stringData: Record<string, string> = { title, body };
    if (data) {
      Object.keys(data).forEach(key => {
        stringData[key] = String(data[key]);
      });
    }

    const results = await Promise.allSettled(
      tokens.map(token =>
        messaging.send({
          token,
          data: stringData,
          android: {
            priority: 'high',
          },
        })
      )
    );

    const success = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected');

    return NextResponse.json({
      success: true,
      sent: success,
      total: tokens.length,
      errors: failed.map(f => (f as PromiseRejectedResult).reason?.message),
    });

  } catch (err: any) {
    console.error('Send notification error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}