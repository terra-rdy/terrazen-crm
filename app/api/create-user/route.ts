import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, adminDb } from "@/lib/firebaseAdmin";

export async function POST(req: NextRequest) {
  try {
    const adminAuth = await getAdminAuth();

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
    const { nama, email, password, role, hp, projectId } = body;

    // Hanya nama, email, password yang wajib (sesuai form Tambah Sales)
    if (!nama || !email || !password) {
      return NextResponse.json({ error: "Nama, email, dan password wajib diisi" }, { status: 400 });
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
    const dataUser: any = {
      uid,
      nama: nama.trim(),
      email: email.toLowerCase().trim(),
      role: role ?? "sales",
      aktif: true,
      password,
      projectIds: [],
      createdAt: new Date().toISOString(),
    };
    // Field opsional, hanya disimpan kalau ada
    if (hp) dataUser.hp = hp.trim();
    if (projectId) dataUser.projectId = projectId;

    await adminDb.collection("users").doc(uid).set(dataUser);

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