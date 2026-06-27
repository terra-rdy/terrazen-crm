import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

const APP_URL = 'https://terrazen-crm.vercel.app';
const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN || '';
const APP_ID = process.env.META_APP_ID || '';
const APP_SECRET = process.env.META_APP_SECRET || '';

// Normalisasi nomor HP ke format 08xxxx (sama seperti di leads page)
function normalizeHP(hp: string): string {
  const cleaned = (hp || '').replace(/[\s\-]/g, '');
  if (cleaned.startsWith('+62')) return '0' + cleaned.slice(3);
  if (cleaned.startsWith('62')) return '0' + cleaned.slice(2);
  return cleaned;
}

// Bangun antrian rolling di sisi server (meniru buildRollingQueue di client)
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

// ====== GET: verifikasi webhook oleh Meta ======
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    // Meta mengharapkan balasan berupa nilai challenge (plain text)
    return new NextResponse(challenge || '', { status: 200 });
  }
  return new NextResponse('Forbidden', { status: 403 });
}

// ====== POST: terima notifikasi lead baru dari Meta ======
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Struktur Meta: { object: 'page', entry: [ { changes: [ { field: 'leadgen', value: {...} } ] } ] }
    if (body.object !== 'page') {
      return NextResponse.json({ ok: true, ignored: 'bukan objek page' });
    }

    const results: any[] = [];

    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        if (change.field !== 'leadgen') continue;
        const leadgenId = change.value?.leadgen_id;
        if (!leadgenId) continue;

        // 1. Tarik detail lead dari Meta Graph API
        const lead = await ambilDetailLead(leadgenId);
        if (!lead) {
          results.push({ leadgenId, status: 'gagal ambil detail' });
          continue;
        }

        // 2. Buat lead + distribusi rolling
        const r = await prosesLeadMasuk(lead, change.value);
        results.push({ leadgenId, ...r });
      }
    }

    return NextResponse.json({ ok: true, results });
  } catch (err: any) {
    console.error('Meta webhook error:', err);
    // Tetap balas 200 supaya Meta tidak retry berlebihan; error sudah dicatat
    return NextResponse.json({ ok: false, error: err.message }, { status: 200 });
  }
}

// Ambil detail lead (nama, hp, email) dari Graph API memakai App Access Token
async function ambilDetailLead(leadgenId: string): Promise<{ nama: string; hp: string; email: string | null } | null> {
  try {
    const accessToken = `${APP_ID}|${APP_SECRET}`; // App Access Token
    const url = `https://graph.facebook.com/v21.0/${leadgenId}?access_token=${encodeURIComponent(accessToken)}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.error) {
      console.error('Graph API error:', data.error);
      return null;
    }
    // field_data: [ { name: 'full_name', values: ['...'] }, { name: 'phone_number', values: ['...'] }, ... ]
    const fields: { name: string; values: string[] }[] = data.field_data || [];
    const get = (keys: string[]) => {
      for (const f of fields) {
        if (keys.some(k => f.name?.toLowerCase().includes(k))) {
          return f.values?.[0] ?? null;
        }
      }
      return null;
    };
    const nama = get(['full_name', 'name']) || 'Lead Meta';
    const hpRaw = get(['phone', 'phone_number', 'telepon']) || '';
    const email = get(['email']) || null;
    return { nama, hp: normalizeHP(hpRaw), email };
  } catch (e) {
    console.error('ambilDetailLead gagal:', e);
    return null;
  }
}

// Buat lead di Firestore + jalankan distribusi Rolling + email ke sales pertama
async function prosesLeadMasuk(
  lead: { nama: string; hp: string; email: string | null },
  metaValue: any
) {
  // Ambil konfigurasi distribusi
  const configSnap = await adminDb.collection('distribution_settings').doc('config').get();
  const config = configSnap.data() ?? {};
  const rollingOrder: string[] = (config.rollingOrder || []).filter(Boolean);
  const rollingSkip: string[] = (config.rollingSkip || []).filter(Boolean);
  const lastWinnerIndex: number = config.lastWinnerIndex ?? 0;

  const queue = buildRollingQueue(rollingOrder, rollingSkip, lastWinnerIndex);
  if (queue.length === 0) {
    // Tidak ada sales aktif: simpan lead sebagai pending tanpa antrian (jangan hilang)
    const docRef = await adminDb.collection('leads').add({
      nama: lead.nama,
      hp: lead.hp,
      email: lead.email ?? null,
      project: null,
      sumber: 'Meta Ads',
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
      metaLeadgenId: metaValue?.leadgen_id ?? null,
      metaFormId: metaValue?.form_id ?? null,
    });
    return { status: 'tersimpan tanpa sales aktif', leadId: docRef.id };
  }

  const docRef = await adminDb.collection('leads').add({
    nama: lead.nama,
    hp: lead.hp,
    email: lead.email ?? null,
    project: null,
    sumber: 'Meta Ads',
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
    metaLeadgenId: metaValue?.leadgen_id ?? null,
    metaFormId: metaValue?.form_id ?? null,
  });

  // Kirim email ke sales pertama dalam antrian (alur sama dengan input manual)
  const firstUid = queue[0];
  try {
    await fetch(`${APP_URL}/api/send-notification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: '🏠 Lead Baru Untuk Anda!',
        body: `${lead.nama} - Meta Ads`,
        targetUid: firstUid,
        projectName: 'Meta Ads',
        data: { type: 'new_lead_distribution', leadId: docRef.id },
      }),
    });
  } catch (e) {
    console.error('Gagal kirim email lead Meta:', e);
  }

  return { status: 'lead masuk antrian rolling', leadId: docRef.id, targetSales: firstUid };
}