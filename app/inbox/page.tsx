'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Card, Tag, Button, Typography, Space, Avatar, message,
  Empty, Spin, Statistic, Row, Col, Modal, Tabs, Divider,
} from 'antd';
import {
  ThunderboltOutlined, SwapOutlined, CheckOutlined,
  ClockCircleOutlined, AppstoreOutlined, BankOutlined,
  PhoneOutlined,
} from '@ant-design/icons';
import {
  collection, onSnapshot, doc, runTransaction,
  getDoc, query, where, orderBy, Timestamp,
} from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import dayjs from 'dayjs';

const { Text } = Typography;

interface Lead {
  id: string;
  nama: string;
  hp?: string;
  project?: string;
  sumber?: string;
  status: string;
  distributionType: 'rolling' | 'rebutan';
  distributionStatus: 'pending' | 'taken' | 'databank';
  rollingQueue?: string[];
  currentQueueIndex?: number;
  queueExpiredAt?: any;
  takenBy?: string;
  createdAt?: any;
}

interface CurrentUser {
  uid: string;
  nama: string;
  role: string;
}

const getSisaDetik = (expiredAt: any): number => {
  if (!expiredAt) return 0;
  const exp = expiredAt?.toDate ? expiredAt.toDate() : new Date(expiredAt.seconds * 1000);
  return Math.max(0, Math.floor((exp.getTime() - Date.now()) / 1000));
};

const formatSisa = (detik: number): string => {
  if (detik <= 0) return '00:00';
  const m = Math.floor(detik / 60);
  const s = detik % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

// Sensor nomor HP: 08123456789 → 081****6789
const sensorHP = (hp?: string): string => {
  if (!hp) return '—';
  if (hp.length <= 6) return hp;
  const awal = hp.slice(0, 3);
  const akhir = hp.slice(-3);
  const bintang = '*'.repeat(Math.max(1, hp.length - 6));
  return `${awal}${bintang}${akhir}`;
};

function CountdownTimer({ expiredAt, onExpired }: { expiredAt: any; onExpired: () => void }) {
  const [sisa, setSisa] = useState(getSisaDetik(expiredAt));

  useEffect(() => {
    const interval = setInterval(() => {
      const s = getSisaDetik(expiredAt);
      setSisa(s);
      if (s <= 0) { clearInterval(interval); onExpired(); }
    }, 1000);
    return () => clearInterval(interval);
  }, [expiredAt, onExpired]);

  const persen = Math.min(100, (sisa / 180) * 100);
  const warna = sisa > 60 ? '#10B981' : sisa > 30 ? '#F59E0B' : '#EF4444';

  return (
    <div style={{ textAlign: 'center', minWidth: 72 }}>
      <div style={{ fontSize: 26, fontWeight: 800, color: warna, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
        {formatSisa(sisa)}
      </div>
      <div style={{ height: 4, borderRadius: 2, background: '#E2E8F0', marginTop: 6, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${persen}%`, background: warna, borderRadius: 2, transition: 'width 1s linear' }} />
      </div>
      <Text type="secondary" style={{ fontSize: 10, marginTop: 2, display: 'block' }}>sisa waktu</Text>
    </div>
  );
}

function LeadCard({ lead, currentUser, onAmbil, onExpired }: {
  lead: Lead;
  currentUser: CurrentUser;
  onAmbil: (lead: Lead) => void;
  onExpired: (leadId: string) => void;
}) {
  const isRebutan = lead.distributionType === 'rebutan';
  const giliranSales = lead.distributionType === 'rolling'
    ? lead.rollingQueue?.[lead.currentQueueIndex ?? 0] === currentUser.uid
    : false;
  const bisaAmbil = isRebutan || giliranSales;

  return (
    <Card
      style={{
        marginBottom: 12,
        borderLeft: `4px solid ${isRebutan ? '#10B981' : '#1F4E79'}`,
        boxShadow: bisaAmbil ? '0 4px 16px rgba(0,0,0,0.08)' : 'none',
        opacity: !bisaAmbil ? 0.55 : 1,
      }}
      styles={{ body: { padding: '14px 16px' } }}
    >
      <Row gutter={12} align="middle" wrap={false}>
        <Col flex="auto">
          <Space align="start" size={10}>
            <Avatar size={40} style={{ background: isRebutan ? '#10B981' : '#1F4E79', flexShrink: 0 }}>
              {lead.nama?.[0]?.toUpperCase()}
            </Avatar>
            <div>
              <Space size={6} wrap>
                <Text strong style={{ fontSize: 14 }}>{lead.nama}</Text>
                <Tag color={isRebutan ? 'success' : 'processing'} style={{ fontSize: 10 }}>
                  {isRebutan ? '⚡ Rebutan' : '⇄ Rolling'}
                </Tag>
              </Space>
              <div style={{ marginTop: 2 }}>
                <Space size={10} wrap>
                  {lead.project && (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      <AppstoreOutlined style={{ marginRight: 3 }} />{lead.project}
                    </Text>
                  )}
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    <ClockCircleOutlined style={{ marginRight: 3 }} />
                    {lead.createdAt?.toDate ? dayjs(lead.createdAt.toDate()).format('HH:mm') : '—'}
                  </Text>
                </Space>
              </div>
              {!bisaAmbil && lead.distributionType === 'rolling' && (
                <Tag color="warning" style={{ marginTop: 4, fontSize: 10 }}>Bukan giliran kamu</Tag>
              )}
            </div>
          </Space>
        </Col>

        {lead.distributionType === 'rolling' && giliranSales && lead.queueExpiredAt && (
          <Col style={{ flexShrink: 0 }}>
            <CountdownTimer expiredAt={lead.queueExpiredAt} onExpired={() => onExpired(lead.id)} />
          </Col>
        )}

        <Col style={{ flexShrink: 0 }}>
          {bisaAmbil ? (
            <Button
              type="primary"
              size="middle"
              icon={<CheckOutlined />}
              onClick={() => onAmbil(lead)}
              style={{
                background: isRebutan ? '#10B981' : '#1F4E79',
                borderColor: isRebutan ? '#10B981' : '#1F4E79',
                fontWeight: 700,
                minWidth: 80,
              }}
            >
              Ambil
            </Button>
          ) : (
            <Button size="middle" disabled style={{ minWidth: 80 }}>Tunggu</Button>
          )}
        </Col>
      </Row>
    </Card>
  );
}

function DataBankCard({ lead, currentUser, onAmbil }: {
  lead: Lead;
  currentUser: CurrentUser;
  onAmbil: (lead: Lead) => void;
}) {
  return (
    <Card
      style={{ marginBottom: 12, borderLeft: '4px solid #94A3B8' }}
      styles={{ body: { padding: '14px 16px' } }}
    >
      <Row gutter={12} align="middle" wrap={false}>
        <Col flex="auto">
          <Space align="start" size={10}>
            <Avatar size={40} style={{ background: '#94A3B8', flexShrink: 0 }}>
              {lead.nama?.[0]?.toUpperCase()}
            </Avatar>
            <div>
              <Text strong style={{ fontSize: 14 }}>{lead.nama}</Text>
              <div style={{ marginTop: 3 }}>
                <Space size={10} wrap>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    <PhoneOutlined style={{ marginRight: 3 }} />
                    {sensorHP(lead.hp)}
                  </Text>
                  {lead.project && (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      <AppstoreOutlined style={{ marginRight: 3 }} />{lead.project}
                    </Text>
                  )}
                </Space>
              </div>
            </div>
          </Space>
        </Col>
        <Col style={{ flexShrink: 0 }}>
          <Button
            type="default"
            size="middle"
            icon={<CheckOutlined />}
            onClick={() => onAmbil(lead)}
            style={{ minWidth: 80, borderColor: '#1F4E79', color: '#1F4E79', fontWeight: 600 }}
          >
            Rebut
          </Button>
        </Col>
      </Row>
    </Card>
  );
}

export default function InboxPage() {
  const [leadsAktif, setLeadsAktif]     = useState<Lead[]>([]);
  const [leadsDatabank, setLeadsDatabank] = useState<Lead[]>([]);
  const [currentUser, setCurrentUser]   = useState<CurrentUser | null>(null);
  const [distribConfig, setDistConfig]  = useState<any>(null);
  const [loading, setLoading]           = useState(true);
  const [taking, setTaking]             = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      if (!firebaseUser) return;
      const snap = await getDoc(doc(db, 'users', firebaseUser.uid));
      if (snap.exists()) {
        const data = snap.data();
        setCurrentUser({ uid: firebaseUser.uid, nama: data.nama, role: data.role });
      }
      const distSnap = await getDoc(doc(db, 'distribution_settings', 'config'));
      if (distSnap.exists()) setDistConfig(distSnap.data());
      setLoading(false);

      // Panggil API process-rolling setiap 30 detik
      const cronInterval = setInterval(async () => {
        try { await fetch('/api/process-rolling'); } catch (e) {}
      }, 30000);

      // Panggil sekali langsung saat load
      fetch('/api/process-rolling').catch(() => {});

      return () => clearInterval(cronInterval);
    });
    return () => unsubscribe();
  }, []);

  // Realtime leads pending
  useEffect(() => {
    if (!currentUser) return;
    const q = query(
      collection(db, 'leads'),
      where('distributionStatus', '==', 'pending'),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Lead[];
      const filtered = all.filter(lead => {
        if (lead.distributionType === 'rebutan') return distribConfig?.rebutanGroup?.includes(currentUser.uid);
        if (lead.distributionType === 'rolling') return lead.rollingQueue?.includes(currentUser.uid);
        return false;
      });
      setLeadsAktif(filtered);
    });
    return () => unsub();
  }, [currentUser, distribConfig]);

  // Realtime leads databank
  useEffect(() => {
    if (!currentUser) return;
    const q = query(
      collection(db, 'leads'),
      where('distributionStatus', '==', 'databank'),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setLeadsDatabank(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Lead[]);
    });
    return () => unsub();
  }, [currentUser]);

  const handleAmbil = async (lead: Lead, isDatabank = false) => {
    if (!currentUser || taking) return;

    Modal.confirm({
      title: `${isDatabank ? 'Rebut' : 'Ambil'} leads ${lead.nama}?`,
      content: isDatabank
        ? 'Leads dari Data Bank akan menjadi milik kamu.'
        : 'Leads ini akan menjadi milik kamu dan tidak bisa dibatalkan.',
      okText: isDatabank ? 'Ya, Rebut' : 'Ya, Ambil',
      cancelText: 'Batal',
      okButtonProps: { style: { background: '#1F4E79' } },
      onOk: async () => {
        setTaking(lead.id);
        try {
          const leadRef = doc(db, 'leads', lead.id);
          await runTransaction(db, async (transaction) => {
            // ===== SEMUA BACA (READ) DULU =====
            const leadDoc = await transaction.get(leadRef);
            if (!leadDoc.exists()) throw new Error('Lead tidak ditemukan');
            const data = leadDoc.data();

            const validStatus = isDatabank ? 'databank' : 'pending';
            if (data.distributionStatus !== validStatus) {
              throw new Error('Lead sudah diambil oleh sales lain');
            }

            if (!isDatabank && data.distributionType === 'rolling') {
              const giliranUid = data.rollingQueue?.[data.currentQueueIndex ?? 0];
              if (giliranUid !== currentUser.uid) throw new Error('Bukan giliran kamu');
              const expiredAt = data.queueExpiredAt?.toDate?.() ?? new Date(data.queueExpiredAt?.seconds * 1000);
              if (expiredAt < new Date()) throw new Error('Waktu giliran sudah habis');
            }

            // Baca config SEBELUM ada write apapun
            let configRef: any = null;
            let configData: any = null;
            if (!isDatabank && data.distributionType === 'rolling') {
              configRef = doc(db, 'distribution_settings', 'config');
              const configDoc = await transaction.get(configRef);
              if (configDoc.exists()) {
                configData = configDoc.data();
              }
            }

            // ===== SETELAH ITU BARU SEMUA TULIS (WRITE) =====
            transaction.update(leadRef, {
              distributionStatus: 'taken',
              assignedTo: currentUser.uid,
              takenBy: currentUser.uid,
              takenAt: Timestamp.now(),
            });

            if (configRef && configData) {
              const rollingOrder: string[] = configData.rollingOrder ?? [];
              const idx = rollingOrder.indexOf(currentUser.uid);
              if (idx !== -1) transaction.update(configRef, { lastWinnerIndex: idx });
            }
          });

          message.success(`Leads ${lead.nama} berhasil ${isDatabank ? 'direbut' : 'diambil'}!`);
        } catch (e: any) {
          message.error(e?.message ?? 'Gagal mengambil leads');
        } finally {
          setTaking(null);
        }
      },
    });
  };

  const handleExpired = useCallback((leadId: string) => {
    console.log('Timer expired:', leadId);
  }, []);

  if (loading) {
    return <div className="sh-page" style={{ textAlign: 'center', paddingTop: 80 }}><Spin size="large" /></div>;
  }

  const leadsRebutan = leadsAktif.filter(l => l.distributionType === 'rebutan');
  const leadsRolling = leadsAktif.filter(l => l.distributionType === 'rolling');

  const tabItems = [
    {
      key: 'aktif',
      label: (
        <Space>
          <ThunderboltOutlined />
          Leads Aktif
          {leadsAktif.length > 0 && (
            <Tag color="red" style={{ marginLeft: 2, fontSize: 10 }}>{leadsAktif.length}</Tag>
          )}
        </Space>
      ),
      children: (
        <div>
          {/* Rebutan */}
          {leadsRebutan.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <Space style={{ marginBottom: 10 }}>
                <ThunderboltOutlined style={{ color: '#10B981' }} />
                <Text strong style={{ color: '#10B981' }}>Rebutan ({leadsRebutan.length})</Text>
                <Tag color="success" style={{ fontSize: 10 }}>LIVE</Tag>
              </Space>
              {leadsRebutan.map(lead => (
                <LeadCard key={lead.id} lead={lead} currentUser={currentUser!} onAmbil={handleAmbil} onExpired={handleExpired} />
              ))}
            </div>
          )}

          {/* Divider */}
          {leadsRebutan.length > 0 && leadsRolling.length > 0 && <Divider style={{ margin: '12px 0' }} />}

          {/* Rolling */}
          {leadsRolling.length > 0 && (
            <div>
              <Space style={{ marginBottom: 10 }}>
                <SwapOutlined style={{ color: '#1F4E79' }} />
                <Text strong style={{ color: '#1F4E79' }}>Giliran Rolling ({leadsRolling.length})</Text>
              </Space>
              {leadsRolling.map(lead => (
                <LeadCard key={lead.id} lead={lead} currentUser={currentUser!} onAmbil={handleAmbil} onExpired={handleExpired} />
              ))}
            </div>
          )}

          {leadsAktif.length === 0 && (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <div style={{ textAlign: 'center' }}>
                  <Text type="secondary" style={{ display: 'block', fontSize: 14 }}>Belum ada leads masuk</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>Leads baru akan muncul di sini secara otomatis</Text>
                </div>
              }
            />
          )}
        </div>
      ),
    },
    {
      key: 'databank',
      label: (
        <Space>
          <BankOutlined />
          Data Bank
          {leadsDatabank.length > 0 && (
            <Tag color="default" style={{ marginLeft: 2, fontSize: 10 }}>{leadsDatabank.length}</Tag>
          )}
        </Space>
      ),
      children: (
        <div>
          <div style={{ background: '#FEF9EC', border: '1px solid #FDE68A', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
            <Text style={{ fontSize: 12, color: '#92400E' }}>
              ⚠️ Nomor HP disensor. Siapapun bisa merebut leads di Data Bank kapan saja.
            </Text>
          </div>
          {leadsDatabank.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<Text type="secondary">Data Bank kosong</Text>} />
          ) : (
            leadsDatabank.map(lead => (
              <DataBankCard key={lead.id} lead={lead} currentUser={currentUser!} onAmbil={(l) => handleAmbil(l, true)} />
            ))
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="sh-page">
      <div style={{ marginBottom: 20 }}>
        <div className="sh-page-title">Leads Masuk</div>
        <div className="sh-page-subtitle">Leads yang menunggu untuk diambil</div>
      </div>

      {/* Stats */}
      <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
        <Col xs={8}>
          <Card styles={{ body: { padding: '12px 16px' } }} style={{ borderLeft: '4px solid #10B981' }}>
            <Statistic title={<Text type="secondary" style={{ fontSize: 12 }}>Rebutan</Text>} value={leadsRebutan.length} styles={{ content: { fontWeight: 700, fontSize: 22, color: '#10B981' } }} />
          </Card>
        </Col>
        <Col xs={8}>
          <Card styles={{ body: { padding: '12px 16px' } }} style={{ borderLeft: '4px solid #1F4E79' }}>
            <Statistic title={<Text type="secondary" style={{ fontSize: 12 }}>Rolling</Text>} value={leadsRolling.length} styles={{ content: { fontWeight: 700, fontSize: 22, color: '#1F4E79' } }} />
          </Card>
        </Col>
        <Col xs={8}>
          <Card styles={{ body: { padding: '12px 16px' } }} style={{ borderLeft: '4px solid #94A3B8' }}>
            <Statistic title={<Text type="secondary" style={{ fontSize: 12 }}>Data Bank</Text>} value={leadsDatabank.length} styles={{ content: { fontWeight: 700, fontSize: 22, color: '#94A3B8' } }} />
          </Card>
        </Col>
      </Row>

      <Card styles={{ body: { padding: '0 16px 16px' } }}>
        <Tabs items={tabItems} defaultActiveKey="aktif" />
      </Card>
    </div>
  );
}