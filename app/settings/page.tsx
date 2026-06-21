'use client';

import React, { useEffect, useState } from 'react';
import {
  Card, Tabs, Form, Input, Button, Upload, Typography,
  Space, message, Row, Col, Skeleton, Tag, Table, Modal,
  Switch, InputNumber, Popconfirm, Select, Transfer, Badge,
  Alert, Divider,
} from 'antd';
import {
  UploadOutlined, SaveOutlined, SettingOutlined,
  PhoneOutlined, InfoCircleOutlined, PlusOutlined,
  EditOutlined, DeleteOutlined, TagsOutlined, UnorderedListOutlined,
  SwapOutlined, TeamOutlined, ArrowUpOutlined, ArrowDownOutlined,
  UsergroupAddOutlined,
} from '@ant-design/icons';
import {
  doc, getDoc, setDoc, collection, getDocs,
  addDoc, updateDoc, deleteDoc, orderBy, query,
} from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import type { ColumnsType } from 'antd/es/table';
import KelolaSalesContent from '@/components/KelolaSalesContent';

const { Text, Title } = Typography;
const { Option } = Select;

interface AppSettings {
  appName: string;
  companyName: string;
  supportPhone: string;
  version: string;
}

interface StatusItem {
  id: string;
  nama: string;
  aktif: boolean;
  urutan: number;
}

interface SourceItem {
  id: string;
  nama: string;
  aktif: boolean;
  urutan: number;
}

interface SalesUser {
  id: string;
  nama: string;
  email: string;
  role: string;
  aktif: boolean;
}

interface DistribusiConfig {
  rollingOrder: string[];
  rollingSkip: string[];
  rebutanGroup: string[];
  lastWinnerIndex: number;
}

const APP_VERSION = '1.0.0';

export default function SettingsPage() {
  const [form]                        = Form.useForm();
  const [statusForm]                  = Form.useForm();
  const [sourceForm]                  = Form.useForm();
  const [loading, setLoad]            = useState(true);
  const [saving, setSaving]           = useState(false);
  const [settings, setSettings]       = useState<AppSettings | null>(null);
  const [authorized, setAuth]         = useState<boolean | null>(null);
  const [statuses, setStatuses]       = useState<StatusItem[]>([]);
  const [sources, setSources]         = useState<SourceItem[]>([]);
  const [salesList, setSalesList]     = useState<SalesUser[]>([]);
  const [statusModal, setStatusModal] = useState(false);
  const [sourceModal, setSourceModal] = useState(false);
  const [editStatus, setEditStatus]   = useState<StatusItem | null>(null);
  const [editSource, setEditSource]   = useState<SourceItem | null>(null);
  const [submitting, setSubmitting]   = useState(false);
  const [savingDist, setSavingDist]   = useState(false);

  // Distribusi state
  const [rollingOrder, setRollingOrder]   = useState<string[]>([]);
  const [rollingSkip, setRollingSkip]     = useState<string[]>([]);
  const [rebutanGroup, setRebutanGroup]   = useState<string[]>([]);
  const [lastWinnerIndex, setLastWinner]  = useState(0);

  const router = useRouter();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      if (!firebaseUser) { router.push('/login'); return; }

      const userSnap = await getDoc(doc(db, 'users', firebaseUser.uid));
      if (!userSnap.exists() || userSnap.data()?.role !== 'admin') {
        setAuth(false);
        router.push('/forbidden');
        return;
      }
      setAuth(true);

      await Promise.all([
        loadSettings(),
        loadStatuses(),
        loadSources(),
        loadSalesUsers(),
        loadDistribusiConfig(),
      ]);
      setLoad(false);
    });
    return () => unsubscribe();
  }, [router]);

  const loadSettings = async () => {
    const s = await getDoc(doc(db, 'config', 'app'));
    if (s.exists()) {
      const data = s.data() as AppSettings;
      setSettings(data);
      form.setFieldsValue(data);
    }
  };

  const loadStatuses = async () => {
    const snap = await getDocs(query(collection(db, 'statuses'), orderBy('urutan')));
    setStatuses(snap.docs.map(d => ({ id: d.id, ...d.data() })) as StatusItem[]);
  };

  const loadSources = async () => {
    const snap = await getDocs(query(collection(db, 'sources'), orderBy('urutan')));
    setSources(snap.docs.map(d => ({ id: d.id, ...d.data() })) as SourceItem[]);
  };

  const loadSalesUsers = async () => {
    const snap = await getDocs(collection(db, 'users'));
    const all = snap.docs.map(d => ({ id: d.id, ...d.data() })) as SalesUser[];
    setSalesList(all.filter(u => (u.role === 'sales' || u.role === 'admin') && u.aktif));
  };

  const loadDistribusiConfig = async () => {
    const snap = await getDoc(doc(db, 'distribution_settings', 'config'));
    if (snap.exists()) {
      const data = snap.data() as DistribusiConfig;
      setRollingOrder(data.rollingOrder?.filter(Boolean) ?? []);
      setRollingSkip(data.rollingSkip?.filter(Boolean) ?? []);
      setRebutanGroup(data.rebutanGroup?.filter(Boolean) ?? []);
      setLastWinner(data.lastWinnerIndex ?? 0);
    }
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      await setDoc(doc(db, 'config', 'app'), {
        ...values,
        version: APP_VERSION,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
      message.success('Pengaturan disimpan');
      setSettings({ ...values, version: APP_VERSION });
    } catch (e: any) {
      if (e?.errorFields) return;
      message.error('Gagal menyimpan');
    } finally {
      setSaving(false);
    }
  };

  // ─── Distribusi ────────────────────────────────────────────────────────────

  const getSalesName = (uid: string) => salesList.find(s => s.id === uid)?.nama ?? uid;

  const addToRolling = (uid: string) => {
    if (rollingOrder.includes(uid)) {
      message.warning('Sales sudah ada di urutan rolling');
      return;
    }
    setRollingOrder(prev => [...prev, uid]);
  };

  const removeFromRolling = (uid: string) => {
    setRollingOrder(prev => prev.filter(id => id !== uid));
    setRollingSkip(prev => prev.filter(id => id !== uid));
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    const newOrder = [...rollingOrder];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    setRollingOrder(newOrder);
  };

  const moveDown = (index: number) => {
    if (index === rollingOrder.length - 1) return;
    const newOrder = [...rollingOrder];
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    setRollingOrder(newOrder);
  };

  const toggleSkip = (uid: string) => {
    setRollingSkip(prev =>
      prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
    );
  };

  const saveDistribusi = async () => {
    try {
      setSavingDist(true);
      await setDoc(doc(db, 'distribution_settings', 'config'), {
        rollingOrder,
        rollingSkip,
        rebutanGroup,
        lastWinnerIndex,
      }, { merge: true });
      message.success('Pengaturan distribusi disimpan');
    } catch (e) {
      message.error('Gagal menyimpan pengaturan distribusi');
    } finally {
      setSavingDist(false);
    }
  };

  // ─── Status CRUD ───────────────────────────────────────────────────────────
  const openAddStatus = () => {
    setEditStatus(null);
    statusForm.resetFields();
    statusForm.setFieldsValue({ aktif: true, urutan: statuses.length + 1 });
    setStatusModal(true);
  };

  const openEditStatus = (s: StatusItem) => {
    setEditStatus(s);
    statusForm.setFieldsValue(s);
    setStatusModal(true);
  };

  const handleSaveStatus = async () => {
    try {
      const values = await statusForm.validateFields();
      setSubmitting(true);
      if (editStatus) {
        await updateDoc(doc(db, 'statuses', editStatus.id), values);
        message.success('Status diperbarui');
      } else {
        await addDoc(collection(db, 'statuses'), values);
        message.success('Status ditambahkan');
      }
      setStatusModal(false);
      loadStatuses();
    } catch (e: any) {
      if (e?.errorFields) return;
      message.error('Gagal menyimpan');
    } finally { setSubmitting(false); }
  };

  const handleDeleteStatus = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'statuses', id));
      message.success('Status dihapus');
      loadStatuses();
    } catch { message.error('Gagal menghapus'); }
  };

  const toggleStatus = async (s: StatusItem) => {
    await updateDoc(doc(db, 'statuses', s.id), { aktif: !s.aktif });
    loadStatuses();
  };

  // ─── Source CRUD ───────────────────────────────────────────────────────────
  const openAddSource = () => {
    setEditSource(null);
    sourceForm.resetFields();
    sourceForm.setFieldsValue({ aktif: true, urutan: sources.length + 1 });
    setSourceModal(true);
  };

  const openEditSource = (s: SourceItem) => {
    setEditSource(s);
    sourceForm.setFieldsValue(s);
    setSourceModal(true);
  };

  const handleSaveSource = async () => {
    try {
      const values = await sourceForm.validateFields();
      setSubmitting(true);
      if (editSource) {
        await updateDoc(doc(db, 'sources', editSource.id), values);
        message.success('Sumber diperbarui');
      } else {
        await addDoc(collection(db, 'sources'), values);
        message.success('Sumber ditambahkan');
      }
      setSourceModal(false);
      loadSources();
    } catch (e: any) {
      if (e?.errorFields) return;
      message.error('Gagal menyimpan');
    } finally { setSubmitting(false); }
  };

  const handleDeleteSource = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'sources', id));
      message.success('Sumber dihapus');
      loadSources();
    } catch { message.error('Gagal menghapus'); }
  };

  const toggleSource = async (s: SourceItem) => {
    await updateDoc(doc(db, 'sources', s.id), { aktif: !s.aktif });
    loadSources();
  };

  // ─── Table columns ─────────────────────────────────────────────────────────
  const statusCols: ColumnsType<StatusItem> = [
    { title: 'Urutan', dataIndex: 'urutan', key: 'urutan', width: 80, render: (n: number) => <Text type="secondary">{n}</Text> },
    { title: 'Nama Status', dataIndex: 'nama', key: 'nama', render: (nama: string) => <Text strong>{nama}</Text> },
    {
      title: 'Aktif', key: 'aktif', width: 80,
      render: (_: any, r: StatusItem) => (
        <Switch checked={r.aktif} onChange={() => toggleStatus(r)} size="small" style={{ background: r.aktif ? '#10B981' : undefined }} />
      ),
    },
    {
      title: '', key: 'actions', width: 80,
      render: (_: any, r: StatusItem) => (
        <Space size={4}>
          <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openEditStatus(r)} />
          <Popconfirm title="Hapus status ini?" onConfirm={() => handleDeleteStatus(r.id)} okText="Hapus" cancelText="Batal" okButtonProps={{ danger: true }}>
            <Button type="text" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const sourceCols: ColumnsType<SourceItem> = [
    { title: 'Urutan', dataIndex: 'urutan', key: 'urutan', width: 80, render: (n: number) => <Text type="secondary">{n}</Text> },
    { title: 'Nama Sumber', dataIndex: 'nama', key: 'nama', render: (nama: string) => <Text strong>{nama}</Text> },
    {
      title: 'Aktif', key: 'aktif', width: 80,
      render: (_: any, r: SourceItem) => (
        <Switch checked={r.aktif} onChange={() => toggleSource(r)} size="small" style={{ background: r.aktif ? '#10B981' : undefined }} />
      ),
    },
    {
      title: '', key: 'actions', width: 80,
      render: (_: any, r: SourceItem) => (
        <Space size={4}>
          <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openEditSource(r)} />
          <Popconfirm title="Hapus sumber ini?" onConfirm={() => handleDeleteSource(r.id)} okText="Hapus" cancelText="Batal" okButtonProps={{ danger: true }}>
            <Button type="text" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const salesNotInRolling = salesList.filter(s => !rollingOrder.includes(s.id));

  if (authorized === false) return null;

  const tabItems = [
    {
      key: 'sales',
      label: <Space><UsergroupAddOutlined />Kelola Sales</Space>,
      children: <KelolaSalesContent />,
    },
    {
      key: 'general',
      label: <Space><SettingOutlined />Umum</Space>,
      children: (
        <div style={{ maxWidth: 520 }}>
          {loading ? <Skeleton active paragraph={{ rows: 4 }} /> : (
            <Form form={form} layout="vertical" requiredMark="optional">
              <Form.Item name="appName" label="Nama Aplikasi" rules={[{ required: true }]}>
                <Input placeholder="SalesHub" size="large" />
              </Form.Item>
              <Form.Item name="companyName" label="Nama Perusahaan" rules={[{ required: true }]}>
                <Input placeholder="PT. Developer Properti" size="large" />
              </Form.Item>
              <Form.Item name="supportPhone" label="Nomor Support / Admin">
                <Input prefix={<PhoneOutlined />} placeholder="08xxxxxxxxxx" size="large" />
              </Form.Item>
              <Form.Item style={{ marginTop: 24 }}>
                <Button type="primary" icon={<SaveOutlined />} size="large" loading={saving} onClick={handleSave} style={{ background: '#1F4E79', borderColor: '#1F4E79' }}>
                  Simpan Pengaturan
                </Button>
              </Form.Item>
            </Form>
          )}
        </div>
      ),
    },
    {
      key: 'distribusi',
      label: <Space><SwapOutlined />Distribusi Leads</Space>,
      children: (
        <div>
          {loading ? <Skeleton active paragraph={{ rows: 6 }} /> : (
            <>
              {/* ── SISTEM 1: ROLLING ── */}
              <Card
                style={{ marginBottom: 24, borderLeft: '4px solid #1F4E79' }}
                title={
                  <Space>
                    <SwapOutlined style={{ color: '#1F4E79' }} />
                    <Text strong style={{ fontSize: 15 }}>Sistem 1 — Rolling (Urutan Giliran)</Text>
                  </Space>
                }
              >
                <Alert
                  type="info"
                  showIcon
                  title="Info"
                  description="Leads akan diberikan ke sales sesuai urutan di bawah. Sales yang di-skip (cuti/sakit) akan dilewati sementara."
                  style={{ marginBottom: 16 }}
                />

                <div style={{ marginBottom: 16 }}>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
                    Tap nama sales untuk menambah ke urutan rolling:
                  </Text>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {salesList.map(s => {
                      const sudahMasuk = rollingOrder.includes(s.id);
                      return (
                        <div
                          key={s.id}
                          onClick={() => !sudahMasuk && addToRolling(s.id)}
                          style={{
                            padding: '6px 14px',
                            borderRadius: 20,
                            border: `1px solid ${sudahMasuk ? '#10B981' : '#CBD5E1'}`,
                            background: sudahMasuk ? '#D1FAE5' : '#F8FAFC',
                            color: sudahMasuk ? '#065F46' : '#475569',
                            cursor: sudahMasuk ? 'default' : 'pointer',
                            fontWeight: sudahMasuk ? 600 : 400,
                            fontSize: 13,
                            userSelect: 'none' as const,
                            transition: 'all 0.2s',
                          }}
                        >
                          {sudahMasuk ? '✓ ' : '+ '}{s.nama}
                        </div>
                      );
                    })}
                    {salesList.length === 0 && (
                      <Text type="secondary" style={{ fontSize: 13 }}>Tidak ada sales aktif</Text>
                    )}
                  </div>
                </div>

                {rollingOrder.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px 0', color: '#94A3B8' }}>
                    Belum ada sales dalam urutan rolling. Tambah sales di atas.
                  </div>
                ) : (
                  <div>
                    {rollingOrder.map((uid, index) => {
                      const isSkip = rollingSkip.includes(uid);
                      const nama = getSalesName(uid);
                      return (
                        <div
                          key={uid}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            padding: '10px 14px',
                            marginBottom: 8,
                            borderRadius: 8,
                            border: `1px solid ${isSkip ? '#FCA5A5' : '#E2E8F0'}`,
                            background: isSkip ? '#FEF2F2' : '#F8FAFC',
                            opacity: isSkip ? 0.7 : 1,
                          }}
                        >
                          <div style={{
                            width: 28, height: 28, borderRadius: '50%',
                            background: isSkip ? '#FCA5A5' : '#1F4E79',
                            color: '#fff', display: 'flex', alignItems: 'center',
                            justifyContent: 'center', fontWeight: 700, fontSize: 13,
                            marginRight: 12, flexShrink: 0,
                          }}>
                            {index + 1}
                          </div>

                          <div style={{ flex: 1 }}>
                            <Text strong style={{ color: isSkip ? '#EF4444' : '#1E293B' }}>{nama}</Text>
                            {isSkip && <Tag color="error" style={{ marginLeft: 8 }}>Di-skip</Tag>}
                            {index === lastWinnerIndex % rollingOrder.length && !isSkip && (
                              <Tag color="processing" style={{ marginLeft: 8 }}>Giliran berikutnya</Tag>
                            )}
                          </div>

                          <Space size={4}>
                            <Button
                              type="text" size="small" icon={<ArrowUpOutlined />}
                              onClick={() => moveUp(index)}
                              disabled={index === 0}
                              title="Naikan urutan"
                            />
                            <Button
                              type="text" size="small" icon={<ArrowDownOutlined />}
                              onClick={() => moveDown(index)}
                              disabled={index === rollingOrder.length - 1}
                              title="Turunkan urutan"
                            />
                            <Switch
                              checked={!isSkip}
                              onChange={() => toggleSkip(uid)}
                              checkedChildren="Aktif"
                              unCheckedChildren="Skip"
                              size="small"
                              style={{ background: isSkip ? '#EF4444' : '#10B981' }}
                            />
                            <Popconfirm
                              title={`Hapus ${nama} dari urutan rolling?`}
                              onConfirm={() => removeFromRolling(uid)}
                              okText="Hapus" cancelText="Batal"
                              okButtonProps={{ danger: true }}
                            >
                              <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                            </Popconfirm>
                          </Space>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>

              {/* ── SISTEM 2: REBUTAN ── */}
              <Card
                style={{ marginBottom: 24, borderLeft: '4px solid #10B981' }}
                title={
                  <Space>
                    <TeamOutlined style={{ color: '#10B981' }} />
                    <Text strong style={{ fontSize: 15 }}>Sistem 2 — Rebutan (Siapa Cepat Dia Dapat)</Text>
                  </Space>
                }
              >
                <Alert
                  type="success"
                  showIcon
                  title="Info"
                  description="Leads akan muncul di dashboard semua sales dalam grup ini secara bersamaan. Siapa yang pertama klik Ambil, leads jadi miliknya."
                  style={{ marginBottom: 16 }}
                />

                <div>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
                    Tap nama sales untuk memilih/membatalkan pilihan:
                  </Text>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {salesList.map(s => {
                      const dipilih = rebutanGroup.includes(s.id);
                      return (
                        <div
                          key={s.id}
                          onClick={() =>
                            setRebutanGroup(prev =>
                              dipilih ? prev.filter(id => id !== s.id) : [...prev, s.id]
                            )
                          }
                          style={{
                            padding: '6px 14px',
                            borderRadius: 20,
                            border: `1px solid ${dipilih ? '#10B981' : '#CBD5E1'}`,
                            background: dipilih ? '#D1FAE5' : '#F8FAFC',
                            color: dipilih ? '#065F46' : '#475569',
                            cursor: 'pointer',
                            fontWeight: dipilih ? 600 : 400,
                            fontSize: 13,
                            userSelect: 'none' as const,
                            transition: 'all 0.2s',
                          }}
                        >
                          {dipilih ? '✓ ' : '+ '}{s.nama}
                        </div>
                      );
                    })}
                    {salesList.length === 0 && (
                      <Text type="secondary" style={{ fontSize: 13 }}>Tidak ada sales aktif</Text>
                    )}
                  </div>
                </div>
              </Card>

              <Button
                type="primary"
                icon={<SaveOutlined />}
                size="large"
                loading={savingDist}
                onClick={saveDistribusi}
                style={{ background: '#1F4E79', borderColor: '#1F4E79' }}
              >
                Simpan Pengaturan Distribusi
              </Button>
            </>
          )}
        </div>
      ),
    },
    {
      key: 'statuses',
      label: <Space><TagsOutlined />Status Leads</Space>,
      children: (
        <div>
          <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
            <Col><Text type="secondary">Kelola status yang tersedia untuk leads</Text></Col>
            <Col>
              <Button type="primary" icon={<PlusOutlined />} onClick={openAddStatus} style={{ background: '#1F4E79' }}>
                Tambah Status
              </Button>
            </Col>
          </Row>
          <Table columns={statusCols} dataSource={statuses} rowKey="id" pagination={false} size="small" loading={loading} />
        </div>
      ),
    },
    {
      key: 'sources',
      label: <Space><UnorderedListOutlined />Sumber Leads</Space>,
      children: (
        <div>
          <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
            <Col><Text type="secondary">Kelola sumber leads yang tersedia</Text></Col>
            <Col>
              <Button type="primary" icon={<PlusOutlined />} onClick={openAddSource} style={{ background: '#1F4E79' }}>
                Tambah Sumber
              </Button>
            </Col>
          </Row>
          <Table columns={sourceCols} dataSource={sources} rowKey="id" pagination={false} size="small" loading={loading} />
        </div>
      ),
    },
    {
      key: 'logo',
      label: <Space><UploadOutlined />Logo</Space>,
      children: (
        <div style={{ maxWidth: 400 }}>
          <div style={{ width: 120, height: 120, borderRadius: 12, background: '#1F4E79', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <Text style={{ color: '#C9A66B', fontWeight: 800, fontSize: 36 }}>S</Text>
          </div>
          <Text type="secondary" style={{ display: 'block', marginBottom: 16, fontSize: 13 }}>
            Upload logo perusahaan (PNG/JPG, maks. 2MB)
          </Text>
          <Upload accept="image/*" maxCount={1} beforeUpload={() => false} listType="picture">
            <Button icon={<UploadOutlined />} size="large">Pilih Logo</Button>
          </Upload>
        </div>
      ),
    },
    {
      key: 'about',
      label: <Space><InfoCircleOutlined />Tentang</Space>,
      children: (
        <div style={{ maxWidth: 400 }}>
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            {[
              { label: 'Nama Aplikasi', value: settings?.appName ?? 'SalesHub' },
              { label: 'Perusahaan',    value: settings?.companyName ?? '—' },
              { label: 'Versi',         value: <Tag color="processing">{APP_VERSION}</Tag> },
              { label: 'Platform',      value: 'Next.js + Firebase' },
              { label: 'Support Phone', value: settings?.supportPhone ?? '—' },
            ].map(item => (
              <Row key={item.label} style={{ padding: '12px 16px', background: '#F8FAFC', borderRadius: 8, border: '1px solid #E2E8F0' }}>
                <Col span={10}><Text type="secondary" style={{ fontSize: 13 }}>{item.label}</Text></Col>
                <Col span={14}>
                  {typeof item.value === 'string' ? <Text style={{ fontWeight: 500 }}>{item.value}</Text> : item.value}
                </Col>
              </Row>
            ))}
          </Space>
        </div>
      ),
    },
  ];

  return (
    <div className="sh-page">
      <div className="sh-page-title">Settings</div>
      <div className="sh-page-subtitle">Konfigurasi aplikasi SalesHub</div>
      <Card>
        <Tabs items={tabItems} style={{ minHeight: 320 }} />
      </Card>

      {/* Status Modal */}
      <Modal
        title={<Space><TagsOutlined style={{ color: '#1F4E79' }} />{editStatus ? 'Edit Status' : 'Tambah Status'}</Space>}
        open={statusModal} onOk={handleSaveStatus} onCancel={() => setStatusModal(false)}
        confirmLoading={submitting} okText={editStatus ? 'Simpan' : 'Tambah'} cancelText="Batal"
        okButtonProps={{ style: { background: '#1F4E79', borderColor: '#1F4E79' } }}
      >
        <Form form={statusForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="nama" label="Nama Status" rules={[{ required: true, message: 'Nama wajib diisi' }]}>
            <Input placeholder="contoh: Follow Up" size="large" />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="urutan" label="Urutan" rules={[{ required: true }]}>
                <InputNumber min={1} style={{ width: '100%' }} size="large" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="aktif" label="Aktif" valuePropName="checked">
                <Switch checkedChildren="Aktif" unCheckedChildren="Nonaktif" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* Source Modal */}
      <Modal
        title={<Space><UnorderedListOutlined style={{ color: '#1F4E79' }} />{editSource ? 'Edit Sumber' : 'Tambah Sumber'}</Space>}
        open={sourceModal} onOk={handleSaveSource} onCancel={() => setSourceModal(false)}
        confirmLoading={submitting} okText={editSource ? 'Simpan' : 'Tambah'} cancelText="Batal"
        okButtonProps={{ style: { background: '#1F4E79', borderColor: '#1F4E79' } }}
      >
        <Form form={sourceForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="nama" label="Nama Sumber" rules={[{ required: true, message: 'Nama wajib diisi' }]}>
            <Input placeholder="contoh: Instagram Ads" size="large" />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="urutan" label="Urutan" rules={[{ required: true }]}>
                <InputNumber min={1} style={{ width: '100%' }} size="large" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="aktif" label="Aktif" valuePropName="checked">
                <Switch checkedChildren="Aktif" unCheckedChildren="Nonaktif" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
}