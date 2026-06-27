import { NextResponse } from 'next/server';

// Endpoint diagnostik SEMENTARA - hapus setelah selesai debug.
// Tidak membocorkan nilai rahasia, hanya menunjukkan apakah env var terisi.
export async function GET() {
  const verify = process.env.META_VERIFY_TOKEN;
  const appId = process.env.META_APP_ID;
  const secret = process.env.META_APP_SECRET;

  return NextResponse.json({
    META_VERIFY_TOKEN: {
      ada: verify !== undefined && verify !== null,
      kosong: !verify,
      panjang: verify ? verify.length : 0,
      awalan: verify ? verify.slice(0, 4) : null,
      akhiran: verify ? verify.slice(-4) : null,
    },
    META_APP_ID: {
      ada: appId !== undefined && appId !== null,
      panjang: appId ? appId.length : 0,
    },
    META_APP_SECRET: {
      ada: secret !== undefined && secret !== null,
      panjang: secret ? secret.length : 0,
    },
  });
}