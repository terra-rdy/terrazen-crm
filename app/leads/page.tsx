'use client';

import React, { useEffect, useState } from 'react';
import {
  Card, Table, Tag, Button, Input, Select, Space, Modal,
  Form, Row, Col, Typography, Tooltip, Popconfirm, message,
  Drawer, Descriptions, Avatar, DatePicker, Statistic, Alert,
} from 'antd';
import {
  PlusOutlined, SearchOutlined, EyeOutlined,
  EditOutlined, DeleteOutlined, FilterOutlined,
  PhoneOutlined, UserOutlined,
  TeamOutlined, ClockCircleOutlined, WarningOutlined,
  WhatsAppOutlined,
} from '@ant-design/icons';
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc,
  doc, query, orderBy, serverTimestamp, where,
} from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';

const { Text } = Typography;
const { Option } = Select;

interface Lead {
  id: string;
  nama: string;
  hp?: string;
  project?: string;
  sumber?: string;
  status: string;
  catatan?: string;
  assignedTo?: string;
  nextFollowUp?: string;
  createdAt?: any;
  firstOpenedAt?: any;
  waClickedAt?: any;
}

interface SalesUser {
  id: string;
  nama: string;
  email: string;
  role: string;
  projectIds?: string[];
}

interface Project {
  id: string;
  nama: string;
  kode: string;
  aktif: boolean;
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

const STATUS_COLORS = ['blue', 'orange', 'purple', 'success', 'error', 'cyan', 'gold', 'volcano'];

const formatTs = (ts: any) => {
  if (!ts) return '—';
  const date = ts?.toDate ? ts.toDate() : new Date(ts.seconds * 1000);
  return dayjs(date).format('DD MMM YYYY HH:mm');
};

const diffMenit = (ts1: any, ts2: any): string => {
  if (!ts1 || !ts2) return '—';
  const d1 = ts1?.toDate ? ts1.toDate() : new Date(ts1.seconds * 1000);
  const d2 = ts2?.toDate ? ts2.toDate() : new Date(ts2.seconds * 1000);
  const diff = Math.abs(d2.getTime() - d1.getTime());
  const menit = Math.floor(diff / 60000);
  if (menit < 60) return `${menit} menit`;
  const jam = Math.floor(menit / 60);
  const sisaMenit = menit % 60;
  return `${jam} jam ${sisaMenit} menit`;
};

export default function LeadsPage() {
  const [leads, setLeads]             = useState<Lead[]>([]);
  const [allLeads, setAllLeads]       = useState<Lead[]>([]);
  const [filtered, setFiltered]       = useState<Lead[]>([]);
  const [salesList, setSalesList]     = useState<SalesUser[]>([]);
  const [projects, setProjects]       = useState<Project[]>([]);
  const [statuses, setStatuses]       = useState<StatusItem[]>([]);
  const [sources, setSources]         = useState<SourceItem[]>([]);
  const [loading, setLoading]         = useState(true);
  const [searchText, setSearch]       = useState('');
  const [statusFilter, setStatusF]    = useState<string>('');
  const [modalOpen, setModal]         = useState(false);
  const [drawerOpen, setDrawer]       = useState(false);
  const [selectedLead, setSelected]   = useState<Lead | null>(null);
  const [editingLead, setEditing]     = useState<Lead | null>(null);
  const [submitting, setSubmitting]   = useState(false);
  const [currentRole, setRole]        = useState<string>('');
  const [currentUid, setUid]          = useState<string>('');
  const [currentNama, setNama]        = useState<string>('');
  const [duplicateInfo, setDuplicate] = useState<{ lead: Lead; salesNama: string } | null>(null);
  const [form] = Form.useForm();

  const today = dayjs().format('YYYY-MM-DD');

  const getStatusColor = (nama: string) => {
    const idx = statuses.findIndex(s => s.nama.toLowerCase() === nama?.toLowerCase());
    return STATUS_COLORS[idx % STATUS_COLORS.length] ?? 'default';
  };

  const getStatusNama = (val: string) => {
    const found = statuses.find(s => s.id === val || s.nama.toLowerCase() === val?.toLowerCase());
    return found?.nama ?? val ?? '—';
  };

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      if (!firebaseUser) return;
      setUid(firebaseUser.uid);

      const snap = await getDocs(collection(db, 'users'));
      const users = snap.docs.map(d => ({ id: d.id, ...d.data() })) as SalesUser[];
      const me = users.find(u => u.id === firebaseUser.uid) as any;

      setRole(me?.role ?? 'sales');
      setNama(me?.nama ?? '');
      setSalesList(users.filter(u => u.role === 'sales' || u.role === 'admin'));

      const projectSnap = await getDocs(collection(db, 'projects'));
      const allProjects = projectSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Project[];
      if (me?.role === 'admin') {
        setProjects(allProjects.filter(p => p.aktif));
      } else {
        const myProjectIds: string[] = me?.projectIds ?? [];
        setProjects(allProjects.filter(p => p.aktif && myProjectIds.includes(p.id)));
      }

      const statusSnap = await getDocs(query(collection(db, 'statuses'), orderBy('urutan')));
      setStatuses(statusSnap.docs.map(d => ({ id: d.id, ...d.data() })) as StatusItem[]);

      const sourceSnap = await getDocs(query(collection(db, 'sources'), orderBy('urutan')));
      setSources(sourceSnap.docs.map(d => ({ id: d.id, ...d.data() })) as SourceItem[]);

      await fetchLeads(me?.role ?? 'sales', firebaseUser.uid);

      const allSnap = await getDocs(collection(db, 'leads'));
      setAllLeads(allSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Lead[]);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    let data = [...leads];
    if (searchText) {
      const s = searchText.toLowerCase();
      data = data.filter(l =>
        l.nama?.toLowerCase().includes(s) ||
        l.hp?.includes(s) ||
        l.project?.toLowerCase().includes(s)
      );
    }
    if (statusFilter) {
      data = data.filter(l => l.status?.toLowerCase() === statusFilter.toLowerCase());
    }
    setFiltered(data);
  }, [leads, searchText, statusFilter]);

  const fetchLeads = async (role: string, uid: string) => {
    setLoading(true);
    try {
      let q;
      if (role === 'admin') {
        q = query(collection(db, 'leads'), orderBy('createdAt', 'desc'));
      } else {
        q = query(collection(db, 'leads'), where('assignedTo', '==', uid), orderBy('createdAt', 'desc'));
      }
      const snap = await getDocs(q);
      setLeads(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Lead[]);
    } catch {
      const snap = await getDocs(collection(db, 'leads'));
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Lead[];
      setLeads(role === 'admin' ? all : all.filter(l => l.assignedTo === uid));
    } finally {
      setLoading(false);
    }
  };

  const totalLeads      = leads.length;
  const followUpHariIni = leads.filter(l => l.nextFollowUp === today).length;
  const overdue         = leads.filter(l =>
    l.nextFollowUp && l.nextFollowUp < today &&
    !['closing', 'lost'].includes(l.status?.toLowerCase())
  ).length;

  const checkDuplicate = (hp: string, excludeId?: string): Lead | null => {
    const normalized = normalizeHP(hp);
    return allLeads.find(l =>
      l.id !== excludeId && l.hp && normalizeHP(l.hp) === normalized
    ) ?? null;
  };

  const openAdd = () => {
    setEditing(null);
    setDuplicate(null);
    form.resetFields();
    if (currentRole !== 'admin') form.setFieldsValue({ assignedTo: currentUid });
    setModal(true);
  };

  const openEdit = (lead: Lead) => {
    setEditing(lead);
    setDuplicate(null);
    form.setFieldsValue({
      ...lead,
      nextFollowUp: lead.nextFollowUp ? dayjs(lead.nextFollowUp) : null,
    });
    setModal(true);
  };

  const openDetail = async (lead: Lead) => {
    setSelected(lead);
    setDrawer(true);

    // Catat firstOpenedAt jika sales dan belum pernah dibuka
    if (currentRole === 'sales' && !lead.firstOpenedAt) {
      try {
        await updateDoc(doc(db, 'leads', lead.id), {
          firstOpenedAt: serverTimestamp(),
          firstOpenedBy: currentUid,
        });
        // Update local state
        setLeads(prev => prev.map(l =>
          l.id === lead.id ? { ...l, firstOpenedAt: new Date() } : l
        ));
      } catch (e) { console.error('Gagal catat firstOpenedAt:', e); }
    }
  };

  const handleWAClick = async (lead: Lead) => {
    if (!lead.hp) return;

    // Catat waClickedAt
    try {
      await updateDoc(doc(db, 'leads', lead.id), {
        waClickedAt: serverTimestamp(),
        waClickedBy: currentUid,
      });
      // Update local state
      setLeads(prev => prev.map(l =>
        l.id === lead.id ? { ...l, waClickedAt: new Date() } : l
      ));
      if (selectedLead?.id === lead.id) {
        setSelected({ ...lead, waClickedAt: new Date() });
      }
    } catch (e) { console.error('Gagal catat waClickedAt:', e); }

    // Buka WA
    const nomor = lead.hp.replace(/^0/, '62');
    window.open(`https://wa.me/${nomor}`, '_blank');
  };

  const handleHPChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const hp = e.target.value;
    setDuplicate(null);
    if (hp.length >= 10) {
      const dup = checkDuplicate(hp, editingLead?.id);
      if (dup) setDuplicate({ lead: dup, salesNama: getSalesName(dup.assignedTo ?? '') });
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const hpError = validateHP(values.hp);
      if (hpError) { message.error(hpError); return; }
      values.hp = normalizeHP(values.hp);

      const dup = checkDuplicate(values.hp, editingLead?.id);
      if (dup) {
        const salesNama = getSalesName(dup.assignedTo ?? '');
        setDuplicate({ lead: dup, salesNama });
        message.warning(`Nomor sudah terdaftar (Sales: ${salesNama})`);
        return;
      }

      setSubmitting(true);
      const nextFollowUp = values.nextFollowUp ? dayjs(values.nextFollowUp).format('YYYY-MM-DD') : null;
      const payload = {
        ...values,
        nextFollowUp: nextFollowUp ?? null,
        catatan: values.catatan ?? null,
        sumber: values.sumber ?? null,
        assignedTo: values.assignedTo ?? null,
      };

      if (editingLead) {
        await updateDoc(doc(db, 'leads', editingLead.id), payload);
        message.success('Lead berhasil diupdate');
      } else {
        const assignedTo = currentRole === 'admin' ? (values.assignedTo ?? currentUid) : currentUid;
        await addDoc(collection(db, 'leads'), {
          ...payload,
          assignedTo,
          createdAt: serverTimestamp(),
          firstOpenedAt: null,
          waClickedAt: null,
        });
        message.success('Lead berhasil ditambahkan');

        try {
          const idToken = await auth.currentUser?.getIdToken();
          await fetch('/api/send-notification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
            body: JSON.stringify({ title: '🏠 Lead Baru Masuk!', body: `${values.nama} - ${values.project ?? ''}`, targetRole: 'sales' }),
          });
        } catch (notifErr) { console.error('Notifikasi gagal:', notifErr); }
      }

      setModal(false);
      setDuplicate(null);
      const allSnap = await getDocs(collection(db, 'leads'));
      setAllLeads(allSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Lead[]);
      fetchLeads(currentRole, currentUid);
    } catch (e: any) {
      if (e?.errorFields) return;
      message.error('Terjadi kesalahan: ' + (e?.message ?? ''));
    } finally { setSubmitting(false); }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'leads', id));
      message.success('Lead dihapus');
      fetchLeads(currentRole, currentUid);
    } catch { message.error('Gagal menghapus lead'); }
  };

  const getSalesName = (uid: string) => salesList.find(u => u.id === uid)?.nama ?? uid ?? '—';

  const getFollowUpTag = (date?: string) => {
    if (!date) return <Text type="secondary">—</Text>;
    if (date < today) return <Tag color="error">Overdue: {date}</Tag>;
    if (date === today) return <Tag color="warning">Hari ini</Tag>;
    return <Tag color="processing">{date}</Tag>;
  };

  const columns: ColumnsType<Lead> = [
    {
      title: 'Nama', dataIndex: 'nama', key: 'nama',
      render: (nama: string) => (
        <Space>
          <Avatar size={32} style={{ background: '#1F4E79', fontSize: 13, flexShrink: 0 }}>
            {nama?.[0]?.toUpperCase() ?? '?'}
          </Avatar>
          <Text style={{ fontWeight: 500 }}>{nama}</Text>
        </Space>
      ),
    },
    {
      title: 'No. HP', dataIndex: 'hp', key: 'hp', responsive: ['md'],
      render: (p: string, record: Lead) => p ? (
        <Space size={4}>
          <Text>{p}</Text>
          <Tooltip title="Chat WhatsApp">
            <Button
              type="text"
              size="small"
              icon={<WhatsAppOutlined style={{ color: '#25D366' }} />}
              onClick={() => handleWAClick(record)}
            />
          </Tooltip>
        </Space>
      ) : <Text type="secondary">—</Text>,
    },
    { title: 'Project', dataIndex: 'project', key: 'project', responsive: ['sm'], render: (p: string) => <Text type="secondary">{p ?? '—'}</Text> },
    { title: 'Follow Up', dataIndex: 'nextFollowUp', key: 'nextFollowUp', responsive: ['md'], render: (date: string) => getFollowUpTag(date) },
    { title: 'Sales', dataIndex: 'assignedTo', key: 'assignedTo', responsive: ['lg'], render: (uid: string) => <Text type="secondary">{getSalesName(uid)}</Text> },
    {
      title: 'Status', dataIndex: 'status', key: 'status',
      render: (s: string) => <Tag color={getStatusColor(s)}>{getStatusNama(s)}</Tag>,
    },
    {
      title: '', key: 'actions', width: 100,
      render: (_: any, record: Lead) => (
        <Space size={4}>
          <Tooltip title="Detail"><Button type="text" size="small" icon={<EyeOutlined />} onClick={() => openDetail(record)} /></Tooltip>
          <Tooltip title="Edit"><Button type="text" size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} /></Tooltip>
          {currentRole === 'admin' && (
            <Popconfirm title="Hapus lead ini?" onConfirm={() => handleDelete(record.id)} okText="Hapus" cancelText="Batal" okButtonProps={{ danger: true }}>
              <Tooltip title="Hapus"><Button type="text" size="small" danger icon={<DeleteOutlined />} /></Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="sh-page">
      <Row justify="space-between" align="middle" style={{ marginBottom: 20 }}>
        <Col>
          <div className="sh-page-title">Leads</div>
          <div className="sh-page-subtitle">{filtered.length} lead ditemukan</div>
        </Col>
        <Col>
          <Button type="primary" icon={<PlusOutlined />} size="large" onClick={openAdd} style={{ background: '#1F4E79', borderColor: '#1F4E79', fontWeight: 600 }}>
            Tambah Lead
          </Button>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        {[
          { label: 'Total Leads', value: totalLeads, color: '#1F4E79', icon: <TeamOutlined /> },
          { label: 'Follow Up Hari Ini', value: followUpHariIni, color: '#F59E0B', icon: <ClockCircleOutlined /> },
          { label: 'Overdue', value: overdue, color: '#EF4444', icon: <WarningOutlined /> },
        ].map(item => (
          <Col key={item.label} xs={24} sm={8}>
            <Card style={{ borderLeft: `4px solid ${item.color}` }} styles={{ body: { padding: '16px 20px' } }}>
              <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                <div>
                  <Text type="secondary" style={{ fontSize: 13 }}>{item.label}</Text>
                  <Statistic value={item.value} styles={{ content: { fontWeight: 700, fontSize: 28, color: item.label === 'Overdue' && item.value > 0 ? '#EF4444' : '#1E293B' } }} />
                </div>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: `${item.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: item.color }}>
                  {item.icon}
                </div>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>

      <Card style={{ marginBottom: 16 }} styles={{ body: { padding: '12px 16px' } }}>
        <Row gutter={12}>
          <Col xs={24} sm={14} md={16}>
            <Input prefix={<SearchOutlined style={{ color: '#64748B' }} />} placeholder="Cari nama, nomor, atau project..." value={searchText} onChange={e => setSearch(e.target.value)} allowClear />
          </Col>
          <Col xs={24} sm={10} md={8}>
            <Select placeholder="Filter status" value={statusFilter || undefined} onChange={v => setStatusF(v ?? '')} allowClear style={{ width: '100%' }} suffixIcon={<FilterOutlined />}>
              {statuses.filter(s => s.aktif).map((s, i) => (
                <Option key={s.id} value={s.nama}>
                  <Tag color={STATUS_COLORS[i % STATUS_COLORS.length]} style={{ margin: 0 }}>{s.nama}</Tag>
                </Option>
              ))}
            </Select>
          </Col>
        </Row>
      </Card>

      <Card styles={{ body: { padding: 0 } }}>
        <Table columns={columns} dataSource={filtered} rowKey="id" loading={loading}
          pagination={{ pageSize: 10, showSizeChanger: false, showTotal: total => `${total} leads` }}
          size="middle" style={{ borderRadius: 12, overflow: 'hidden' }}
        />
      </Card>

      <Modal
        title={<Space><UserOutlined style={{ color: '#1F4E79' }} /><span>{editingLead ? 'Edit Lead' : 'Tambah Lead Baru'}</span></Space>}
        open={modalOpen} onOk={handleSubmit} onCancel={() => { setModal(false); setDuplicate(null); }}
        confirmLoading={submitting} okText={editingLead ? 'Simpan Perubahan' : 'Tambah Lead'} cancelText="Batal"
        okButtonProps={{ style: { background: '#1F4E79', borderColor: '#1F4E79' } }} width={520}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="nama" label="Nama" rules={[{ required: true, message: 'Masukkan nama lead' }]}>
            <Input placeholder="Nama lengkap" prefix={<UserOutlined />} />
          </Form.Item>
          <Form.Item name="hp" label="Nomor HP" rules={[{ required: true, message: 'Masukkan nomor HP' }]} help={duplicateInfo ? undefined : 'Format: 08xxxxxxxxxx'}>
            <Input placeholder="08xxxxxxxxxx" prefix={<PhoneOutlined />} onChange={handleHPChange} />
          </Form.Item>

          {duplicateInfo && (
            <Alert type="warning" showIcon style={{ marginBottom: 16, marginTop: -8 }}
              message={<div>Nomor ini sudah dimiliki oleh Sales: <strong>{duplicateInfo.salesNama}</strong></div>}
            />
          )}

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="project" label="Project" rules={[{ required: true, message: 'Pilih project' }]}>
                <Select placeholder="Pilih project">
                  {projects.map(p => <Option key={p.id} value={p.nama}>{p.nama}</Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="sumber" label="Sumber">
                <Select placeholder="Sumber lead">
                  {sources.filter(s => s.aktif).map(s => <Option key={s.id} value={s.nama}>{s.nama}</Option>)}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="status" label="Status" rules={[{ required: true, message: 'Pilih status' }]}>
                <Select placeholder="Status lead">
                  {statuses.filter(s => s.aktif).map((s, i) => (
                    <Option key={s.id} value={s.nama}>
                      <Tag color={STATUS_COLORS[i % STATUS_COLORS.length]} style={{ margin: 0 }}>{s.nama}</Tag>
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="nextFollowUp" label="Next Follow Up">
                <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" placeholder="Pilih tanggal" disabledDate={d => d && d < dayjs().startOf('day')} />
              </Form.Item>
            </Col>
          </Row>
          {currentRole === 'admin' && (
            <Form.Item name="assignedTo" label="Assign ke Sales">
              <Select placeholder="Pilih sales" allowClear>
                {salesList.map(s => <Option key={s.id} value={s.id}>{s.nama} ({s.role})</Option>)}
              </Select>
            </Form.Item>
          )}
          <Form.Item name="catatan" label="Catatan">
            <Input.TextArea rows={3} placeholder="Catatan tambahan..." />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title={
          <Space>
            <Avatar size={40} style={{ background: '#1F4E79' }}>{selectedLead?.nama?.[0]?.toUpperCase()}</Avatar>
            <div>
              <div style={{ fontWeight: 600 }}>{selectedLead?.nama}</div>
              <Tag color={getStatusColor(selectedLead?.status ?? '')} style={{ marginTop: 2 }}>
                {getStatusNama(selectedLead?.status ?? '')}
              </Tag>
            </div>
          </Space>
        }
        open={drawerOpen} onClose={() => setDrawer(false)} size="default"
        extra={
          <Space>
            {selectedLead?.hp && (
              <Button
                icon={<WhatsAppOutlined />}
                onClick={() => handleWAClick(selectedLead)}
                style={{ background: '#25D366', borderColor: '#25D366', color: '#fff' }}
              >
                Chat WA
              </Button>
            )}
            <Button type="primary" icon={<EditOutlined />} onClick={() => { setDrawer(false); openEdit(selectedLead!); }} style={{ background: '#1F4E79' }}>Edit</Button>
          </Space>
        }
      >
        {selectedLead && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="Nama">{selectedLead.nama}</Descriptions.Item>
            <Descriptions.Item label="No. HP">{selectedLead.hp ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="Project">{selectedLead.project ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="Sumber">{selectedLead.sumber ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="Sales">{getSalesName(selectedLead.assignedTo ?? '')}</Descriptions.Item>
            <Descriptions.Item label="Next Follow Up">{getFollowUpTag(selectedLead.nextFollowUp)}</Descriptions.Item>
            <Descriptions.Item label="Status">
              <Tag color={getStatusColor(selectedLead.status)}>{getStatusNama(selectedLead.status)}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Catatan">{selectedLead.catatan ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="Lead Masuk">{formatTs(selectedLead.createdAt)}</Descriptions.Item>
            <Descriptions.Item label="Pertama Dibuka">
              {selectedLead.firstOpenedAt ? formatTs(selectedLead.firstOpenedAt) : <Tag color="warning">Belum dibuka</Tag>}
            </Descriptions.Item>
            <Descriptions.Item label="Response Time">
              {selectedLead.firstOpenedAt
                ? diffMenit(selectedLead.createdAt, selectedLead.firstOpenedAt)
                : '—'}
            </Descriptions.Item>
            <Descriptions.Item label="WA Diklik">
              {selectedLead.waClickedAt ? formatTs(selectedLead.waClickedAt) : <Tag color="warning">Belum chat WA</Tag>}
            </Descriptions.Item>
            <Descriptions.Item label="WA Response Time">
              {selectedLead.waClickedAt
                ? diffMenit(selectedLead.createdAt, selectedLead.waClickedAt)
                : '—'}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>
    </div>
  );
}