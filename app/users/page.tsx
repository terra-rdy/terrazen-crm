"use client";

import { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
  doc,
  updateDoc
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { getUserRole } from "@/lib/authGuard";

export default function UsersPage() {
  const [nama, setNama] = useState("");
  const [email, setEmail] = useState("");
  const [hp, setHp] = useState("");
  const [projectId, setProjectId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loadingTambah, setLoadingTambah] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editNama, setEditNama] = useState("");
  const [editHp, setEditHp] = useState("");
  const [editProjectId, setEditProjectId] = useState("");
  const [users, setUsers] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [salesDihapus, setSalesDihapus] = useState<any>(null);
  const [salesPengganti, setSalesPengganti] = useState("");
  const [jumlahLead, setJumlahLead] = useState(0);

  const [deleteUser, setDeleteUser] = useState<any>(null);
  const [leadCount, setLeadCount] = useState(0);
  const [showDeleteModal, setShowDeleteModal] = useState(false);


  const router = useRouter();

  useEffect(() => { checkAccess(); }, []);

  const checkAccess = async () => {
    const role = await getUserRole();
    if (role !== "admin") { router.push("/forbidden"); return; }
    await Promise.all([loadUsers(), loadProjects()]);
    setLoading(false);
  };

  const loadUsers = async () => {
    const snapshot = await getDocs(collection(db, "users"));
    setUsers(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
  };

  const loadProjects = async () => {
    const snapshot = await getDocs(collection(db, "projects"));
    setProjects(
      snapshot.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((p: any) => p.aktif === true)
    );
  };

  const tambahSales = async () => {
    if (!nama || !email || !hp || !projectId || !password) {
      alert("Lengkapi semua data terlebih dahulu"); return;
    }
    if (password.length < 6) {
      alert("Password minimal 6 karakter"); return;
    }
    setLoadingTambah(true);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) { alert("Sesi admin tidak ditemukan, silakan login ulang"); router.push("/login"); return; }
      const idToken = await currentUser.getIdToken();
      const res = await fetch("/api/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ nama, email, hp, projectId, password }),
      });
      const text = await res.text();
      let result;
      try {
        result = JSON.parse(text);
      } catch {
        alert(text);
        return;
      }
      if (!res.ok) { alert(`Gagal: ${result.error}`); return; }
      alert(`✅ Sales "${nama}" berhasil ditambahkan!\n\nEmail: ${email}\nPassword awal: ${password}`);
      setNama(""); setEmail(""); setHp(""); setProjectId(""); setPassword("");
      await loadUsers();
    } catch (error: any) {
      alert(`Terjadi kesalahan: ${error.message}`);
    } finally {
      setLoadingTambah(false);
    }
  };

  const simpanEdit = async () => {
    if (!editId || !editNama || !editHp) { alert("Nama dan HP tidak boleh kosong"); return; }
    await updateDoc(doc(db, "users", editId), {
      nama: editNama.trim(), hp: editHp.trim(), projectId: editProjectId,
      updatedAt: new Date().toISOString(),
    });
    setEditId(null);
    await loadUsers();
    alert("Data sales berhasil diupdate");
  };

  const toggleStatus = async (id: string, aktif: boolean) => {
    const konfirmasi = window.confirm(aktif ? "Nonaktifkan sales ini?" : "Aktifkan kembali sales ini?");
    if (!konfirmasi) return;
    await updateDoc(doc(db, "users", id), { aktif: !aktif, updatedAt: new Date().toISOString() });
    await loadUsers();
  };

  const resetPassword = async (uid: string, nama: string) => {
    const konfirmasi = window.confirm(`Reset password ${nama} ke 123456 ?`);
    if (!konfirmasi) return;
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) { alert("Sesi admin habis. Silakan login ulang."); return; }
      const token = await currentUser.getIdToken();
      const res = await fetch("/api/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ uid }),
      });
      const result = await res.json();
      if (!res.ok) { alert(result.error || "Gagal reset password"); return; }
      alert(`✅ Password ${nama} berhasil direset.\n\nPassword baru: 123456`);
    } catch (error: any) {
      alert(error.message);
    }
  };

  const hapusSales = async (user: any) => {
    try {
      const leadsRef = collection(db, "leads");
      const q = query(
        leadsRef,
        where("salesId", "==", (user.uid || user.id))
      );
      const snap = await getDocs(q);
      if (snap.size > 0) {

        const pilihan = window.confirm(
          `${user.nama} masih memiliki ${snap.size} lead.\n\n` +
          `OK = Pindahkan semua lead ke Admin\n` +
          `Cancel = Kelola lead secara manual`
        );

        if (pilihan) {

          for (const lead of snap.docs) {
            await updateDoc(
              doc(db, "leads", lead.id),
              {
                assignedTo: "Admin",
                salesId: null,
                salesPhone: ""
              }
            );
          }

        } else {

          window.location.href =
            `/leads?sales=${encodeURIComponent(user.nama)}`;

          return;
        }

        if (pilihan) {

          for (const lead of snap.docs) {
            await updateDoc(
              doc(db, "leads", lead.id),
              {
                assignedTo: "Admin",
                salesId: null,
                salesPhone: ""
              }
            );
          }

        } else {

          window.location.href =
            `/leads?sales=${encodeURIComponent(user.nama)}`;

          return;
        }
      }


      const konfirmasi = window.confirm(
        `Yakin ingin menghapus sales ${user.nama}?`
      );

      if (!konfirmasi) return;

      if (user.uid) {

        const currentUser = auth.currentUser;

        if (!currentUser) {
          alert("Sesi admin tidak ditemukan");
          return;
        }

        const token =
          await currentUser.getIdToken();

        const res = await fetch(
          "/api/delete-user",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              uid: user.uid,
            }),
          }
        );

        const result = await res.json();

        if (!res.ok) {
          alert(
            `Gagal hapus akun login: ${result.error}`
          );
          return;
        }
      }
        if (user.uid) {

          const currentUser = auth.currentUser;

          if (!currentUser) {
            alert("Sesi admin tidak ditemukan");
            return;
          }

          const token = await currentUser.getIdToken();

          const res = await fetch("/api/delete-user", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              uid: user.uid,
            }),
          });

          const result = await res.json();

          if (!res.ok) {
            alert(`Gagal hapus akun login: ${result.error}`);
            return;
          }
        }

      await deleteDoc(doc(db, "users", user.id));

      alert(`Sales ${user.nama} berhasil dihapus`);

      await loadUsers();
    } catch (error: any) {
      alert(error.message);
    }
  };

  if (loading) return <div style={{ padding: 30 }}>Loading...</div>;

      const salesList = users.filter((u: any) => u.role === "sales");
      const adminList = users.filter((u: any) => u.role === "admin");

  return (
    <div style={{ padding: 30 }}>
      <h1>Master Sales</h1>
      <hr />
      <h3>Tambah Sales Baru</h3>

      <label>Nama Sales</label><br />
      <input placeholder="Nama lengkap" value={nama} onChange={(e) => setNama(e.target.value)}
        style={{ padding: 8, width: 300, marginBottom: 10 }} /><br />

      <label>Email</label><br />
      <input type="email" placeholder="email@terrazen.com" value={email} onChange={(e) => setEmail(e.target.value)}
        style={{ padding: 8, width: 300, marginBottom: 10 }} /><br />

      <label>Nomor HP</label><br />
      <input placeholder="08xxxxxxxxxx" value={hp} onChange={(e) => setHp(e.target.value)}
        style={{ padding: 8, width: 300, marginBottom: 10 }} /><br />

      <label>Password Awal</label><br />
      <div style={{ position: "relative", display: "inline-block", marginBottom: 10 }}>
        <input
          placeholder="Min. 6 karakter"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type={showPassword ? "text" : "password"}
          style={{ padding: 8, width: 300, paddingRight: 44 }}
        />
        <button type="button" onClick={() => setShowPassword((v) => !v)}
          style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
            background: "none", border: "none", cursor: "pointer", fontSize: 16 }}>
          {showPassword ? "🙈" : "👁️"}
        </button>
      </div><br />

      <label>Project</label><br />
      <select value={projectId} onChange={(e) => setProjectId(e.target.value)}
        style={{ padding: 8, width: 316, marginBottom: 10 }}>
        <option value="">Pilih Project</option>
        {projects.map((p: any) => <option key={p.id} value={p.id}>{p.nama}</option>)}
      </select><br /><br />

      <button onClick={tambahSales} disabled={loadingTambah}
        style={{ background: loadingTambah ? "#aaa" : "#1677ff", color: "white", border: "none",
          padding: "10px 24px", borderRadius: 6, cursor: loadingTambah ? "not-allowed" : "pointer" }}>
        {loadingTambah ? "⏳ Menyimpan..." : "Simpan Sales"}
      </button>

      <hr />
      <h3>Daftar Sales ({salesList.length})</h3>

      {salesList.map((user: any) => (
        <div key={user.id} style={{
          border: user.aktif ? "1px solid #d9d9d9" : "1px solid #ffccc7",
          background: user.aktif ? "#fff" : "#fff2f0",
          padding: 16, marginBottom: 12, borderRadius: 8,
        }}>
          {editId === user.id ? (
            <div>
              <h4 style={{ margin: "0 0 12px" }}>✏️ Edit Sales</h4>
              <label>Nama</label><br />
              <input value={editNama} onChange={(e) => setEditNama(e.target.value)}
                style={{ padding: 7, width: 280, marginBottom: 10 }} /><br />
              <label>HP</label><br />
              <input value={editHp} onChange={(e) => setEditHp(e.target.value)}
                style={{ padding: 7, width: 280, marginBottom: 10 }} /><br />
              <label>Project</label><br />
              <select value={editProjectId} onChange={(e) => setEditProjectId(e.target.value)}
                style={{ padding: 7, width: 296, marginBottom: 14 }}>
                <option value="">Pilih Project</option>
                {projects.map((p: any) => <option key={p.id} value={p.id}>{p.nama}</option>)}
              </select><br />
              <button onClick={simpanEdit}
                style={{ background: "#52c41a", color: "white", border: "none",
                  padding: "7px 16px", borderRadius: 5, cursor: "pointer", marginRight: 8 }}>
                ✅ Simpan
              </button>
              <button onClick={() => setEditId(null)}
                style={{ background: "#aaa", color: "white", border: "none",
                  padding: "7px 16px", borderRadius: 5, cursor: "pointer" }}>
                Batal
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <div>
                <h4 style={{ margin: "0 0 6px" }}>{user.nama}</h4>
                <p style={{ margin: "3px 0", fontSize: 13 }}>📧 {user.email}</p>
                <p style={{ margin: "3px 0", fontSize: 13 }}>📱 {user.hp || "-"}</p>
                <p style={{ margin: "3px 0", fontSize: 13 }}>
                  🏢 {projects.find((p: any) => p.id === user.projectId)?.nama || "-"}
                </p>
                <p style={{ margin: "6px 0 0", fontSize: 13 }}>
                  Status : <strong style={{ color: user.aktif ? "green" : "red" }}>
                    {user.aktif ? "✅ Aktif" : "❌ Nonaktif"}
                  </strong>
                </p>
                {!user.uid && (
                  <p style={{ fontSize: 12, color: "#faad14", margin: "4px 0 0" }}>
                    ⚠️ User lama — belum memiliki UID
                  </p>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 150 }}>
                <button onClick={() => { setEditId(user.id); setEditNama(user.nama); setEditHp(user.hp || ""); setEditProjectId(user.projectId || ""); }}
                  style={{ background: "#1677ff", color: "white", border: "none", padding: "7px 12px", borderRadius: 5, cursor: "pointer" }}>
                  ✏️ Edit
                </button>
                <button onClick={() => toggleStatus(user.id, user.aktif)}
                  style={{ background: user.aktif ? "#ff7875" : "#52c41a", color: "white", border: "none", padding: "7px 12px", borderRadius: 5, cursor: "pointer" }}>
                  {user.aktif ? "🔒 Nonaktifkan" : "✅ Aktifkan"}
                </button>
                <button onClick={() => resetPassword(user.uid, user.nama)}
                  style={{ background: "#faad14", color: "white", border: "none", padding: "7px 12px", borderRadius: 5, cursor: "pointer" }}>
                  🔑 Reset Password
                </button>
                <button onClick={() => hapusSales(user)}
                  style={{ background: "#ff4d4f", color: "white", border: "none", padding: "7px 12px", borderRadius: 5, cursor: "pointer" }}>
                  🗑️ Hapus
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* ✅ adminList dipindah ke LUAR salesList.map */}
      {adminList.length > 0 && (
        <>
          <hr />
          <h3>Daftar Admin ({adminList.length})</h3>
          {adminList.map((user: any) => (
            <div key={user.id} style={{ border: "1px solid #d9d9d9", background: "#fafafa",
              padding: 14, marginBottom: 10, borderRadius: 8 }}>
              <h4 style={{ margin: "0 0 4px" }}>{user.nama}</h4>
              <p style={{ margin: "3px 0", fontSize: 13 }}>📧 {user.email}</p>
              <p style={{ margin: "3px 0", fontSize: 13, color: "#888" }}>Role : Admin</p>
            </div>
          ))}
        </>
      )}
    </div>
  );
}