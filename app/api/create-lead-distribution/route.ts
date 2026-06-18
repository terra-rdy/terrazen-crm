import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import type { DocumentReference } from 'firebase-admin/firestore';

function sensorHP(hp: string): string {
  if (!hp || hp.length < 6) return hp;
  return hp.slice(0, 4) + 'xxxx' + hp.slice(-2);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      nama, hp, project, status, sumber, catatan,
      distributionType, // 'rolling' | 'rebutan' | 'manual'
      manualAssignTo,   // dipakai kalau distributionType === 'manual'
    } = body;

    if (!nama || !hp || !project || !status || !distributionType) {
      return NextResponse.json({ error: 'Data lead tidak lengkap' }, { status: 400 });
    }

    const baseLeadData: any = {
      nama,
      hp,
      project,
      status,
      sumber: sumber ?? null,
      catatan: catatan ?? null,
      createdAt: FieldValue.serverTimestamp(),
    };

    let leadRef: DocumentReference;

    if (distributionType === 'manual') {
      // Langsung assign, tidak perlu proses distribusi
      leadRef = await adminDb.collection('leads').add({
        ...baseLeadData,
        assignedTo: manualAssignTo ?? null,
        distributionType: 'manual',
        distributionStatus: 'assigned',
      });

      return NextResponse.json({ message: 'Lead berhasil disimpan dan di-assign manual', leadId: leadRef.id });
    }

    // Ambil config rolling/rebutan
    const configSnap = await adminDb.collection('distribution_settings').doc('config').get();
    const config = configSnap.data() ?? {};

    if (distributionType === 'rolling') {
      const rollingOrder: string[] = config.rollingOrder ?? [];
      if (rollingOrder.length === 0) {
        return NextResponse.json({ error: 'Rolling order belum diatur di pengaturan distribusi' }, { status: 400 });
      }

      const queueExpiredAt = new Date(Date.now() + 3 * 60 * 1000); // +3 menit

      leadRef = await adminDb.collection('leads').add({
        ...baseLeadData,
        assignedTo: null,
        distributionType: 'rolling',
        distributionStatus: 'pending',
        rollingQueue: rollingOrder,
        currentQueueIndex: 0,
        queueExpiredAt,
      });

      // Kirim notifikasi ke sales pertama dalam queue
      const firstUid = rollingOrder[0];
      await fetch(`${req.nextUrl.origin}/api/send-notification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Lead Baru Untuk Anda',
          body: `${nama} - ${project} - ${sensorHP(hp)}`,
          targetUid: firstUid,
          data: { type: 'new_lead_distribution', leadId: leadRef.id },
        }),
      }).catch(() => null);

      return NextResponse.json({ message: 'Lead dikirim ke sales pertama (rolling)', leadId: leadRef.id });
    }

    if (distributionType === 'rebutan') {
      const rebutanGroup: string[] = config.rebutanGroup ?? [];
      if (rebutanGroup.length === 0) {
        return NextResponse.json({ error: 'Rebutan group belum diatur di pengaturan distribusi' }, { status: 400 });
      }

      leadRef = await adminDb.collection('leads').add({
        ...baseLeadData,
        assignedTo: null,
        distributionType: 'rebutan',
        distributionStatus: 'pending',
        rebutanGroup,
      });

      // Kirim notifikasi ke SEMUA sales dalam rebutan group sekaligus
      await Promise.allSettled(
        rebutanGroup.map(uid =>
          fetch(`${req.nextUrl.origin}/api/send-notification`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: 'Lead Baru - Rebutan!',
              body: `${nama} - ${project} - ${sensorHP(hp)}`,
              targetUid: uid,
              data: { type: 'new_lead_distribution', leadId: leadRef.id },
            }),
          })
        )
      );

      return NextResponse.json({ message: 'Lead dikirim ke semua sales (rebutan)', leadId: leadRef.id });
    }

    return NextResponse.json({ error: 'distributionType tidak valid' }, { status: 400 });

  } catch (err: any) {
    console.error('create-lead-distribution error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}