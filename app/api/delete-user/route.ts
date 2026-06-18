import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, adminDb } from "@/lib/firebaseAdmin";

export async function POST(req: NextRequest) {
  try {
    const adminAuth = await getAdminAuth();

    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    const idToken = authHeader.split("Bearer ")[1];
    const decodedToken =
      await adminAuth.verifyIdToken(idToken);

    const usersSnap = await adminDb
      .collection("users")
      .where(
        "email",
        "==",
        decodedToken.email?.toLowerCase()
      )
      .get();

    if (
      usersSnap.empty ||
      usersSnap.docs[0].data().role !== "admin"
    ) {
      return NextResponse.json(
        { error: "Forbidden" },
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

    try {
      await adminAuth.deleteUser(uid);
    } catch (error: any) {
      if (
        error.code === "auth/user-not-found"
      ) {
        return NextResponse.json({
          success: true,
          warning: "User Auth tidak ditemukan"
        });
      }
      throw error;
    }

    return NextResponse.json({
      success: true
    });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json(
      {
        error: error.message
      },
      {
        status: 500
      }
    );
  }
}