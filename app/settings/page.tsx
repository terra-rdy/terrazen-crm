'use client';

import React, { useEffect, useState } from 'react';
import {
  Card, Tabs, Form, Input, Button, Upload, Typography,
  Space, message, Row, Col, Skeleton, Tag, Table, Modal,
  Switch, InputNumber, Popconfirm,
} from 'antd';
import {
  UploadOutlined, SaveOutlined, SettingOutlined,
  PhoneOutlined, InfoCircleOutlined, PlusOutlined,
  EditOutlined, DeleteOutlined, TagsOutlined, UnorderedListOutlined,
} from '@ant-design/icons';
import {
  doc, getDoc, setDoc, collection, getDocs,
  addDoc, updateDoc, deleteDoc, orderBy, query,
} from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import type { ColumnsType } from 'antd/es/table';

const { Text } = Typography;

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

const APP_VERSION = '1.0.0';

export default function SettingsPage() {
  const [form]                      = Form.useForm();
  const [statusForm]                = Form.useForm();
  const [sourceForm]                = Form.useForm();
  const [loading, setLoad]          = useState(true);
  const [saving, setSaving]         = useState(false);
  const [settings, setSettings]     = useState<AppSettings | null>(null);
  const [authorized, setAuth]       = useState<boolean | null>(null);
  const [statuses, setStatuses]     = useState<StatusItem[]>([]);
  const [sources, setSources]       = useState<SourceItem[]>([]);
  const [statusModal, setStatusModal] = useState(false);
  const [sourceModal, setSourceModal] = useState(false);
  const [editStatus, setEditStatus] = useState<StatusItem | null>(null);
  const [editSource, setEditSource] = useState<SourceItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const router                      = useRouter();

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

      // Load semua data
      await Promise.all([
        loadSettings(),
        loadStatuses(),
        loadSources(),
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

  // ─── Status CRUD ──────────────────────────────────────────────────────────
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

  // ─── Source CRUD ──────────────────────────────────────────────────────────
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

  // ─── Table columns ────────────────────────────────────────────────────────
  const statusCols: ColumnsType<StatusItem> = [
    {
      title: 'Urutan',
      dataIndex: 'urutan',
      key: 'urutan',
      width: 80,
      render: (n: number) => <Text type="secondary">{n}</Text>,
    },
    {
      title: 'Nama Status',
      dataIndex: 'nama',
      key: 'nama',
      render: (nama: string) => <Text strong>{nama}</Text>,
    },
    {
      title: 'Aktif',
      key: 'aktif',
      width: 80,
      render: (_: any, r: StatusItem) => (
        <Switch
          checked={r.aktif}
          onChange={() => toggleStatus(r)}
          size="small"
          style={{ background: r.aktif ? '#10B981' : undefined }}
        />
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 80,
      render: (_: any, r: StatusItem) => (
        <Space size={4}>
          <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openEditStatus(r)} />
          <Popconfirm
            title="Hapus status ini?"
            onConfirm={() => handleDeleteStatus(r.id)}
            okText="Hapus" cancelText="Batal"
            okButtonProps={{ danger: true }}
          >
            <Button type="text" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const sourceCols: ColumnsType<SourceItem> = [
    {
      title: 'Urutan',
      dataIndex: 'urutan',
      key: 'urutan',
      width: 80,
      render: (n: number) => <Text type="secondary">{n}</Text>,
    },
    {
      title: 'Nama Sumber',
      dataIndex: 'nama',
      key: 'nama',
      render: (nama: string) => <Text strong>{nama}</Text>,
    },
    {
      title: 'Aktif',
      key: 'aktif',
      width: 80,
      render: (_: any, r: SourceItem) => (
        <Switch
          checked={r.aktif}
          onChange={() => toggleSource(r)}
          size="small"
          style={{ background: r.aktif ? '#10B981' : undefined }}
        />
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 80,
      render: (_: any, r: SourceItem) => (
        <Space size={4}>
          <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openEditSource(r)} />
          <Popconfirm
            title="Hapus sumber ini?"
            onConfirm={() => handleDeleteSource(r.id)}
            okText="Hapus" cancelText="Batal"
            okButtonProps={{ danger: true }}
          >
            <Button type="text" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  if (authorized === false) return null;

  const tabItems = [
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
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  size="large"
                  loading={saving}
                  onClick={handleSave}
                  style={{ background: '#1F4E79', borderColor: '#1F4E79' }}
                >
                  Simpan Pengaturan
                </Button>
              </Form.Item>
            </Form>
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
            <Col>
              <Text type="secondary">Kelola status yang tersedia untuk leads</Text>
            </Col>
            <Col>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={openAddStatus}
                style={{ background: '#1F4E79' }}
              >
                Tambah Status
              </Button>
            </Col>
          </Row>
          <Table
            columns={statusCols}
            dataSource={statuses}
            rowKey="id"
            pagination={false}
            size="small"
            loading={loading}
          />
        </div>
      ),
    },
    {
      key: 'sources',
      label: <Space><UnorderedListOutlined />Sumber Leads</Space>,
      children: (
        <div>
          <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
            <Col>
              <Text type="secondary">Kelola sumber leads yang tersedia</Text>
            </Col>
            <Col>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={openAddSource}
                style={{ background: '#1F4E79' }}
              >
                Tambah Sumber
              </Button>
            </Col>
          </Row>
          <Table
            columns={sourceCols}
            dataSource={sources}
            rowKey="id"
            pagination={false}
            size="small"
            loading={loading}
          />
        </div>
      ),
    },
    {
      key: 'logo',
      label: <Space><UploadOutlined />Logo</Space>,
      children: (
        <div style={{ maxWidth: 400 }}>
          <div style={{
            width: 120, height: 120, borderRadius: 12,
            background: '#1F4E79',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 16,
          }}>
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
              <Row key={item.label} style={{
                padding: '12px 16px', background: '#F8FAFC',
                borderRadius: 8, border: '1px solid #E2E8F0',
              }}>
                <Col span={10}>
                  <Text type="secondary" style={{ fontSize: 13 }}>{item.label}</Text>
                </Col>
                <Col span={14}>
                  {typeof item.value === 'string'
                    ? <Text style={{ fontWeight: 500 }}>{item.value}</Text>
                    : item.value}
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
        title={
          <Space>
            <TagsOutlined style={{ color: '#1F4E79' }} />
            {editStatus ? 'Edit Status' : 'Tambah Status'}
          </Space>
        }
        open={statusModal}
        onOk={handleSaveStatus}
        onCancel={() => setStatusModal(false)}
        confirmLoading={submitting}
        okText={editStatus ? 'Simpan' : 'Tambah'}
        cancelText="Batal"
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
        title={
          <Space>
            <UnorderedListOutlined style={{ color: '#1F4E79' }} />
            {editSource ? 'Edit Sumber' : 'Tambah Sumber'}
          </Space>
        }
        open={sourceModal}
        onOk={handleSaveSource}
        onCancel={() => setSourceModal(false)}
        confirmLoading={submitting}
        okText={editSource ? 'Simpan' : 'Tambah'}
        cancelText="Batal"
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