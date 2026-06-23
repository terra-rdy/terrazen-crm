"use client";

import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { collection, query, where, getDocs } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

export default function LoginPage() {
  const [email, setEmail]             = useState("");
  const [password, setPassword]       = useState("");
  const [devCode, setDevCode]         = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]         = useState(false);

  const handleLogin = async () => {
    if (!email || !password || !devCode) {
      alert("Email, password, dan kode developer wajib diisi");
      return;
    }

    setLoading(true);

    try {
      // LANGKAH 1: Login Firebase Auth
      await signInWithEmailAndPassword(auth, email.toLowerCase().trim(), password);

      // LANGKAH 2: Cek kode developer
      const devQuery = query(
        collection(db, "developers"),
        where("kode", "==", devCode.trim().toUpperCase())
      );
      const devSnap = await getDocs(devQuery);

      if (devSnap.empty) {
        alert("Kode developer tidak valid");
        await auth.signOut();
        setLoading(false);
        return;
      }

      const devData = devSnap.docs[0].data();

      if (devData.aktif === false) {
        alert("Developer ini tidak aktif");
        await auth.signOut();
        setLoading(false);
        return;
      }

      // LANGKAH 3: Ambil data user
      const userQuery = query(
        collection(db, "users"),
        where("email", "==", email.toLowerCase().trim())
      );
      const userSnap = await getDocs(userQuery);

      if (userSnap.empty) {
        alert("Akun tidak ditemukan di sistem");
        await auth.signOut();
        setLoading(false);
        return;
      }

      const userData = userSnap.docs[0].data();

      // LANGKAH 4: Cek aktif
      if (userData.aktif === false) {
        alert("Akun Anda telah dinonaktifkan. Hubungi administrator.");
        await auth.signOut();
        setLoading(false);
        return;
      }

      // LANGKAH 5: Arahkan berdasarkan role
      if (userData.role === "admin") {
        window.location.href = "/dashboard";
        return;
      }

      if (userData.role === "sales") {
        window.location.href = "/leads";
        return;
      }

      alert("Role tidak ditemukan. Hubungi administrator.");
      await auth.signOut();
    } catch (error: any) {
      const pesan =
        error.code === "auth/invalid-credential" ? "Email atau password salah" :
        error.code === "auth/invalid-email"       ? "Format email tidak valid" :
        error.code === "auth/too-many-requests"   ? "Terlalu banyak percobaan login. Coba lagi nanti." :
        error.code === "auth/user-disabled"       ? "Akun ini telah dinonaktifkan" :
        "Gagal login: " + error.message;
      alert(pesan);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleLogin();
  };

  return (
    <div style={{
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      minHeight: "100vh",
      background: "#f5f5f5",
    }}>
      <div style={{
        background: "white",
        padding: 40,
        borderRadius: 12,
        boxShadow: "0 2px 16px rgba(0,0,0,0.1)",
        width: 360,
      }}>
        <h2 style={{ margin: "0 0 8px", textAlign: "center" }}>SalesHub</h2>
        <p style={{ margin: "0 0 24px", textAlign: "center", color: "#888", fontSize: 14 }}>
          Masuk ke akun Anda
        </p>

        {/* Email */}
        <label style={{ fontSize: 13, fontWeight: 500 }}>Email</label>
        <br />
        <input
          type="email"
          placeholder="email@domain.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={handleKeyDown}
          style={{
            width: "100%", padding: 10, marginTop: 4, marginBottom: 16,
            borderRadius: 6, border: "1px solid #ccc",
            boxSizing: "border-box", fontSize: 14,
          }}
        />

        {/* Password */}
        <label style={{ fontSize: 13, fontWeight: 500 }}>Password</label>
        <br />
        <div style={{ position: "relative", marginTop: 4, marginBottom: 16 }}>
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{
              width: "100%", padding: 10, paddingRight: 44,
              borderRadius: 6, border: "1px solid #ccc",
              boxSizing: "border-box", fontSize: 14,
            }}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            style={{
              position: "absolute", right: 10, top: "50%",
              transform: "translateY(-50%)", background: "none",
              border: "none", cursor: "pointer", fontSize: 16,
              color: "#666", padding: 0,
            }}
          >
            {showPassword ? "🙈" : "👁️"}
          </button>
        </div>

        {/* Kode Developer */}
        <label style={{ fontSize: 13, fontWeight: 500 }}>Kode Developer</label>
        <br />
        <input
          placeholder="Contoh: PNL"
          value={devCode}
          onChange={(e) => setDevCode(e.target.value)}
          onKeyDown={handleKeyDown}
          style={{
            width: "100%", padding: 10, marginTop: 4, marginBottom: 24,
            borderRadius: 6, border: "1px solid #ccc",
            boxSizing: "border-box", fontSize: 14,
            textTransform: "uppercase",
          }}
        />

        {/* Tombol Login */}
        <button
          onClick={handleLogin}
          disabled={loading}
          style={{
            width: "100%", padding: 12,
            background: loading ? "#aaa" : "#1F4E79",
            color: "white", border: "none", borderRadius: 6,
            cursor: loading ? "not-allowed" : "pointer",
            fontSize: 15, fontWeight: 500,
          }}
        >
          {loading ? "⏳ Masuk..." : "Login"}
        </button>
      </div>
    </div>
  );
}