"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";

export default function DevelopersPage() {
  const [developers, setDevelopers] =
    useState<any[]>([]);

  const [nama, setNama] =
    useState("");

  const [kode, setKode] =
    useState("");
  const [editId, setEditId] =
    useState("");

  const [editNama, setEditNama] =
    useState("");

  const [editKode, setEditKode] =
    useState("");

  const loadDevelopers =
    async () => {
      const snapshot =
        await getDocs(
          collection(
            db,
            "developers"
          )
        );

      setDevelopers(
        snapshot.docs.map(
          (d) => ({
            id: d.id,
            ...d.data(),
          })
        )
      );
    };

  useEffect(() => {
    loadDevelopers();
  }, []);

  const tambahDeveloper =
    async () => {
      if (!nama) {
        alert(
          "Nama developer wajib diisi"
        );
        return;
      }

      await addDoc(
        collection(
          db,
          "developers"
        ),
        {
          nama,
          kode,
          aktif: true,
          createdAt:
            serverTimestamp(),
        }
      );

      setNama("");
      setKode("");

      loadDevelopers();
    };

  const toggleStatus =
    async (
      id: string,
      aktif: boolean
    ) => {
      await updateDoc(
        doc(
          db,
          "developers",
          id
        ),
        {
          aktif: !aktif,
        }
      );

      loadDevelopers();
    };

  return (
    <div
      style={{
        padding: 30,
      }}
    >
      <h1>Developers</h1>

      <hr />

      <div
        style={{
          marginBottom: 20,
          padding: 15,
          border:
            "1px solid #d9d9d9",
          borderRadius: 8,
        }}
      >
        <h3>
          Tambah Developer
        </h3>

        <input
          placeholder="Nama Developer"
          value={nama}
          onChange={(e) =>
            setNama(
              e.target.value
            )
          }
          style={{
            width: "100%",
            padding: 8,
            marginBottom: 10,
          }}
        />

        <input
          placeholder="Kode Developer"
          value={kode}
          onChange={(e) =>
            setKode(
              e.target.value
            )
          }
          style={{
            width: "100%",
            padding: 8,
            marginBottom: 10,
          }}
        />

        <button
          onClick={
            tambahDeveloper
          }
        >
          Simpan Developer
        </button>
      </div>

      {developers.map(
        (dev: any) => (
          <div
            key={dev.id}
            style={{
              border:
                dev.aktif
                  ? "1px solid #d9d9d9"
                  : "1px solid #ff4d4f",
              background:
                dev.aktif
                  ? "#fff"
                  : "#fff2f0",
              borderRadius: 8,
              padding: 15,
              marginBottom: 10,
            }}
          >
            <h3>
              {dev.nama}
            </h3>

            <p>
              Kode:
              {" "}
              {dev.kode ||
                "-"}
            </p>

            <p>
              Status:
              {" "}
              {dev.aktif
                ? "✅ Aktif"
                : "❌ Nonaktif"}
            </p>

            <p>
              ID:
              {" "}
              {dev.id}
            </p>

            <button
              onClick={() =>
                toggleStatus(
                  dev.id,
                  dev.aktif
                )
              }
            >
              {dev.aktif
                ? "Nonaktifkan"
                : "Aktifkan"}
            </button>
          </div>
        )
      )}
    </div>
  );
}