'use client';

import { useEffect, useState } from 'react';

type LeadInfo = {
  nama: string;
  project: string;
  hp: string;
  distributionStatus: string;
};

type Params = {
  leadId: string;
  action: string;
  uid: string;
};

export default function LeadRespondPage() {
  const [params, setParams] = useState<Params | null>(null);
  const [lead, setLead] = useState<LeadInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const leadId = urlParams.get('leadId');
    const action = urlParams.get('action');
    const uid = urlParams.get('uid');

    if (!leadId || !action || !uid) {
      setError('Link tidak valid (parameter tidak lengkap)');
      setLoading(false);
      return;
    }

    setParams({ leadId, action, uid });

    fetch(`/api/lead-info?leadId=${leadId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setLead(data);
        }
      })
      .catch(() => setError('Gagal memuat data lead'))
      .finally(() => setLoading(false));
  }, []);

  async function handleConfirm() {
    if (!params) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/process-rolling/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      const json = await res.json();
      setResult(json.message || json.error || 'Berhasil diproses');
    } catch {
      setResult('Terjadi kesalahan, coba lagi');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <CenteredBox>
        <p>Memuat...</p>
      </CenteredBox>
    );
  }

  if (error) {
    return (
      <CenteredBox>
        <p style={{ color: '#dc2626' }}>{error}</p>
      </CenteredBox>
    );
  }

  if (result) {
    return (
      <CenteredBox>
        <p style={{ fontSize: 18, fontWeight: 600 }}>{result}</p>
      </CenteredBox>
    );
  }

  const isAccept = params?.action === 'accept';

  return (
    <CenteredBox>
      <h2 style={{ marginBottom: 8 }}>Konfirmasi Lead</h2>
      <p><strong>Nama:</strong> {lead?.nama}</p>
      <p><strong>Project:</strong> {lead?.project}</p>
      <p><strong>HP:</strong> {lead?.hp}</p>

      {lead?.distributionStatus !== 'pending' ? (
        <p style={{ color: '#dc2626', marginTop: 16 }}>
          Lead ini sudah tidak pending (mungkin sudah diproses sales lain).
        </p>
      ) : (
        <button
          onClick={handleConfirm}
          disabled={submitting}
          style={{
            marginTop: 24,
            padding: '12px 32px',
            borderRadius: 6,
            border: 'none',
            color: '#fff',
            fontWeight: 600,
            fontSize: 16,
            cursor: 'pointer',
            backgroundColor: isAccept ? '#16a34a' : '#dc2626',
          }}
        >
          {submitting ? 'Memproses...' : isAccept ? 'Ya, Terima Lead Ini' : 'Ya, Tolak Lead Ini'}
        </button>
      )}
    </CenteredBox>
  );
}

function CenteredBox({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        fontFamily: 'sans-serif',
        backgroundColor: '#f5f5f5',
      }}
    >
      <div
        style={{
          maxWidth: 400,
          width: '100%',
          background: '#fff',
          borderRadius: 12,
          padding: 32,
          boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
        }}
      >
        {children}
      </div>
    </div>
  );
}