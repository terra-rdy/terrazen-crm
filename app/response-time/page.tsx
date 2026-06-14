'use client';

import React, { useEffect, useState } from 'react';
import {
  Card, Table, Tag, Typography, Space, Avatar,
  Row, Col, Statistic, Select, DatePicker, Button,
} from 'antd';
import {
  ClockCircleOutlined, WhatsAppOutlined,
  TeamOutlined, ThunderboltOutlined, DownloadOutlined,
} from '@ant-design/icons';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import type { ColumnsType } from 'antd/es/table';
import dayjs, { Dayjs } from 'dayjs';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

const { Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

interface Lead {
  id: string;
  nama: string;
  hp?: string;
  project?: string;
  assignedTo?: string;
  status?: string;
  createdAt?: any;
  firstOpenedAt?: any;
  waClickedAt?: any;
}

interface SalesUser {
  id: string;
  nama: string;
  email: string;
  role: string;
}

const formatTs = (ts: any) => {
  if (!ts) return '—';
  const date = ts?.toDate ? ts.toDate() : new Date(ts.seconds * 1000);
  return dayjs(date).format('DD MMM YYYY HH:mm');
};

const diffMenit = (ts1: any, ts2: any): number | null => {
  if (!ts1 || !ts2) return null;
  const d1 = ts1?.toDate ? ts1.toDate() : new Date(ts1.seconds * 1000);
  const d2 = ts2?.toDate ? ts2.toDate() : new Date(ts2.seconds * 1000);
  return Math.floor(Math.abs(d2.getTime() - d1.getTime()) / 60000);
};

const formatMenit = (menit: number | null): string => {
  if (menit === null) return '—';
  if (menit < 60) return `${menit} mnt`;
  const jam = Math.floor(menit / 60);
  const sisa = menit % 60;
  return `${jam}j ${sisa}mnt`;
};

const getResponseColor = (menit: number | null): string => {
  if (menit === null) return 'default';
  if (menit <= 15) return 'success';
  if (menit <= 60) return 'warning';
  return 'error';
};

export default function ResponseTimePage() {
  const [leads, setLeads]         = useState<Lead[]>([]);
  const [salesList, setSalesList] = useState<SalesUser[]>([]);
  const [loading, setLoading]     = useState(true);
  const [salesFilter, setSalesF]  = useState<string>('');
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null);
  const router                    = useRouter();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      if (!firebaseUser) { router.push('/login'); return; }

      const userSnap = await getDocs(collection(db, 'users'));
      const users = userSnap.docs.map(d => ({ id: d.id, ...d.data() })) as SalesUser[];
      const me = users.find(u => u.id === firebaseUser.uid);

      if (me?.role !== 'admin') { router.push('/forbidden'); return; }

      setSalesList(users.filter(u => u.role === 'sales'));

      const leadSnap = await getDocs(query(collection(db, 'leads'), orderBy('createdAt', 'desc')));
      setLeads(leadSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Lead[]);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  // Filter
  const filtered = leads.filter(l => {
    if (salesFilter && l.assignedTo !== salesFilter) return false;
    if (dateRange) {
      const createdAt = l.createdAt?.seconds ? dayjs.unix(l.createdAt.seconds) : null;
      if (!createdAt) return false;
      if (createdAt.isBefore(dateRange[0].startOf('day')) || createdAt.isAfter(dateRange[1].endOf('day'))) return false;
    }
    return true;
  });

  const getSalesName = (uid: string) => salesList.find(u => u.id === uid)?.nama ?? uid ?? '—';

  // Summary per sales
  const salesSummary = salesList.map(s => {
    const myLeads = filtered.filter(l => l.assignedTo === s.id);
    const opened  = myLeads.filter(l => l.firstOpenedAt);
    const waChatted = myLeads.filter(l => l.waClickedAt);

    const avgOpen = opened.length
      ? Math.floor(opened.reduce((acc, l) => acc + (diffMenit(l.createdAt, l.firstOpenedAt) ?? 0), 0) / opened.length)
      : null;

    const avgWA = waChatted.length
      ? Math.floor(waChatted.reduce((acc, l) => acc + (diffMenit(l.createdAt, l.waClickedAt) ?? 0), 0) / waChatted.length)
      : null;

    return {
      id: s.id,
      nama: s.nama,
      totalLeads: myLeads.length,
      belumDibuka: myLeads.filter(l => !l.firstOpenedAt).length,
      belumWA: myLeads.filter(l => !l.waClickedAt).length,
      avgOpen,
      avgWA,
    };
  }).filter(s => s.totalLeads > 0);

  // KPI
  const totalLeads    = filtered.length;
  const belumDibuka   = filtered.filter(l => !l.firstOpenedAt).length;
  const belumWA       = filtered.filter(l => !l.waClickedAt).length;
  const sudahWA       = filtered.filter(l => l.waClickedAt).length;

  // Export Excel
  const handleExport = () => {
    const data = filtered.map(l => {
      const openTime  = diffMenit(l.createdAt, l.firstOpenedAt);
      const waTime    = diffMenit(l.createdAt, l.waClickedAt);
      return {
        'Nama Lead'        : l.nama ?? '—',
        'No. HP'           : l.hp ?? '—',
        'Project'          : l.project ?? '—',
        'Sales'            : getSalesName(l.assignedTo ?? ''),
        'Status'           : l.status ?? '—',
        'Lead Masuk'       : formatTs(l.createdAt),
        'Pertama Dibuka'   : formatTs(l.firstOpenedAt),
        'Response Time'    : formatMenit(openTime),
        'WA Diklik'        : formatTs(l.waClickedAt),
        'WA Response Time' : formatMenit(waTime),
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Response Time');
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([buf], { type: 'application/octet-stream' }), `response-time-${dayjs().format('YYYY-MM-DD')}.xlsx`);
  };

  // Kolom detail per lead
  const leadCols: ColumnsType<Lead> = [
    {
      title: 'Lead',
      key: 'lead',
      render: (_: any, r: Lead) => (
        <div>
          <Text strong>{r.nama}</Text>
          <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>{r.project ?? '—'}</Text>
        </div>
      ),
    },
    {
      title: 'Sales',
      key: 'sales',
      render: (_: any, r: Lead) => <Text>{getSalesName(r.assignedTo ?? '')}</Text>,
      responsive: ['sm'],
    },
    {
      title: 'Lead Masuk',
      key: 'createdAt',
      render: (_: any, r: Lead) => <Text style={{ fontSize: 12 }}>{formatTs(r.createdAt)}</Text>,
      responsive: ['md'],
    },
    {
      title: 'Dibuka',
      key: 'firstOpened',
      render: (_: any, r: Lead) => {
        const menit = diffMenit(r.createdAt, r.firstOpenedAt);
        return r.firstOpenedAt ? (
          <div>
            <Tag color={getResponseColor(menit)}>{formatMenit(menit)}</Tag>
            <Text type="secondary" style={{ display: 'block', fontSize: 11 }}>{formatTs(r.firstOpenedAt)}</Text>
          </div>
        ) : <Tag color="default">Belum dibuka</Tag>;
      },
    },
    {
      title: 'Chat WA',
      key: 'waClicked',
      render: (_: any, r: Lead) => {
        const menit = diffMenit(r.createdAt, r.waClickedAt);
        return r.waClickedAt ? (
          <div>
            <Tag color={getResponseColor(menit)} icon={<WhatsAppOutlined />}>{formatMenit(menit)}</Tag>
            <Text type="secondary" style={{ display: 'block', fontSize: 11 }}>{formatTs(r.waClickedAt)}</Text>
          </div>
        ) : <Tag color="default">Belum chat</Tag>;
      },
    },
  ];

  // Kolom summary per sales
  const summaryCols: ColumnsType<typeof salesSummary[0]> = [
    {
      title: 'Sales',
      key: 'nama',
      render: (_: any, r: any) => (
        <Space>
          <Avatar size={32} style={{ background: '#1F4E79' }}>{r.nama?.[0]?.toUpperCase()}</Avatar>
          <Text strong>{r.nama}</Text>
        </Space>
      ),
    },
    { title: 'Total Lead', dataIndex: 'totalLeads', key: 'totalLeads', align: 'center' },
    {
      title: 'Belum Dibuka',
      dataIndex: 'belumDibuka',
      key: 'belumDibuka',
      align: 'center',
      render: (v: number) => <Tag color={v > 0 ? 'error' : 'success'}>{v}</Tag>,
    },
    {
      title: 'Avg. Buka Lead',
      key: 'avgOpen',
      align: 'center',
      render: (_: any, r: any) => (
        <Tag color={getResponseColor(r.avgOpen)}>{formatMenit(r.avgOpen)}</Tag>
      ),
    },
    {
      title: 'Belum WA',
      dataIndex: 'belumWA',
      key: 'belumWA',
      align: 'center',
      render: (v: number) => <Tag color={v > 0 ? 'warning' : 'success'}>{v}</Tag>,
    },
    {
      title: 'Avg. Chat WA',
      key: 'avgWA',
      align: 'center',
      render: (_: any, r: any) => (
        <Tag color={getResponseColor(r.avgWA)} icon={<WhatsAppOutlined />}>{formatMenit(r.avgWA)}</Tag>
      ),
    },
  ];

  return (
    <div className="sh-page">
      {/* Header */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 20 }}>
        <Col>
          <div className="sh-page-title">Response Time</div>
          <div className="sh-page-subtitle">Pantau kecepatan sales merespon leads</div>
        </Col>
        <Col>
          <Button icon={<DownloadOutlined />} onClick={handleExport} style={{ background: '#1F4E79', color: '#fff', fontWeight: 600 }} size="large">
            Export Excel
          </Button>
        </Col>
      </Row>

      {/* Filter */}
      <Card style={{ marginBottom: 16 }} styles={{ body: { padding: '12px 16px' } }}>
        <Row gutter={12}>
          <Col xs={24} sm={12}>
            <Select placeholder="Filter Sales" value={salesFilter || undefined} onChange={v => setSalesF(v ?? '')} allowClear style={{ width: '100%' }}>
              {salesList.map(s => <Option key={s.id} value={s.id}>{s.nama}</Option>)}
            </Select>
          </Col>
          <Col xs={24} sm={12}>
            <RangePicker
              style={{ width: '100%' }}
              format="DD MMM YYYY"
              onChange={(dates) => {
                if (dates?.[0] && dates?.[1]) setDateRange([dates[0], dates[1]]);
                else setDateRange(null);
              }}
            />
          </Col>
        </Row>
      </Card>

      {/* KPI */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        {[
          { label: 'Total Leads', value: totalLeads, color: '#1F4E79', icon: <TeamOutlined /> },
          { label: 'Belum Dibuka', value: belumDibuka, color: '#EF4444', icon: <ClockCircleOutlined /> },
          { label: 'Belum Chat WA', value: belumWA, color: '#F59E0B', icon: <WhatsAppOutlined /> },
          { label: 'Sudah Chat WA', value: sudahWA, color: '#10B981', icon: <ThunderboltOutlined /> },
        ].map(item => (
          <Col key={item.label} xs={24} sm={12} xl={6}>
            <Card style={{ borderLeft: `4px solid ${item.color}` }} styles={{ body: { padding: '16px 20px' } }}>
              <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                <div>
                  <Text type="secondary" style={{ fontSize: 13 }}>{item.label}</Text>
                  <Statistic value={item.value} styles={{ content: { fontWeight: 700, fontSize: 28, color: '#1E293B' } }} />
                </div>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: `${item.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: item.color }}>
                  {item.icon}
                </div>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Rekap per Sales */}
      <Card
        title={<Space><TeamOutlined style={{ color: '#1F4E79' }} /><span style={{ fontWeight: 600 }}>Rekap per Sales</span></Space>}
        style={{ marginBottom: 16 }}
      >
        <Table
          columns={summaryCols}
          dataSource={salesSummary}
          rowKey="id"
          pagination={false}
          size="small"
          loading={loading}
        />
        <div style={{ marginTop: 12, fontSize: 12, color: '#94A3B8' }}>
          🟢 ≤15 mnt &nbsp;|&nbsp; 🟡 ≤60 mnt &nbsp;|&nbsp; 🔴 &gt;60 mnt
        </div>
      </Card>

      {/* Detail per Lead */}
      <Card title={<Space><ClockCircleOutlined style={{ color: '#1F4E79' }} /><span style={{ fontWeight: 600 }}>Detail per Lead</span></Space>}>
        <Table
          columns={leadCols}
          dataSource={filtered}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 15, showSizeChanger: false, showTotal: t => `${t} leads` }}
          size="small"
        />
      </Card>
    </div>
  );
}