export const metadata = {
  title: "Kebijakan Privasi — SalesHub",
  description:
    "Kebijakan privasi Terrazen Property mengenai pengumpulan dan penggunaan data calon pelanggan melalui formulir SalesHub.",
};

export default function PrivacyPolicyPage() {
  const lastUpdated = "30 Juni 2026";

  return (
    <main
      style={{
        maxWidth: 760,
        margin: "0 auto",
        padding: "48px 24px 96px",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        color: "#1f2933",
        lineHeight: 1.7,
      }}
    >
      <header style={{ marginBottom: 40, borderBottom: "1px solid #e4e7eb", paddingBottom: 24 }}>
        <h1 style={{ fontSize: 30, fontWeight: 700, margin: "0 0 8px" }}>
          Kebijakan Privasi
        </h1>
        <p style={{ margin: 0, color: "#616e7c", fontSize: 15 }}>
          Terrazen Property &middot; Terakhir diperbarui {lastUpdated}
        </p>
      </header>

      <section style={{ marginBottom: 28 }}>
        <p style={{ margin: 0 }}>
          Kebijakan privasi ini menjelaskan bagaimana Terrazen Property
          (&ldquo;kami&rdquo;) mengumpulkan, menggunakan, dan melindungi data
          pribadi yang Anda berikan ketika mengisi formulir minat atau formulir
          prospek kami, termasuk formulir iklan yang ditayangkan melalui platform
          Meta (Facebook dan Instagram).
        </p>
      </section>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, margin: "0 0 10px" }}>
          1. Data yang Kami Kumpulkan
        </h2>
        <p style={{ margin: "0 0 10px" }}>
          Saat Anda mengisi formulir kami, kami mengumpulkan data berikut:
        </p>
        <ul style={{ margin: 0, paddingLeft: 22 }}>
          <li>Nama lengkap</li>
          <li>Nomor telepon</li>
        </ul>
      </section>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, margin: "0 0 10px" }}>
          2. Tujuan Penggunaan Data
        </h2>
        <p style={{ margin: "0 0 10px" }}>
          Data yang Anda berikan kami gunakan untuk:
        </p>
        <ul style={{ margin: 0, paddingLeft: 22 }}>
          <li>
            Menghubungi Anda terkait informasi properti, konsultasi pilihan unit,
            cara pembayaran, simulasi cicilan, dan proses KPR.
          </li>
          <li>
            Menindaklanjuti minat Anda dan memberikan layanan yang Anda minta.
          </li>
          <li>
            Keperluan administrasi internal tim pemasaran kami.
          </li>
        </ul>
      </section>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, margin: "0 0 10px" }}>
          3. Penyimpanan dan Keamanan Data
        </h2>
        <p style={{ margin: 0 }}>
          Data Anda disimpan secara aman pada sistem manajemen prospek internal
          kami dan hanya dapat diakses oleh tim pemasaran yang berwenang. Kami
          mengambil langkah-langkah yang wajar untuk melindungi data Anda dari
          akses, pengungkapan, atau penyalahgunaan yang tidak sah.
        </p>
      </section>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, margin: "0 0 10px" }}>
          4. Pembagian Data kepada Pihak Ketiga
        </h2>
        <p style={{ margin: 0 }}>
          Kami tidak menjual atau menyewakan data pribadi Anda kepada pihak
          ketiga. Data Anda tidak dibagikan kepada pihak lain kecuali diwajibkan
          oleh hukum yang berlaku.
        </p>
      </section>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, margin: "0 0 10px" }}>
          5. Hak Anda
        </h2>
        <p style={{ margin: 0 }}>
          Anda berhak meminta akses, perbaikan, atau penghapusan data pribadi
          yang telah Anda berikan kepada kami. Untuk mengajukan permintaan
          tersebut, silakan hubungi kami melalui kontak di bawah ini.
        </p>
      </section>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, margin: "0 0 10px" }}>
          6. Hubungi Kami
        </h2>
        <p style={{ margin: 0 }}>
          Jika Anda memiliki pertanyaan mengenai kebijakan privasi ini atau ingin
          mengelola data pribadi Anda, silakan hubungi kami di:
        </p>
        <p style={{ margin: "10px 0 0", fontWeight: 600 }}>
          duta.ardy@gmail.com
        </p>
      </section>

      <footer
        style={{
          marginTop: 48,
          paddingTop: 24,
          borderTop: "1px solid #e4e7eb",
          color: "#9aa5b1",
          fontSize: 13,
        }}
      >
        &copy; {new Date().getFullYear()} Terrazen Property. Seluruh hak cipta
        dilindungi.
      </footer>
    </main>
  );
}