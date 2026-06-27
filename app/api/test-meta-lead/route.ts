import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

// ====================================================================
// ENDPOINT TES SEMENTARA - mensimulasikan lead masuk dari Meta Ads
// TANPA perlu koneksi Facebook asli. Menjalankan logika yang SAMA
// dengan /api/meta-webhook (buat lead -> rolling -> email).
//
// CARA PAKAI: kirim POST dengan body JSON, contoh:
// { "nama": "Budi Tes", "hp": "081234567890", "email": "budi@gmail.com" }
//
// PENTING: HAPUS endpoint ini setelah selesai tes (alasan keamanan -
// siapa pun yang tahu URL ini bisa membuat lead palsu tanpa batas).
// ====================================================================

const APP_URL = 'https://terrazen-crm.vercel.app';

function normalizeHP(hp: string): string {
  const cleaned = (hp || '').replace(/[\s\-]/g, '');
  if (cleaned.startsWith('+62')) return '0' + cleaned.slice(3);
  if (cleaned.startsWith('62')) return '0' + cleaned.slice(2);
  return cleaned;
}

function buildRollingQueue(rollingOrder: string[], rollingSkip: string[], lastWinnerIndex: number): string[] {
  if (!rollingOrder || rollingOrder.length === 0) return [];
  const aktif = rollingOrder.filter(uid => !rollingSkip.includes(uid));
  if (aktif.length === 0) return [];
  const winnerIdx = lastWinnerIndex % rollingOrder.length;
  let firstIdx = -1;
  for (let i = 1; i <= rollingOrder.length; i++) {
    const idx = (winnerIdx + i) % rollingOrder.length;
    if (!rollingSkip.includes(rollingOrder[idx])) { firstIdx = idx; break; }
  }
  if (firstIdx === -1) return aktif;
  const queue: string[] = [];
  for (let i = 0; i < rollingOrder.length && queue.length < 2; i++) {
    const idx = (firstIdx + i) % rollingOrder.length;
    if (!rollingSkip.includes(rollingOrder[idx])) queue.push(rollingOrder[idx]);
  }
  return queue;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const nama = body?.nama || 'Lead Tes Meta';
    const hpRaw = body?.hp || '';
    const email = body?.email || null;

    if (!hpRaw) {
      return NextResponse.json({ error: 'hp wajib diisi' }, { status: 400 });
    }
    const hp = normalizeHP(hpRaw);

    // Ambil konfigurasi distribusi (sama seperti webhook asli)
    const configSnap = await adminDb.collection('distribution_settings').doc('config').get();
    const config = configSnap.data() ?? {};
    const rollingOrder: string[] = (config.rollingOrder || []).filter(Boolean);
    const rollingSkip: string[] = (config.rollingSkip || []).filter(Boolean);
    const lastWinnerIndex: number = config.lastWinnerIndex ?? 0;

    const queue = buildRollingQueue(rollingOrder, rollingSkip, lastWinnerIndex);

    if (queue.length === 0) {
      const docRef = await adminDb.collection('leads').add({
        nama, hp, email,
        project: null,
        sumber: 'Meta Ads (TES)',
        status: 'Baru',
        catatan: null,
        nextFollowUp: null,
        distributionType: 'rolling',
        distributionStatus: 'pending',
        rollingQueue: [],
        currentQueueIndex: 0,
        assignedTo: null,
        takenBy: null,
        takenAt: null,
        createdAt: FieldValue.serverTimestamp(),
        firstOpenedAt: null,
        waClickedAt: null,
        followUpHistory: [],
        isTestLead: true,
      });
      return NextResponse.json({
        ok: true,
        status: 'Lead tersimpan TAPI tidak ada sales aktif dalam rolling',
        leadId: docRef.id,
      });
    }

    const docRef = await adminDb.collection('leads').add({
      nama, hp, email,
      project: null,
      sumber: 'Meta Ads (TES)',
      status: 'Baru',
      catatan: null,
      nextFollowUp: null,
      distributionType: 'rolling',
      distributionStatus: 'pending',
      rollingQueue: queue,
      currentQueueIndex: 0,
      queueExpiredAt: new Date(Date.now() + 3 * 60 * 1000),
      assignedTo: null,
      takenBy: null,
      takenAt: null,
      createdAt: FieldValue.serverTimestamp(),
      firstOpenedAt: null,
      waClickedAt: null,
      followUpHistory: [],
      isTestLead: true,
    });

    const firstUid = queue[0];
    let emailResult: any = null;
    try {
      const res = await fetch(`${APP_URL}/api/send-notification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: '🏠 Lead Baru Untuk Anda!',
          body: `${nama} - Meta Ads (TES)`,
          targetUid: firstUid,
          projectName: 'Meta Ads',
          data: { type: 'new_lead_distribution', leadId: docRef.id },
        }),
      });
      emailResult = await res.json();
    } catch (e: any) {
      emailResult = { error: e.message };
    }

    return NextResponse.json({
      ok: true,
      status: 'Lead masuk antrian rolling, email dikirim ke sales pertama',
      leadId: docRef.id,
      antrianRolling: queue,
      targetSalesPertama: firstUid,
      hasilEmail: emailResult,
    });
  } catch (err: any) {
    console.error('Test meta lead error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}