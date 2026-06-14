import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";

export async function POST(req: NextRequest) {
  try {
    // Verifikasi token Firebase
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const idToken = authHeader.split("Bearer ")[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);

    // Cek role via email di Firestore (bukan via UID)
    const usersSnap = await adminDb
      .collection("users")
      .where("email", "==", decodedToken.email?.toLowerCase())
      .get();

    if (usersSnap.empty || usersSnap.docs[0].data().role !== "admin") {
      return NextResponse.json({ error: "Forbidden: bukan admin" }, { status: 403 });
    }

    // Ambil data dari request
    const body = await req.json();
    const { nama, email, hp, projectId, password } = body;

    if (!nama || !email || !hp || !projectId || !password) {
      return NextResponse.json({ error: "Semua field wajib diisi" }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "Password minimal 6 karakter" }, { status: 400 });
    }

    // Buat akun Firebase Authentication
    const userRecord = await adminAuth.createUser({
      email: email.toLowerCase().trim(),
      password,
      displayName: nama.trim(),
    });

    const uid = userRecord.uid;

    // Simpan ke Firestore dengan doc ID = UID
    await adminDb.collection("users").doc(uid).set({
      uid,
      nama: nama.trim(),
      email: email.toLowerCase().trim(),
      hp: hp.trim(),
      projectId,
      role: "sales",
      aktif: true,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      uid,
      message: `Sales "${nama}" berhasil dibuat`,
    });

  } catch (error: any) {
    console.error("CREATE USER ERROR:", error);
    const pesan =
      error.code === "auth/email-already-exists" ? "Email sudah terdaftar" :
      error.code === "auth/invalid-email" ? "Format email tidak valid" :
      error.code === "auth/weak-password" ? "Password terlalu lemah" :
      error.message || "Terjadi kesalahan server";
    return NextResponse.json({ error: pesan }, { status: 500 });
  }
}