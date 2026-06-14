'use client';

import React, { useEffect, useState } from 'react';
import {
  Row, Col, Card, Statistic, Table, Tag, Avatar,
  Typography, Space, Skeleton, Badge,
} from 'antd';
import {
  TeamOutlined, ClockCircleOutlined,
  CheckCircleOutlined, DollarOutlined,
  ArrowUpOutlined,
} from '@ant-design/icons';
import { collection, getDocs } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import type { ColumnsType } from 'antd/es/table';

const { Text } = Typography;

interface Lead {
  id: string;
  nama: string;
  hp?: string;
  project?: string;
  sumber?: string;
  status: string;
  assignedTo?: string;
  createdAt?: any;
}

interface Stats {
  total: number;
  followUp: number;
  booking: number;
  closing: number;
}

const statusConfig: Record<string, { color: string; label: string }> = {
  baru:     { color: 'blue',    label: 'Baru' },
  followup: { color: 'orange',  label: 'Follow Up' },
  booking:  { color: 'purple',  label: 'Booking' },
  closing:  { color: 'success', label: 'Closing' },
  lost:     { color: 'red',     label: 'Lost' },
};

const normalizeStatus = (s: string) => s?.toLowerCase().replace(/\s+/g, '') ?? '';

function StatCard({ title, value, icon, borderColor, trend }: {
  title: string;
  value: number;
  icon: React.ReactNode;
  borderColor: string;
  trend?: number;
}) {
  return (
    <Card
      style={{ borderLeft: `4px solid ${borderColor}` }}
      styles={{ body: { padding: '20px 24px' } }}
    >
      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
        <div>
          <Text type="secondary" style={{ fontSize: 13 }}>{title}</Text>
          <Statistic
            value={value}
            styles={{ content: { fontWeight: 700, fontSize: 28, color: '#1E293B' } }}
            style={{ marginTop: 4 }}
          />
          {trend !== undefined && (
            <Text style={{ fontSize: 12, color: '#10B981' }}>
              <ArrowUpOutlined /> {trend}% this month
            </Text>
          )}
        </div>
        <div style={{
          width: 52, height: 52, borderRadius: 12,
          background: `${borderColor}18`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, color: borderColor,
        }}>
          {icon}
        </div>
      </Space>
    </Card>
  );
}

export default function DashboardPage() {
  const [stats, setStats]        = useState<Stats>({ total: 0, followUp: 0, booking: 0, closing: 0 });
  const [recentLeads, setRecent] = useState<Lead[]>([]);
  const [loading, setLoading]    = useState(true);
  const user                     = auth.currentUser;

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const snap  = await getDocs(collection(db, 'leads'));
      const leads = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Lead[];

      const s: Stats = { total: 0, followUp: 0, booking: 0, closing: 0 };
      leads.forEach(l => {
        s.total++;
        const ns = normalizeStatus(l.status);
        if (ns === 'followup') s.followUp++;
        if (ns === 'booking')  s.booking++;
        if (ns === 'closing')  s.closing++;
      });
      setStats(s);

      const sorted = [...leads]
        .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0))
        .slice(0, 5);
      setRecent(sorted);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const columns: ColumnsType<Lead> = [
    {
      title: 'Nama',
      dataIndex: 'nama',
      key: 'nama',
      render: (nama: string) => (
        <Space>
          <Avatar size={32} style={{ background: '#1F4E79', fontSize: 13 }}>
            {nama?.[0]?.toUpperCase() ?? '?'}
          </Avatar>
          <Text style={{ fontWeight: 500 }}>{nama}</Text>
        </Space>
      ),
    },
    {
      title: 'Project',
      dataIndex: 'project',
      key: 'project',
      render: (p: string) => <Text type="secondary">{p ?? '—'}</Text>,
    },
    {
      title: 'Sumber',
      dataIndex: 'sumber',
      key: 'sumber',
      render: (s: string) => <Text type="secondary">{s ?? '—'}</Text>,
      responsive: ['md'],
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => {
        const cfg = statusConfig[normalizeStatus(s)] ?? { color: 'default', label: s };
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
  ];

  return (
    <div className="sh-page">
      <div style={{ marginBottom: 24 }}>
        <div className="sh-page-title">Dashboard</div>
        <div className="sh-page-subtitle">Welcome back, {user?.displayName ?? 'Admin'} 👋</div>
      </div>

      {loading ? (
        <Row gutter={[16, 16]}>
          {[1,2,3,4].map(i => <Col key={i} xs={24} sm={12} xl={6}><Card><Skeleton active /></Card></Col>)}
        </Row>
      ) : (
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={12} xl={6}>
            <StatCard title="Total Leads" value={stats.total}    icon={<TeamOutlined />}        borderColor="#1F4E79" trend={12} />
          </Col>
          <Col xs={24} sm={12} xl={6}>
            <StatCard title="Follow Up"   value={stats.followUp} icon={<ClockCircleOutlined />} borderColor="#F59E0B" />
          </Col>
          <Col xs={24} sm={12} xl={6}>
            <StatCard title="Booking"     value={stats.booking}  icon={<CheckCircleOutlined />} borderColor="#8B5CF6" />
          </Col>
          <Col xs={24} sm={12} xl={6}>
            <StatCard title="Closing"     value={stats.closing}  icon={<DollarOutlined />}      borderColor="#10B981" trend={8} />
          </Col>
        </Row>
      )}

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={16}>
          <Card
            title={
              <Space>
                <TeamOutlined style={{ color: '#1F4E79' }} />
                <span style={{ fontWeight: 600 }}>Recent Leads</span>
              </Space>
            }
            extra={<a href="/leads" style={{ color: '#1F4E79', fontSize: 13 }}>View all →</a>}
          >
            <Table
              columns={columns}
              dataSource={recentLeads}
              rowKey="id"
              pagination={false}
              loading={loading}
              size="small"
            />
          </Card>
        </Col>

        <Col xs={24} xl={8}>
          <Card
            title={
              <Space>
                <Badge color="#C9A66B" />
                <span style={{ fontWeight: 600 }}>Lead Status Distribution</span>
              </Space>
            }
            style={{ height: '100%' }}
          >
            {[
              { label: 'Baru',      value: recentLeads.filter(l => normalizeStatus(l.status) === 'baru').length, color: '#3B82F6' },
              { label: 'Follow Up', value: stats.followUp, color: '#F59E0B' },
              { label: 'Booking',   value: stats.booking,  color: '#8B5CF6' },
              { label: 'Closing',   value: stats.closing,  color: '#10B981' },
            ].map(item => (
              <div key={item.label} style={{ marginBottom: 16 }}>
                <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={{ fontSize: 13 }}>{item.label}</Text>
                  <Text strong>{item.value}</Text>
                </Space>
                <div style={{ height: 6, borderRadius: 3, background: '#F1F5F9', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: stats.total ? `${Math.round((item.value / stats.total) * 100)}%` : '0%',
                    background: item.color,
                    borderRadius: 3,
                    transition: 'width 0.6s ease',
                  }} />
                </div>
              </div>
            ))}
          </Card>
        </Col>
      </Row>
    </div>
  );
}