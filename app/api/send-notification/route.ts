import { NextRequest, NextResponse } from 'next/server';
import { adminDb, getAdminAuth } from '@/lib/firebaseAdmin';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const APP_URL = 'https://terrazen-crm.vercel.app';
const FROM_EMAIL = 'noreply@terrazen.cloud';

export async function POST(req: NextRequest) {
  try {
    const { title, body, targetUid, data, projectName } = await req.json();
    if (!targetUid) {
      return NextResponse.json({ message: 'targetUid wajib diisi' }, { status: 400 });
    }

    // Ambil konfigurasi distribusi
    const configSnap = await adminDb.collection('distribution_settings').doc('config').get();
    const config = configSnap.data() ?? {};
    const useRealSalesEmail = config.useRealSalesEmail === true;
    const testingEmailRecipient = config.testingEmailRecipient;

    // Tentukan email tujuan
    let toEmail: string | null = null;

    if (useRealSalesEmail) {
      // Mode produksi: kirim ke email sales asli (ambil dari Firestore users by UID)
      const userSnap = await adminDb.collection('users').doc(targetUid).get();
      const userData = userSnap.data();
      toEmail = userData?.email ?? null;
      if (!toEmail) {
        return NextResponse.json(
          { error: `Email sales (uid: ${targetUid}) tidak ditemukan di Firestore` },
          { status: 400 }
        );
      }
    } else {
      // Mode testing: kirim ke alamat testing
      toEmail = testingEmailRecipient;
      if (!toEmail) {
        return NextResponse.json(
          { error: 'testingEmailRecipient belum diatur di Firestore (distribution_settings/config)' },
          { status: 400 }
        );
      }
    }

    const leadId = data?.leadId;
    const isLeadDistribution = data?.type === 'new_lead_distribution';

    let htmlBody = `<p>${body}</p>`;
    if (isLeadDistribution && leadId) {
      const acceptUrl = `${APP_URL}/lead-respond?leadId=${leadId}&action=accept&uid=${targetUid}`;
      const rejectUrl = `${APP_URL}/lead-respond?leadId=${leadId}&action=reject&uid=${targetUid}`;
      htmlBody = `
        <div style="font-family: sans-serif; max-width: 480px;">
          <h2>${title}</h2>
          <p>${body}</p>
          <p style="margin-top: 24px;">
            <a href="${acceptUrl}" style="background:#16a34a;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;margin-right:12px;display:inline-block;">Terima</a>
            <a href="${rejectUrl}" style="background:#dc2626;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block;">Tolak</a>
          </p>
        </div>
      `;
    }

    // Nama pengirim = nama project (fallback ke SalesHub kalau kosong)
    const namaPengirim = (projectName && String(projectName).trim()) || 'SalesHub';
    // Bersihkan karakter yang bisa merusak header (kutip, kurung sudut)
    const namaPengirimBersih = namaPengirim.replace(/["<>]/g, '').trim();

    const result = await resend.emails.send({
      from: `${namaPengirimBersih} <${FROM_EMAIL}>`,
      to: toEmail,
      subject: title,
      html: htmlBody,
    });

    if (result.error) {
      console.error('Resend error:', result.error);
      return NextResponse.json({ error: result.error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, emailId: result.data?.id, intendedFor: targetUid });
  } catch (err: any) {
    console.error('Send notification (email) error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}