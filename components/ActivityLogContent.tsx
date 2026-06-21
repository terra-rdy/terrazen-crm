'use client';

import { useEffect, useState } from 'react';
import {
  Card, Table, Tag, Typography, Space, Avatar, Skeleton, Select, Input, Row, Col,
} from 'antd';
import {
  SearchOutlined, FilterOutlined,
} from '@ant-design/icons';
import { db } from '@/lib/firebase';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';

const { Text } = Typography;
const { Option } = Select;

interface ActivityLog {
  id: string;
  action: string;
  userId?: string;
  userNama?: string;
  userRole?: string;
  target?: string;
  detail?: string;
  createdAt?: any;
}

const actionColor: Record<string, string> = {
  'tambah_lead'   : 'green',
  'edit_lead'     : 'blue',
  'hapus_lead'    : 'red',
  'login'         : 'purple',
  'logout'        : 'default',
  'reset_password': 'orange',
  'tambah_user'   : 'cyan',
  'edit_user'     : 'geekblue',
};

export default function ActivityLogContent() {
  const [logs, setLogs]         = useState<ActivityLog[]>([]);
  const [filtered, setFiltered] = useState<ActivityLog[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [actionFilter, setActionFilter] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const q = query(collection(db, 'activity_logs'), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() })) as ActivityLog[];
        setLogs(data);
        setFiltered(data);
      } catch {
        const snap = await getDocs(collection(db, 'activity_logs'));
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() })) as ActivityLog[];
        setLogs(data);
        setFiltered(data);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    let data = [...logs];
    if (search) {
      const s = search.toLowerCase();
      data = data.filter(l =>
        l.userNama?.toLowerCase().includes(s) ||
        l.action?.toLowerCase().includes(s) ||
        l.detail?.toLowerCase().includes(s)
      );
    }
    if (actionFilter) {
      data = data.filter(l => l.action === actionFilter);
    }
    setFiltered(data);
  }, [logs, search, actionFilter]);

  const allActions = [...new Set(logs.map(l => l.action).filter(Boolean))];

  const columns: ColumnsType<ActivityLog> = [
    {
      title: 'User',
      key: 'user',
      render: (_: any, r: ActivityLog) => (
        <Space>
          <Avatar size={32} style={{ background: '#1F4E79', fontSize: 12, flexShrink: 0 }}>
            {r.userNama?.[0]?.toUpperCase() ?? 'U'}
          </Avatar>
          <div>
            <Text style={{ fontWeight: 500, display: 'block' }}>{r.userNama ?? '—'}</Text>
            <Tag color={r.userRole === 'admin' ? 'gold' : 'blue'} style={{ fontSize: 10 }}>
              {r.userRole?.toUpperCase() ?? '—'}
            </Tag>
          </div>
        </Space>
      ),
    },
    {
      title: 'Aksi',
      dataIndex: 'action',
      key: 'action',
      render: (action: string) => (
        <Tag color={actionColor[action] ?? 'default'}>
          {action?.replace(/_/g, ' ').toUpperCase() ?? '—'}
        </Tag>
      ),
    },
    {
      title: 'Detail',
      dataIndex: 'detail',
      key: 'detail',
      render: (d: string) => <Text type="secondary">{d ?? '—'}</Text>,
      responsive: ['md'],
    },
    {
      title: 'Waktu',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (t: any) => {
        if (!t) return <Text type="secondary">—</Text>;
        const date = t?.toDate ? t.toDate() : new Date(t.seconds * 1000);
        return (
          <div>
            <Text style={{ display: 'block', fontSize: 13 }}>{dayjs(date).format('DD MMM YYYY')}</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>{dayjs(date).format('HH:mm')}</Text>
          </div>
        );
      },
      responsive: ['sm'],
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Text type="secondary">{filtered.length} aktivitas tercatat</Text>
      </div>

      <Card style={{ marginBottom: 16 }} styles={{ body: { padding: '12px 16px' } }}>
        <Row gutter={12}>
          <Col xs={24} sm={14} md={16}>
            <Input
              prefix={<SearchOutlined style={{ color: '#64748B' }} />}
              placeholder="Cari user atau detail aktivitas..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={24} sm={10} md={8}>
            <Select
              placeholder="Filter aksi"
              value={actionFilter || undefined}
              onChange={v => setActionFilter(v ?? '')}
              allowClear
              style={{ width: '100%' }}
              suffixIcon={<FilterOutlined />}
            >
              {allActions.map(a => (
                <Option key={a} value={a}>
                  <Tag color={actionColor[a] ?? 'default'} style={{ margin: 0 }}>
                    {a?.replace(/_/g, ' ').toUpperCase()}
                  </Tag>
                </Option>
              ))}
            </Select>
          </Col>
        </Row>
      </Card>

      <Card styles={{ body: { padding: 0 } }}>
        {loading ? (
          <div style={{ padding: 24 }}><Skeleton active paragraph={{ rows: 6 }} /></div>
        ) : (
          <Table
            columns={columns}
            dataSource={filtered}
            rowKey="id"
            pagination={{ pageSize: 15, showSizeChanger: false, showTotal: t => `${t} aktivitas` }}
            size="middle"
            style={{ borderRadius: 12, overflow: 'hidden' }}
            locale={{ emptyText: 'Belum ada aktivitas tercatat' }}
          />
        )}
      </Card>
    </div>
  );
}