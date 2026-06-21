'use client';

import React, { useState, useEffect } from 'react';
import { requestNotificationPermission } from '@/lib/fcm';
import {
  Layout, Menu, Avatar, Dropdown, Badge, Button, Drawer,
  Typography, Space, Tag,
} from 'antd';
import {
  DashboardOutlined,
  TeamOutlined,
  AppstoreOutlined,
  BarChartOutlined,
  SettingOutlined,
  LogoutOutlined,
  BellOutlined,
  MenuOutlined,
  UserOutlined,
  FileTextOutlined,
  DollarOutlined,
  UsergroupAddOutlined,
  HistoryOutlined,
  ThunderboltOutlined,
  InboxOutlined,
  BankOutlined,
} from '@ant-design/icons';
import { useRouter, usePathname } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

const { Sider, Header, Content } = Layout;
const { Text } = Typography;

interface UserProfile {
  nama: string;
  email: string;
  role: 'admin' | 'sales' | string;
  photoURL?: string;
}

interface LayoutSalesHubProps {
  children: React.ReactNode;
}

const adminMenuItems = [
  { key: '/dashboard',     icon: <DashboardOutlined />,    label: 'Dashboard' },
  { key: '/leads',         icon: <TeamOutlined />,          label: 'Leads' },
  { key: '/projects',      icon: <AppstoreOutlined />,      label: 'Projects' },
  { key: '/sales',         icon: <UsergroupAddOutlined />,  label: 'Sales' },
  { key: '/report',        icon: <BarChartOutlined />,      label: 'Reports' },
  { key: '/response-time', icon: <ThunderboltOutlined />,   label: 'Response Time' },
  { key: '/activity-log',  icon: <HistoryOutlined />,       label: 'Activity Log' },
  { key: '/settings',      icon: <SettingOutlined />,       label: 'Settings' },
];

const salesMenuItems = [
  { key: '/inbox',    icon: <InboxOutlined />,      label: 'Leads Masuk' },
  { key: '/leads',    icon: <FileTextOutlined />,   label: 'Lead Saya' },
  { key: '/profile',  icon: <UserOutlined />,       label: 'Profil Saya' },
];

const roleBadge: Record<string, string> = {
  admin: 'gold',
  sales: 'blue',
};

export default function LayoutSalesHub({ children }: LayoutSalesHubProps) {
  const router   = useRouter();
  const pathname = usePathname();
  const [user, setUser]           = useState<UserProfile | null>(null);
  const [drawerOpen, setDrawer]   = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      if (!firebaseUser) { router.push('/login'); return; }
      try {
        const snap = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (snap.exists()) {
          const userData = snap.data() as UserProfile;
          setUser(userData);
          requestNotificationPermission(firebaseUser.uid);
        } else {
          setUser({
            nama: firebaseUser.displayName ?? firebaseUser.email ?? 'User',
            email: firebaseUser.email ?? '',
            role: 'sales',
            photoURL: firebaseUser.photoURL ?? undefined,
          });
          requestNotificationPermission(firebaseUser.uid);
        }
      } catch {
        setUser({
          nama: firebaseUser.displayName ?? 'User',
          email: firebaseUser.email ?? '',
          role: 'sales',
        });
      }
    });
    return () => unsubscribe();
  }, [router]);

  const menuItems = !user
    ? []
    : user.role === 'admin'
      ? adminMenuItems
      : salesMenuItems;

  const handleMenuClick = ({ key }: { key: string }) => {
    router.push(key);
    setDrawer(false);
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/login');
  };

  const avatarDropdown = [
    {
      key: 'profile-info',
      label: (
        <div style={{ padding: '4px 0' }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{user?.nama}</div>
          <div style={{ fontSize: 12, color: '#64748B' }}>{user?.email}</div>
        </div>
      ),
      disabled: true,
    },
    { type: 'divider' as const },
    user?.role === 'admin'
      ? { key: 'settings', label: 'Settings', icon: <SettingOutlined /> }
      : { key: 'profile',  label: 'Profil Saya', icon: <UserOutlined /> },
    { key: 'logout', label: 'Logout', icon: <LogoutOutlined />, danger: true },
  ];

  const handleAvatarMenu = ({ key }: { key: string }) => {
    if (key === 'logout')   handleLogout();
    if (key === 'settings') router.push('/settings');
    if (key === 'profile')  router.push('/profile');
  };

  const SideMenu = () => (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid rgba(255,255,255,0.12)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8,
            background: '#C9A66B',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, color: '#fff', fontSize: 16, flexShrink: 0,
          }}>S</div>
          {!collapsed && (
            <div>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: 16, lineHeight: 1.2 }}>
                SalesHub
              </div>
              <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, fontStyle: 'italic' }}>
                Your Central Hub for Leads & Sales.
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{ flex: 1, padding: '12px 8px', overflow: 'auto' }}>
        <Menu
          mode="inline"
          theme="dark"
          selectedKeys={[pathname]}
          items={menuItems}
          onClick={handleMenuClick}
          style={{ background: 'transparent', border: 'none' }}
          inlineCollapsed={collapsed}
        />
      </div>

      <div style={{ padding: '12px 8px', borderTop: '1px solid rgba(255,255,255,0.12)' }}>
        <Menu
          mode="inline"
          theme="dark"
          items={[{ key: 'logout', icon: <LogoutOutlined />, label: 'Logout', danger: true }]}
          onClick={handleLogout}
          style={{ background: 'transparent', border: 'none' }}
          inlineCollapsed={collapsed}
        />
      </div>
    </div>
  );

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        width={240}
        collapsedWidth={64}
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        style={{
          background: '#1F4E79',
          position: 'fixed',
          left: 0, top: 0, bottom: 0,
          zIndex: 100,
          overflow: 'hidden',
        }}
        trigger={null}
        className="sh-sider-desktop"
      >
        <SideMenu />
      </Sider>

      <Layout
        style={{ marginLeft: collapsed ? 64 : 240, transition: 'margin-left 0.2s' }}
        className="sh-main-layout"
      >
        <Header style={{
          position: 'sticky', top: 0, zIndex: 99,
          background: '#fff',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 64,
          borderBottom: '1px solid #E2E8F0',
        }}>
          <Space>
            <Button type="text" icon={<MenuOutlined />} onClick={() => setCollapsed(!collapsed)} style={{ color: '#1F4E79' }} className="sh-desktop-toggle" />
          </Space>

          <Space size={16} align="center">
            <Badge count={0} size="small">
              <Button type="text" icon={<BellOutlined style={{ fontSize: 18 }} />} style={{ color: '#64748B' }} />
            </Badge>
            <Dropdown menu={{ items: avatarDropdown, onClick: handleAvatarMenu }} trigger={['click']} placement="bottomRight">
              <Space style={{ cursor: 'pointer' }} size={10}>
                <Avatar
                  src={user?.photoURL}
                  icon={!user?.photoURL && <UserOutlined />}
                  style={{ background: '#1F4E79', cursor: 'pointer' }}
                  size={36}
                />
                <div style={{ lineHeight: 1.3, display: 'flex', flexDirection: 'column' }} className="sh-user-info">
                  <Text style={{ fontWeight: 600, fontSize: 14, color: '#1E293B' }}>{user?.nama ?? '—'}</Text>
                  <Tag color={roleBadge[user?.role ?? ''] ?? 'default'} style={{ margin: 0, fontSize: 11, lineHeight: '18px' }}>
                    {user?.role?.toUpperCase() ?? '—'}
                  </Tag>
                </div>
              </Space>
            </Dropdown>
          </Space>
        </Header>

        <Content style={{ paddingBottom: 0 }} className="sh-content">{children}</Content>
      </Layout>

      {/* Bottom navigation bar — HANYA muncul di HP (layar < 768px) */}
      <nav className="sh-bottom-nav">
        {menuItems.map((item) => {
          const active = pathname === item.key;
          return (
            <button
              key={item.key}
              onClick={() => router.push(item.key)}
              className={`sh-bottom-item${active ? ' sh-bottom-item-active' : ''}`}
            >
              <span className="sh-bottom-icon">{item.icon}</span>
              <span className="sh-bottom-label">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <style jsx global>{`
        /* ===== DESKTOP (>= 768px) ===== */
        @media (min-width: 768px) {
          .sh-user-info { display: flex !important; }
          .sh-bottom-nav { display: none !important; }
        }

        /* ===== HP (< 768px) ===== */
        @media (max-width: 767px) {
          .sh-desktop-toggle { display: none !important; }
          .sh-sider-desktop { display: none !important; }
          .sh-main-layout { margin-left: 0 !important; }
          .sh-user-info { display: none !important; }

          /* Beri ruang di bawah konten supaya tidak ketutup bottom bar */
          .sh-content { padding-bottom: 72px !important; }

          .sh-bottom-nav {
            display: flex;
            position: fixed;
            left: 0; right: 0; bottom: 0;
            height: 64px;
            background: #1F4E79;
            border-top: 1px solid rgba(255, 255, 255, 0.12);
            z-index: 1000;
            box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.15);
            /* aman dari area gestur/notch HP */
            padding-bottom: env(safe-area-inset-bottom, 0px);
          }

          .sh-bottom-item {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 3px;
            background: transparent;
            border: none;
            outline: none;
            cursor: pointer;
            padding: 8px 4px;
            color: rgba(255, 255, 255, 0.6);
            transition: color 0.15s;
          }

          .sh-bottom-item-active {
            color: #C9A66B;
          }

          .sh-bottom-icon {
            font-size: 20px;
            line-height: 1;
          }

          .sh-bottom-label {
            font-size: 11px;
            line-height: 1;
            white-space: nowrap;
          }
        }
      `}</style>
    </Layout>
  );
}