import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';

export async function GET(req: NextRequest) {
  try {
    const leadId = req.nextUrl.searchParams.get('leadId');

    if (!leadId) {
      return NextResponse.json({ error: 'leadId wajib diisi' }, { status: 400 });
    }

    const leadSnap = await adminDb.collection('leads').doc(leadId).get();

    if (!leadSnap.exists) {
      return NextResponse.json({ error: 'Lead tidak ditemukan' }, { status: 404 });
    }

    const lead = leadSnap.data()!;

    return NextResponse.json({
      nama: lead.nama,
      project: lead.project,
      hp: lead.hp,
      distributionStatus: lead.distributionStatus,
      distributionType: lead.distributionType,
    });

  } catch (err: any) {
    console.error('lead-info error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}