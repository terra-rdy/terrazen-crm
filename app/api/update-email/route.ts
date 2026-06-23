import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, adminDb } from "@/lib/firebaseAdmin";

export async function POST(req: NextRequest) {
  try {
    const adminAuth = await getAdminAuth();

    // Verifikasi token admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const idToken = authHeader.split("Bearer ")[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);

    // Cek role admin via email di Firestore
    const usersSnap = await adminDb
      .collection("users")
      .where("email", "==", decodedToken.email?.toLowerCase())
      .get();
    if (usersSnap.empty || usersSnap.docs[0].data().role !== "admin") {
      return NextResponse.json({ error: "Forbidden: bukan admin" }, { status: 403 });
    }

    // Ambil data
    const body = await req.json();
    const { uid, newEmail } = body;
    if (!uid || !newEmail) {
      return NextResponse.json({ error: "UID dan email baru wajib diisi" }, { status: 400 });
    }

    const emailBersih = String(newEmail).toLowerCase().trim();
    // Validasi format email sederhana
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailBersih)) {
      return NextResponse.json({ error: "Format email tidak valid" }, { status: 400 });
    }

    // 1) Ubah email di Firebase Authentication (UID tetap sama)
    await adminAuth.updateUser(uid, { email: emailBersih });

    // 2) Update email di Firestore (dokumen dengan ID = UID)
    await adminDb.collection("users").doc(uid).update({ email: emailBersih });

    return NextResponse.json({
      success: true,
      message: `Email berhasil diubah ke ${emailBersih}`,
    });
  } catch (error: any) {
    console.error("UPDATE EMAIL ERROR:", error);
    const pesan =
      error.code === "auth/email-already-exists" ? "Email sudah dipakai akun lain" :
      error.code === "auth/invalid-email" ? "Format email tidak valid" :
      error.code === "auth/user-not-found" ? "Akun tidak ditemukan" :
      error.message || "Terjadi kesalahan server";
    return NextResponse.json({ error: pesan }, { status: 500 });
  }
}