import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

export async function GET() {
  try {
    const now = new Date();

    // Ambil semua leads rolling yang masih pending
    const snap = await adminDb
      .collection('leads')
      .where('distributionStatus', '==', 'pending')
      .where('distributionType', '==', 'rolling')
      .get();

    if (snap.empty) {
      return NextResponse.json({ message: 'Tidak ada leads rolling pending', processed: 0 });
    }

    let processed = 0;

    for (const docSnap of snap.docs) {
      const lead = docSnap.data();
      const leadRef = adminDb.collection('leads').doc(docSnap.id);

      // Cek apakah timer sudah expired
      const expiredAt = lead.queueExpiredAt?.toDate?.() ?? null;
      if (!expiredAt || expiredAt > now) continue; // belum expired, skip

      const queue: string[] = lead.rollingQueue ?? [];
      const currentIndex: number = lead.currentQueueIndex ?? 0;
      const nextIndex = currentIndex + 1;

      if (nextIndex < queue.length) {
        // Masih ada sales berikutnya → pindah giliran ke sales ke-2
        const newExpiredAt = new Date(now.getTime() + 3 * 60 * 1000); // +3 menit
        await leadRef.update({
          currentQueueIndex: nextIndex,
          queueExpiredAt: newExpiredAt,
        });
        console.log(`Lead ${docSnap.id}: pindah giliran ke index ${nextIndex} (${queue[nextIndex]})`);
      } else {
        // Semua sales dalam queue sudah lewat → masuk Data Bank
        await leadRef.update({
          distributionStatus: 'databank',
          queueExpiredAt: null,
          currentQueueIndex: null,
        });
        console.log(`Lead ${docSnap.id}: masuk Data Bank`);
      }

      processed++;
    }

    return NextResponse.json({ message: 'Selesai', processed });
  } catch (err: any) {
    console.error('process-rolling error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}