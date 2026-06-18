import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';

export async function POST(req: NextRequest) {
  try {
    const { leadId, action, uid } = await req.json();

    if (!leadId || !action || !uid) {
      return NextResponse.json({ error: 'leadId, action, dan uid wajib diisi' }, { status: 400 });
    }

    const leadRef = adminDb.collection('leads').doc(leadId);
    const leadSnap = await leadRef.get();

    if (!leadSnap.exists) {
      return NextResponse.json({ error: 'Lead tidak ditemukan' }, { status: 404 });
    }

    const lead = leadSnap.data()!;

    // Cek apakah lead masih pending (belum diambil sales lain)
    if (lead.distributionStatus !== 'pending') {
      return NextResponse.json({ message: 'Lead ini sudah diproses sales lain' }, { status: 409 });
    }

    if (action === 'accept') {
      // Untuk mode rolling: pastikan uid yang menerima memang sales yang sedang giliran
      if (lead.distributionType === 'rolling') {
        const queue: string[] = lead.rollingQueue ?? [];
        const currentIndex: number = lead.currentQueueIndex ?? 0;
        const currentTurnUid = queue[currentIndex];
        if (currentTurnUid !== uid) {
          return NextResponse.json({ message: 'Belum giliran Anda untuk lead ini' }, { status: 403 });
        }
      }

      // Untuk mode rebutan: uid harus termasuk dalam rebutanGroup
      if (lead.distributionType === 'rebutan') {
        const group: string[] = lead.rebutanGroup ?? [];
        if (!group.includes(uid)) {
          return NextResponse.json({ message: 'Anda tidak termasuk dalam grup rebutan ini' }, { status: 403 });
        }
      }

      await leadRef.update({
        assignedTo: uid,
        distributionStatus: 'assigned',
        queueExpiredAt: null,
        currentQueueIndex: null,
      });

      return NextResponse.json({ message: 'Lead berhasil diterima', leadId });
    }

    if (action === 'reject') {
      if (lead.distributionType === 'rolling') {
        const queue: string[] = lead.rollingQueue ?? [];
        const currentIndex: number = lead.currentQueueIndex ?? 0;
        const nextIndex = currentIndex + 1;

        if (nextIndex < queue.length) {
          const newExpiredAt = new Date(Date.now() + 3 * 60 * 1000);
          await leadRef.update({
            currentQueueIndex: nextIndex,
            queueExpiredAt: newExpiredAt,
          });

          // Kirim notifikasi ke sales berikutnya
          const nextUid = queue[nextIndex];
          await fetch(`${req.nextUrl.origin}/api/send-notification`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: 'Lead Baru Untuk Anda',
              body: `${lead.nama} - ${lead.project}`,
              targetUid: nextUid,
              data: {
                type: 'new_lead_distribution',
                leadId,
              },
            }),
          }).catch(() => null);

          return NextResponse.json({ message: 'Lead ditolak, dilempar ke sales berikutnya' });
        } else {
          // Semua sales dalam queue sudah menolak → masuk Data Bank
          await leadRef.update({
            distributionStatus: 'databank',
            queueExpiredAt: null,
            currentQueueIndex: null,
          });
          return NextResponse.json({ message: 'Lead ditolak semua sales, masuk Data Bank' });
        }
      }

      // Mode rebutan: tolak tidak mengubah apa-apa, sales lain masih bisa terima
      return NextResponse.json({ message: 'Lead ditolak' });
    }

    return NextResponse.json({ error: 'Action tidak valid' }, { status: 400 });

  } catch (err: any) {
    console.error('respond error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}