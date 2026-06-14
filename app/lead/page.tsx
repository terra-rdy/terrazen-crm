'use client';

import React, { useEffect, useState } from 'react';
import {
  Card, Form, Input, Select, Button, Row, Col,
  Space, message, Result, Tag,
} from 'antd';
import {
  UserOutlined, PhoneOutlined,
  SendOutlined, ArrowLeftOutlined, CheckCircleOutlined,
} from '@ant-design/icons';
import { collection, addDoc, getDocs, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';

const { Option } = Select;

const STATUS_COLORS = ['blue', 'orange', 'purple', 'success', 'error', 'cyan', 'gold', 'volcano'];

const normalizeHP = (hp: string): string => {
  const cleaned = hp.replace(/[\s\-]/g, '');
  if (cleaned.startsWith('+62')) return '0' + cleaned.slice(3);
  if (cleaned.startsWith('62')) return '0' + cleaned.slice(2);
  return cleaned;
};

const validateHP = (hp: string): string | null => {
  const normalized = normalizeHP(hp);
  if (!normalized.startsWith('08')) return 'Nomor HP harus diawali dengan 08 (contoh: 08123456789)';
  if (normalized.length < 10 || normalized.length > 13) return 'Nomor HP tidak valid (10-13 digit)';
  return null;
};

interface Project { id: string; nama: string; kode: string; aktif: boolean; }
interface StatusItem { id: string; nama: string; aktif: boolean; urutan: number; }
interface SourceItem { id: string; nama: string; aktif: boolean; urutan: number; }

export default function AddLeadPage() {
  const [form]                      = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess]       = useState(false);
  const [projects, setProjects]     = useState<Project[]>([]);
  const [statuses, setStatuses]     = useState<StatusItem[]>([]);
  const [sources, setSources]       = useState<SourceItem[]>([]);
  const router                      = useRouter();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      if (!firebaseUser) return;

      const usersSnap = await getDocs(collection(db, 'users'));
      const users = usersSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
      const me = users.find(u => u.id === firebaseUser.uid);

      const projectSnap = await getDocs(collection(db, 'projects'));
      const allProjects = projectSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Project[];
      if (me?.role === 'admin') {
        setProjects(allProjects.filter(p => p.aktif));
      } else {
        const myProjectIds: string[] = me?.projectIds ?? [];
        setProjects(allProjects.filter(p => p.aktif && myProjectIds.includes(p.id)));
      }

      // Statuses dari Firestore
      const statusSnap = await getDocs(query(collection(db, 'statuses'), orderBy('urutan')));
      setStatuses(statusSnap.docs.map(d => ({ id: d.id, ...d.data() })) as StatusItem[]);

      // Sources dari Firestore
      const sourceSnap = await getDocs(query(collection(db, 'sources'), orderBy('urutan')));
      setSources(sourceSnap.docs.map(d => ({ id: d.id, ...d.data() })) as SourceItem[]);
    });
    return () => unsubscribe();
  }, []);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const hpError = validateHP(values.hp);
      if (hpError) { message.error(hpError); return; }
      values.hp = normalizeHP(values.hp);

      setSubmitting(true);
      await addDoc(collection(db, 'leads'), {
        ...values,
        catatan: values.catatan ?? null,
        sumber: values.sumber ?? null,
        assignedTo: auth.currentUser?.uid ?? null,
        createdAt: serverTimestamp(),
      });
      setSuccess(true);
    } catch (e: any) {
      if (e?.errorFields) return;
      message.error('Gagal menyimpan lead. Silakan coba lagi.');
    } finally { setSubmitting(false); }
  };

  const handleReset = () => { form.resetFields(); setSuccess(false); };

  if (success) {
    return (
      <div className="sh-page" style={{ maxWidth: 600, margin: '0 auto' }}>
        <Result
          icon={<CheckCircleOutlined style={{ color: '#10B981' }} />}
          title="Lead berhasil ditambahkan!"
          subTitle="Lead baru telah disimpan dan siap diproses."
          extra={[
            <Button key="another" type="primary" onClick={handleReset} style={{ background: '#1F4E79', borderColor: '#1F4E79' }}>Tambah Lead Lagi</Button>,
            <Button key="view" onClick={() => router.push('/leads')}>Lihat Semua Lead</Button>,
          ]}
        />
      </div>
    );
  }

  return (
    <div className="sh-page">
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => router.back()} style={{ marginBottom: 16, color: '#64748B', paddingLeft: 0 }}>
          Kembali
        </Button>

        <div className="sh-page-title" style={{ marginBottom: 4 }}>Tambah Lead Baru</div>
        <div className="sh-page-subtitle">Isi informasi calon customer di bawah ini.</div>

        <Card style={{ borderTop: '3px solid #1F4E79', marginTop: 16 }}>
          <Form form={form} layout="vertical" requiredMark="optional">
            <Form.Item name="nama" label="Nama Lengkap" rules={[{ required: true, message: 'Nama wajib diisi' }]}>
              <Input size="large" prefix={<UserOutlined style={{ color: '#64748B' }} />} placeholder="Masukkan nama lengkap" />
            </Form.Item>

            <Form.Item name="hp" label="Nomor HP / WhatsApp" help="Format: 08xxxxxxxxxx" rules={[{ required: true, message: 'Nomor HP wajib diisi' }]}>
              <Input size="large" prefix={<PhoneOutlined style={{ color: '#64748B' }} />} placeholder="08xxxxxxxxxx" />
            </Form.Item>

            <Row gutter={16}>
              <Col xs={24} sm={12}>
                <Form.Item name="project" label="Project" rules={[{ required: true, message: 'Project wajib dipilih' }]}>
                  <Select size="large" placeholder="Pilih project">
                    {projects.map(p => <Option key={p.id} value={p.nama}>{p.nama}</Option>)}
                  </Select>
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item name="sumber" label="Sumber Lead">
                  <Select size="large" placeholder="Dari mana lead ini?">
                    {sources.filter(s => s.aktif).map(s => <Option key={s.id} value={s.nama}>{s.nama}</Option>)}
                  </Select>
                </Form.Item>
              </Col>
            </Row>

            <Form.Item name="status" label="Status Awal" rules={[{ required: true, message: 'Status wajib dipilih' }]}>
              <Select size="large" placeholder="Pilih status lead">
                {statuses.filter(s => s.aktif).map((s, i) => (
                  <Option key={s.id} value={s.nama}>
                    <Tag color={STATUS_COLORS[i % STATUS_COLORS.length]} style={{ margin: 0 }}>{s.nama}</Tag>
                  </Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item name="catatan" label="Catatan (Opsional)">
              <Input.TextArea rows={3} placeholder="Informasi tambahan, minat, kebutuhan customer..." showCount maxLength={300} />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0, marginTop: 8 }}>
              <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
                <Button size="large" onClick={() => router.back()}>Batal</Button>
                <Button type="primary" size="large" icon={<SendOutlined />} loading={submitting} onClick={handleSubmit} style={{ background: '#1F4E79', borderColor: '#1F4E79', fontWeight: 600 }}>
                  Simpan Lead
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Card>
      </div>
    </div>
  );
}