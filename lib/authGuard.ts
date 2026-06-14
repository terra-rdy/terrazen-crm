"use client";

import { auth, db } from "./firebase";
import { doc, getDoc } from "firebase/firestore";

export interface CurrentUser {
  uid: string;
  email: string;
  nama: string;
  role: string;
  hp?: string;
  aktif: boolean;
}

let cachedUser: CurrentUser | null = null;

export const getCurrentUser = async (): Promise<CurrentUser | null> => {
  try {
    if (cachedUser) return cachedUser;

    await auth.authStateReady();
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) return null;

    // FIX: Query by UID langsung — lebih efisien dan sesuai Security Rules
    const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
    if (!userDoc.exists()) return null;

    const docData = userDoc.data();

    if (docData.aktif === false) {
      await auth.signOut();
      cachedUser = null;
      return null;
    }

    cachedUser = {
      uid: firebaseUser.uid,
      email: docData.email || firebaseUser.email || "",
      nama: docData.nama || "",
      role: docData.role || "",
      hp: docData.hp || "",
      aktif: docData.aktif ?? true,
    };

    return cachedUser;
  } catch (error) {
    console.error("AUTH ERROR", error);
    return null;
  }
};

export const clearUserCache = () => {
  cachedUser = null;
};

export const getUserRole = async (): Promise<string | null> => {
  const user = await getCurrentUser();
  return user?.role ?? null;
};

export const isAdmin = async (): Promise<boolean> => {
  const user = await getCurrentUser();
  return user?.role === "admin";
};

export const isSales = async (): Promise<boolean> => {
  const user = await getCurrentUser();
  return user?.role === "sales";
};