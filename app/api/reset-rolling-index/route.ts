import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';

// Endpoint ini dipanggil sekali setiap hari pukul 00:00 (lewat cron job)
// untuk mengembalikan urutan rolling ke sales PERTAMA dalam daftar (rollingOrder[0]).
//
// Caranya: set lastWinnerIndex = -1. Nilai -1 ini membuat perhitungan
// antrian berikutnya (buildRollingQueue) otomatis mulai dari index 0
// (sales pertama), berapa pun sisa putaran kemarin.
export async function GET() {
  try {
    await adminDb.collection('distribution_settings').doc('config').update({
      lastWinnerIndex: -1,
    });
    return NextResponse.json({
      message: 'Reset rolling index berhasil. Lead berikutnya akan mulai dari sales pertama dalam urutan.',
      lastWinnerIndex: -1,
      waktuReset: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('reset-rolling-index error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}