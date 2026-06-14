"use client";

import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  addDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function StatusPage() {
  const [statuses, setStatuses] =
    useState<any[]>([]);

  const [nama, setNama] =
    useState("");

  const loadStatus = async () => {
    const snapshot =
      await getDocs(
        collection(
          db,
          "statuses"
        )
      );

    const data =
      snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

    data.sort(
      (a: any, b: any) =>
        a.urutan - b.urutan
    );

    setStatuses(data);
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const tambahStatus =
    async () => {
      if (!nama) return;

      await addDoc(
        collection(
          db,
          "statuses"
        ),
        {
          nama,
          urutan:
            statuses.length + 1,
          aktif: true,
        }
      );

      setNama("");
      loadStatus();
    };

  return (
    <div style={{ padding: 30 }}>
      <h1>
        Master Status
      </h1>

      <hr />

      <input
        placeholder="Nama Status"
        value={nama}
        onChange={(e) =>
          setNama(
            e.target.value
          )
        }
      />

      <button
        onClick={
          tambahStatus
        }
        style={{
          marginLeft: 10,
        }}
      >
        Tambah
      </button>

      <hr />

      {statuses.map(
        (status: any) => (
          <div
            key={status.id}
            style={{
              border:
                "1px solid #ddd",
              padding: 10,
              marginBottom: 10,
              borderRadius: 8,
            }}
          >
            <strong>
              {status.nama}
            </strong>

            <p>
              Urutan :
              {" "}
              {status.urutan}
            </p>

            <p>
              Aktif :
              {" "}
              {status.aktif
                ? "Ya"
                : "Tidak"}
            </p>
          </div>
        )
      )}
    </div>
  );
}