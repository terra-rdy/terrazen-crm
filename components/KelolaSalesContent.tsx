'use client';

import React, { useEffect, useState } from 'react';
import {
  Card, Table, Tag, Button, Modal, Form, Input, Select,
  Space, Switch, Typography, Avatar, Popconfirm, message,
  Row, Col, Tooltip, Descriptions,
} from 'antd';
import {
  PlusOutlined, EditOutlined, KeyOutlined,
  UserOutlined, MailOutlined, UsergroupAddOutlined,
  EyeOutlined, LockOutlined, AppstoreOutlined,
} from '@ant-design/icons';
import {
  collection, getDocs, updateDoc,
  doc, serverTimestamp, setDoc,
} from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import type { ColumnsType } from 'antd/es/table';

const { Text } = Typography;
const { Option } = Select;

interface SalesUser {
  id: string;
  nama: string;
  email: string;
  role: 'admin' | 'sales' | string;
  aktif: boolean;
  password?: string;
  projectIds?: string[];
  createdAt?: any;
}

interface Project {
  id: string;
  nama: string;
  kode: string;
  aktif: boolean;
}

export default function KelolaSalesContent() {
  const [users, setUsers]           = useState<SalesUser[]>([]);
  const [projects, setProjects]     = useState<Project[]>([]);
  const [loading, setLoading]       = useState(true);
  const [modalOpen, setModal]       = useState(false);
  const [detailOpen, setDetail]     = useState(false);
  const [projectModal, setProjectModal] = useState(false);
  const [editUser, setEditUser]     = useState<SalesUser | null>(null);
  const [selectedUser, setSelected] = useState<SalesUser | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resetting, setResetting]   = useState(false);
  const [form]                      = Form.useForm();
  const [projectForm]               = Form.useForm();

  useEffect(() => {
    fetchUsers();
    fetchProjects();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'users'));
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })) as SalesUser[]);
    } catch { message.error('Gagal memuat data'); }
    finally { setLoading(false); }
  };

  const fetchProjects = async () => {
    try {
      const snap = await getDocs(collection(db, 'projects'));
      setProjects(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Project[]);
    } catch { console.error('Gagal memuat projects'); }
  };

  const getProjectNames = (projectIds?: string[]) => {
    if (!projectIds?.length) return '—';
    return projectIds
      .map(id => projects.find(p => p.id === id)?.nama ?? id)
      .join(', ');
  };

  const openAdd = () => { setEditUser(null); form.resetFields(); setModal(true); };

  const openEdit = (u: SalesUser) => {
    setEditUser(u);
    form.setFieldsValue({ nama: u.nama, role: u.role });
    setModal(true);
  };

  const openDetail = (u: SalesUser) => {
    setSelected(u);
    setDetail(true);
  };

  const openProjectAssign = (u: SalesUser) => {
    setSelected(u);
    projectForm.setFieldsValue({ projectIds: u.projectIds ?? [] });
    setProjectModal(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      if (editUser) {
        await updateDoc(doc(db, 'users', editUser.id), {
          nama: values.nama,
          role: values.role,
        });
        message.success('Data sales diperbarui');
      } else {
        const res = await fetch('/api/create-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: values.email,
            password: values.password,
            nama: values.nama,
            role: values.role ?? 'sales',
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Gagal membuat akun');

        await setDoc(doc(db, 'users', data.uid), {
          uid: data.uid,
          nama: values.nama,
          email: values.email,
          role: values.role ?? 'sales',
          aktif: true,
          password: values.password,
          projectIds: [],
          createdAt: serverTimestamp(),
        });
        message.success('Sales baru berhasil ditambahkan');
      }
      setModal(false);
      fetchUsers();
    } catch (e: any) {
      if (e?.errorFields) return;
      message.error(e?.message ?? 'Terjadi kesalahan');
    } finally { setSubmitting(false); }
  };

  const handleSaveProjects = async () => {
    try {
      const values = await projectForm.validateFields();
      setSubmitting(true);
      await updateDoc(doc(db, 'users', selectedUser!.id), {
        projectIds: values.projectIds ?? [],
      });
      message.success(`Project untuk ${selectedUser!.nama} berhasil diupdate`);
      setProjectModal(false);
      fetchUsers();
    } catch (e: any) {
      if (e?.errorFields) return;
      message.error('Gagal menyimpan project');
    } finally { setSubmitting(false); }
  };

  const toggleActive = async (u: SalesUser) => {
    try {
      await updateDoc(doc(db, 'users', u.id), { aktif: !u.aktif });
      message.success(`${u.nama} ${u.aktif ? 'dinonaktifkan' : 'diaktifkan'}`);
      fetchUsers();
    } catch { message.error('Gagal mengubah status'); }
  };

  const handleResetPassword = async (u: SalesUser) => {
    setResetting(true);
    try {
      const DEFAULT_PASSWORD = '123456';
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('Tidak ada session admin');
      const idToken = await currentUser.getIdToken();

      const res = await fetch('/api/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({ uid: u.id }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Gagal reset password');
      }

      await updateDoc(doc(db, 'users', u.id), { password: DEFAULT_PASSWORD });
      message.success(`Password ${u.nama} direset ke: ${DEFAULT_PASSWORD}`);
      fetchUsers();
      if (selectedUser?.id === u.id) {
        setSelected({ ...u, password: DEFAULT_PASSWORD });
      }
    } catch (e: any) {
      message.error(e?.message ?? 'Gagal reset password');
    } finally { setResetting(false); }
  };

  const columns: ColumnsType<SalesUser> = [
    {
      title: 'Sales',
      key: 'sales',
      render: (_: any, r: SalesUser) => (
        <Space>
          <Avatar size={36} style={{ background: '#1F4E79', flexShrink: 0 }}>
            {r.nama?.[0]?.toUpperCase()}
          </Avatar>
          <div>
            <Text style={{ fontWeight: 500, display: 'block' }}>{r.nama}</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>{r.email}</Text>
          </div>
        </Space>
      ),
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      render: (role: string) => (
        <Tag color={role === 'admin' ? 'gold' : 'blue'}>{role?.toUpperCase()}</Tag>
      ),
      responsive: ['sm'],
    },
    {
      title: 'Project',
      key: 'project',
      render: (_: any, r: SalesUser) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {getProjectNames(r.projectIds)}
        </Text>
      ),
      responsive: ['md'],
    },
    {
      title: 'Status',
      key: 'status',
      render: (_: any, r: SalesUser) => (
        <Switch
          checked={r.aktif}
          onChange={() => toggleActive(r)}
          checkedChildren="Aktif"
          unCheckedChildren="Nonaktif"
          style={{ background: r.aktif ? '#10B981' : undefined }}
        />
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 140,
      render: (_: any, r: SalesUser) => (
        <Space size={4}>
          <Tooltip title="Detail & Password">
            <Button type="text" size="small" icon={<EyeOutlined />} onClick={() => openDetail(r)} />
          </Tooltip>
          <Tooltip title="Edit">
            <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          </Tooltip>
          <Tooltip title="Assign Project">
            <Button type="text" size="small" icon={<AppstoreOutlined />} onClick={() => openProjectAssign(r)} style={{ color: '#1F4E79' }} />
          </Tooltip>
          <Popconfirm
            title={`Reset password ${r.nama} ke "123456"?`}
            onConfirm={() => handleResetPassword(r)}
            okText="Reset" cancelText="Batal"
            okButtonProps={{ danger: true }}
          >
            <Tooltip title="Reset Password">
              <Button type="text" size="small" icon={<KeyOutlined />} danger />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Text type="secondary">{users.length} sales terdaftar</Text>
        </Col>
        <Col>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={openAdd}
            style={{ background: '#1F4E79', fontWeight: 600 }}
          >
            Tambah Sales
          </Button>
        </Col>
      </Row>

      <Card styles={{ body: { padding: 0 } }}>
        <Table
          columns={columns}
          dataSource={users}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10, showSizeChanger: false }}
          size="middle"
        />
      </Card>

      {/* Add/Edit Modal */}
      <Modal
        title={
          <Space>
            <UsergroupAddOutlined style={{ color: '#1F4E79' }} />
            {editUser ? 'Edit Sales' : 'Tambah Sales Baru'}
          </Space>
        }
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModal(false)}
        confirmLoading={submitting}
        okText={editUser ? 'Simpan' : 'Buat Akun'}
        cancelText="Batal"
        okButtonProps={{ style: { background: '#1F4E79', borderColor: '#1F4E79' } }}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="nama" label="Nama" rules={[{ required: true, message: 'Nama wajib diisi' }]}>
            <Input prefix={<UserOutlined />} placeholder="Nama lengkap" />
          </Form.Item>
          {!editUser && (
            <>
              <Form.Item name="email" label="Email"
                rules={[{ required: true, type: 'email', message: 'Email valid wajib diisi' }]}
              >
                <Input prefix={<MailOutlined />} placeholder="email@domain.com" />
              </Form.Item>
              <Form.Item name="password" label="Password"
                rules={[{ required: true, min: 6, message: 'Password minimal 6 karakter' }]}
              >
                <Input.Password prefix={<LockOutlined />} placeholder="Minimal 6 karakter" />
              </Form.Item>
            </>
          )}
          <Form.Item name="role" label="Role" initialValue="sales">
            <Select>
              <Option value="sales">Sales</Option>
              <Option value="admin">Admin</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* Assign Project Modal */}
      <Modal
        title={
          <Space>
            <AppstoreOutlined style={{ color: '#1F4E79' }} />
            <span>Assign Project — {selectedUser?.nama}</span>
          </Space>
        }
        open={projectModal}
        onOk={handleSaveProjects}
        onCancel={() => setProjectModal(false)}
        confirmLoading={submitting}
        okText="Simpan"
        cancelText="Batal"
        okButtonProps={{ style: { background: '#1F4E79', borderColor: '#1F4E79' } }}
      >
        <Form form={projectForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="projectIds" label="Project yang di-assign">
            <Select
              mode="multiple"
              placeholder="Pilih satu atau lebih project"
              style={{ width: '100%' }}
              allowClear
            >
              {projects.filter(p => p.aktif).map(p => (
                <Option key={p.id} value={p.id}>
                  {p.nama} <Tag style={{ marginLeft: 4 }}>{p.kode}</Tag>
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* Detail Modal */}
      <Modal
        title={
          <Space>
            <Avatar size={36} style={{ background: '#1F4E79' }}>
              {selectedUser?.nama?.[0]?.toUpperCase()}
            </Avatar>
            <div>
              <div style={{ fontWeight: 600 }}>{selectedUser?.nama}</div>
              <Tag color={selectedUser?.role === 'admin' ? 'gold' : 'blue'} style={{ marginTop: 2 }}>
                {selectedUser?.role?.toUpperCase()}
              </Tag>
            </div>
          </Space>
        }
        open={detailOpen}
        onCancel={() => setDetail(false)}
        footer={[
          <Popconfirm
            key="reset"
            title='Reset password ke "123456"?'
            onConfirm={() => handleResetPassword(selectedUser!)}
            okText="Reset" cancelText="Batal"
            okButtonProps={{ danger: true }}
          >
            <Button danger icon={<KeyOutlined />} loading={resetting}>
              Reset Password ke 123456
            </Button>
          </Popconfirm>,
          <Button key="close" onClick={() => setDetail(false)}>Tutup</Button>,
        ]}
      >
        {selectedUser && (
          <Descriptions column={1} bordered size="small" style={{ marginTop: 8 }}>
            <Descriptions.Item label="Nama">{selectedUser.nama}</Descriptions.Item>
            <Descriptions.Item label="Email">{selectedUser.email}</Descriptions.Item>
            <Descriptions.Item label="Role">
              <Tag color={selectedUser.role === 'admin' ? 'gold' : 'blue'}>
                {selectedUser.role?.toUpperCase()}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Status">
              <Tag color={selectedUser.aktif ? 'success' : 'default'}>
                {selectedUser.aktif ? 'Aktif' : 'Nonaktif'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Project">
              {getProjectNames(selectedUser.projectIds)}
            </Descriptions.Item>
            <Descriptions.Item label="Password Saat Ini">
              <Input.Password
                value={selectedUser.password ?? '(tidak tersimpan)'}
                readOnly
                style={{ border: 'none', background: 'transparent', padding: 0 }}
              />
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
}