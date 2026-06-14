'use client';

import React, { useEffect, useState } from 'react';
import {
  Card, Form, Input, Button, Typography, Space,
  message, Avatar, Tag, Divider,
} from 'antd';
import {
  UserOutlined, LockOutlined, SaveOutlined,
} from '@ant-design/icons';
import { doc, getDoc, updateDoc, collection, getDocs } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import {
  updatePassword, reauthenticateWithCredential,
  EmailAuthProvider,
} from 'firebase/auth';
import { useRouter } from 'next/navigation';

const { Text, Title } = Typography;

export default function ProfilePage() {
  const [profileForm] = Form.useForm();
  const [passwordForm] = Form.useForm();
  const [loading, setLoading]         = useState(true);
  const [savingProfile, setSavingP]   = useState(false);
  const [savingPassword, setSavingPw] = useState(false);
  const [userData, setUserData]       = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    const load = async () => {
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) { router.push('/login'); return; }

      const snap = await getDocs(collection(db, 'users'));
      const users = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const me = users.find((u: any) => u.id === firebaseUser.uid) as any;

      if (!me) { router.push('/login'); return; }

      setUserData(me);
      profileForm.setFieldsValue({ nama: me.nama });
      setLoading(false);
    };
    load();
  }, [profileForm, router]);

  const handleSaveProfile = async () => {
    try {
      const values = await profileForm.validateFields();
      setSavingP(true);
      await updateDoc(doc(db, 'users', userData.id), { nama: values.nama });
      setUserData({ ...userData, nama: values.nama });
      message.success('Nama berhasil diperbarui');
    } catch (e: any) {
      if (e?.errorFields) return;
      message.error('Gagal menyimpan nama');
    } finally { setSavingP(false); }
  };

  const handleSavePassword = async () => {
    try {
      const values = await passwordForm.validateFields();
      if (values.newPassword !== values.confirmPassword) {
        message.error('Password baru tidak cocok');
        return;
      }
      setSavingPw(true);

      const firebaseUser = auth.currentUser;
      if (!firebaseUser?.email) throw new Error('User tidak ditemukan');

      // Re-authenticate dulu sebelum ganti password
      const credential = EmailAuthProvider.credential(
        firebaseUser.email,
        values.currentPassword
      );
      await reauthenticateWithCredential(firebaseUser, credential);

      // Update password di Firebase Auth
      await updatePassword(firebaseUser, values.newPassword);

      // Update password di Firestore (referensi admin)
      await updateDoc(doc(db, 'users', userData.id), {
        password: values.newPassword,
      });

      message.success('Password berhasil diperbarui');
      passwordForm.resetFields();
    } catch (e: any) {
      if (e?.errorFields) return;
      if (e?.code === 'auth/wrong-password' || e?.code === 'auth/invalid-credential') {
        message.error('Password lama salah');
      } else {
        message.error(e?.message ?? 'Gagal mengubah password');
      }
    } finally { setSavingPw(false); }
  };

  if (loading) return null;

  return (
    <div className="sh-page">
      <div className="sh-page-title">Profil Saya</div>
      <div className="sh-page-subtitle">Kelola nama dan password akun Anda</div>

      {/* Info Akun */}
      <Card style={{ marginBottom: 16, maxWidth: 520 }}>
        <Space align="center" size={16}>
          <Avatar size={56} style={{ background: '#1F4E79', fontSize: 22, flexShrink: 0 }}>
            {userData?.nama?.[0]?.toUpperCase()}
          </Avatar>
          <div>
            <Text style={{ fontWeight: 600, fontSize: 16, display: 'block' }}>
              {userData?.nama}
            </Text>
            <Text type="secondary" style={{ fontSize: 13 }}>{userData?.email}</Text>
            <div style={{ marginTop: 4 }}>
              <Tag color={userData?.role === 'admin' ? 'gold' : 'blue'}>
                {userData?.role?.toUpperCase()}
              </Tag>
            </div>
          </div>
        </Space>
      </Card>

      {/* Ubah Nama */}
      <Card
        title={<Space><UserOutlined style={{ color: '#1F4E79' }} /><span>Ubah Nama</span></Space>}
        style={{ marginBottom: 16, maxWidth: 520 }}
      >
        <Form form={profileForm} layout="vertical">
          <Form.Item
            name="nama"
            label="Nama Lengkap"
            rules={[{ required: true, message: 'Nama wajib diisi' }]}
          >
            <Input prefix={<UserOutlined />} placeholder="Nama lengkap" size="large" />
          </Form.Item>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            size="large"
            loading={savingProfile}
            onClick={handleSaveProfile}
            style={{ background: '#1F4E79', borderColor: '#1F4E79' }}
          >
            Simpan Nama
          </Button>
        </Form>
      </Card>

      {/* Ubah Password */}
      <Card
        title={<Space><LockOutlined style={{ color: '#1F4E79' }} /><span>Ubah Password</span></Space>}
        style={{ maxWidth: 520 }}
      >
        <Form form={passwordForm} layout="vertical">
          <Form.Item
            name="currentPassword"
            label="Password Saat Ini"
            rules={[{ required: true, message: 'Masukkan password saat ini' }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="Password lama" size="large" />
          </Form.Item>
          <Form.Item
            name="newPassword"
            label="Password Baru"
            rules={[{ required: true, min: 6, message: 'Password minimal 6 karakter' }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="Password baru" size="large" />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            label="Konfirmasi Password Baru"
            rules={[{ required: true, message: 'Konfirmasi password wajib diisi' }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="Ulangi password baru" size="large" />
          </Form.Item>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            size="large"
            loading={savingPassword}
            onClick={handleSavePassword}
            style={{ background: '#1F4E79', borderColor: '#1F4E79' }}
          >
            Simpan Password
          </Button>
        </Form>
      </Card>
    </div>
  );
}