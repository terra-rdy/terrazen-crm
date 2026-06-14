'use client';

import React, { useEffect, useState } from 'react';
import {
  Card, Table, Tag, Button, Modal, Form, Input, Select,
  Space, Typography, Row, Col, Tooltip, Popconfirm, message,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, AppstoreOutlined,
} from '@ant-design/icons';
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp, orderBy, query,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { ColumnsType } from 'antd/es/table';

const { Text } = Typography;
const { Option } = Select;

interface Project {
  id: string;
  name: string;
  status: string;
  location?: string;
  createdAt?: any;
}

const PROJECT_STATUS = ['Active', 'Inactive', 'Sold Out', 'Coming Soon'];
const statusColor: Record<string, string> = {
  active:       'success',
  inactive:     'default',
  'sold out':   'error',
  'coming soon':'processing',
};

export default function ProjectsPage() {
  const [projects, setProjects]     = useState<Project[]>([]);
  const [loading, setLoading]       = useState(true);
  const [modalOpen, setModal]       = useState(false);
  const [editProject, setEdit]      = useState<Project | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form]                      = Form.useForm();

  useEffect(() => { fetchProjects(); }, []);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const q    = query(collection(db, 'projects'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      setProjects(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Project[]);
    } catch {
      const snap = await getDocs(collection(db, 'projects'));
      setProjects(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Project[]);
    } finally { setLoading(false); }
  };

  const openAdd = () => { setEdit(null); form.resetFields(); setModal(true); };
  const openEdit = (p: Project) => { setEdit(p); form.setFieldsValue(p); setModal(true); };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      if (editProject) {
        await updateDoc(doc(db, 'projects', editProject.id), values);
        message.success('Project diperbarui');
      } else {
        await addDoc(collection(db, 'projects'), { ...values, createdAt: serverTimestamp() });
        message.success('Project ditambahkan');
      }
      setModal(false);
      fetchProjects();
    } catch (e: any) {
      if (e?.errorFields) return;
      message.error('Terjadi kesalahan');
    } finally { setSubmitting(false); }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'projects', id));
      message.success('Project dihapus');
      fetchProjects();
    } catch { message.error('Gagal menghapus'); }
  };

  const columns: ColumnsType<Project> = [
    {
      title: 'Nama Project',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => (
        <Space>
          <div style={{
            width: 32, height: 32, borderRadius: 6,
            background: '#EFF6FF', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <AppstoreOutlined style={{ color: '#1F4E79' }} />
          </div>
          <Text style={{ fontWeight: 500 }}>{name}</Text>
        </Space>
      ),
    },
    {
      title: 'Lokasi',
      dataIndex: 'location',
      key: 'location',
      render: (l: string) => <Text type="secondary">{l ?? '—'}</Text>,
      responsive: ['sm'],
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => (
        <Tag color={statusColor[s?.toLowerCase()] ?? 'default'}>{s}</Tag>
      ),
    },
    {
      title: 'Dibuat',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (t: any) => t?.seconds
        ? new Date(t.seconds * 1000).toLocaleDateString('id-ID')
        : '—',
      responsive: ['md'],
    },
    {
      title: '',
      key: 'actions',
      width: 80,
      render: (_: any, r: Project) => (
        <Space size={4}>
          <Tooltip title="Edit">
            <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          </Tooltip>
          <Popconfirm
            title="Hapus project ini?"
            onConfirm={() => handleDelete(r.id)}
            okText="Hapus" cancelText="Batal"
            okButtonProps={{ danger: true }}
          >
            <Button type="text" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="sh-page">
      <Row justify="space-between" align="middle" style={{ marginBottom: 20 }}>
        <Col>
          <div className="sh-page-title">Projects</div>
          <div className="sh-page-subtitle">{projects.length} project terdaftar</div>
        </Col>
        <Col>
          <Button type="primary" icon={<PlusOutlined />} size="large" onClick={openAdd}
            style={{ background: '#1F4E79', fontWeight: 600 }}
          >Tambah Project</Button>
        </Col>
      </Row>

      <Card styles={{ body: { padding: 0 } }}>
        <Table columns={columns} dataSource={projects} rowKey="id" loading={loading}
          pagination={{ pageSize: 10, showSizeChanger: false }} size="middle"
        />
      </Card>

      <Modal
        title={<Space><AppstoreOutlined style={{ color: '#1F4E79' }} />{editProject ? 'Edit Project' : 'Tambah Project'}</Space>}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModal(false)}
        confirmLoading={submitting}
        okText={editProject ? 'Simpan' : 'Tambah'}
        cancelText="Batal"
        okButtonProps={{ style: { background: '#1F4E79', borderColor: '#1F4E79' } }}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="Nama Project" rules={[{ required: true, message: 'Nama wajib diisi' }]}>
            <Input placeholder="Nama project properti" />
          </Form.Item>
          <Form.Item name="location" label="Lokasi">
            <Input placeholder="Kota / kawasan" />
          </Form.Item>
          <Form.Item name="status" label="Status" initialValue="Active" rules={[{ required: true }]}>
            <Select>
              {PROJECT_STATUS.map(s => (
                <Option key={s} value={s}>
                  <Tag color={statusColor[s.toLowerCase()]} style={{ margin: 0 }}>{s}</Tag>
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}