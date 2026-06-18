import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, adminDb } from "@/lib/firebaseAdmin";

export async function POST(req: NextRequest) {
  try {
    const adminAuth = await getAdminAuth();

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    const idToken = authHeader.replace("Bearer ", "");
    const decodedToken = await adminAuth.verifyIdToken(idToken);

    const adminSnap = await adminDb
      .collection("users")
      .where("email", "==", decodedToken.email?.toLowerCase())
      .get();

    if (
      adminSnap.empty ||
      adminSnap.docs[0].data().role !== "admin"
    ) {
      return NextResponse.json(
        { error: "Forbidden: bukan admin" },
        { status: 403 }
      );
    }

    const { uid } = await req.json();
    if (!uid) {
      return NextResponse.json(
        { error: "UID wajib diisi" },
        { status: 400 }
      );
    }

    await adminAuth.updateUser(uid, {
      password: "123456",
    });

    await adminDb.collection("users").doc(uid).update({
      mustChangePassword: true,
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: "Password berhasil direset ke 123456",
    });
  } catch (error: any) {
    console.error("RESET PASSWORD ERROR:", error);
    return NextResponse.json(
      {
        error: error.message || "Terjadi kesalahan server",
      },
      {
        status: 500,
      }
    );
  }
}