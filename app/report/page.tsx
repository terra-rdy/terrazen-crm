'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  Row, Col, Card, Statistic, Tag, Select,
  Space, Typography, Skeleton, Button, DatePicker, Empty,
} from 'antd';
import {
  TeamOutlined, DollarOutlined, BarChartOutlined,
  TrophyOutlined, DownloadOutlined, CalendarOutlined,
  StopOutlined,
} from '@ant-design/icons';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import dayjs, { Dayjs } from 'dayjs';

const { Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

interface FollowUpEntry {
  id: string;
  status: string;
  notes: string;
  nextAction: string | null;
  lastUpdate: any;
  createdByNama: string;
  dropReason?: string;
}

interface Lead {
  id: string;
  nama: string;
  status: string;
  project?: string;
  sumber?: string;
  assignedTo?: string;
  hp?: string;
  catatan?: string;
  nextFollowUp?: string;
  createdAt?: any;
  dropReason?: string;
  followUpHistory?: FollowUpEntry[];
}

const STATUS_OPTIONS = ['baru', 'followup', 'booking', 'closing', 'lost', 'drop'];
const statusLabel: Record<string, string> = {
  baru: 'Baru', followup: 'Follow Up', booking: 'Booking',
  closing: 'Closing', lost: 'Lost', drop: 'Drop',
};
const statusColor: Record<string, string> = {
  baru: '#3B82F6', followup: '#F59E0B', booking: '#8B5CF6',
  closing: '#10B981', lost: '#EF4444', drop: '#94A3B8',
};
const COLORS = ['#1F4E79', '#C9A66B', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#3B82F6', '#94A3B8'];

const PERIODE_OPTIONS = [
  { label: 'Hari Ini',   value: 'today' },
  { label: 'Minggu Ini', value: 'week' },
  { label: 'Bulan Ini',  value: 'month' },
  { label: 'Bulan Lalu', value: 'lastmonth' },
  { label: '3 Bulan',    value: '3months' },
  { label: 'Tahun Ini',  value: 'year' },
  { label: 'Custom',     value: 'custom' },
];

export default function ReportPage() {
  const [leads, setLeads]           = useState<Lead[]>([]);
  const [loading, setLoad]          = useState(true);
  const [statusFilter, setStatusF]  = useState<string[]>([]);
  const [sourceFilter, setSourceF]  = useState<string[]>([]);
  const [salesFilter, setSalesF]    = useState<string[]>([]);
  const [periode, setPeriode]       = useState<string>('month');
  const [customRange, setCustom]    = useState<[Dayjs, Dayjs] | null>(null);
  const [salesNames, setSalesNames] = useState<Record<string, string>>({});

  useEffect(() => {
    getDocs(collection(db, 'leads'))
      .then(s => setLeads(s.docs.map(d => ({ id: d.id, ...d.data() })) as Lead[]))
      .catch(console.error)
      .finally(() => setLoad(false));

    getDocs(collection(db, 'users')).then(s => {
      const map: Record<string, string> = {};
      s.docs.forEach(d => {
        const data = d.data() as any;
        map[d.id] = data.nama ?? data.email ?? d.id;
      });
      setSalesNames(map);
    });
  }, []);

  const dateRange = useMemo((): [Dayjs, Dayjs] | null => {
    const now = dayjs();
    switch (periode) {
      case 'today':     return [now.startOf('day'), now.endOf('day')];
      case 'week':      return [now.startOf('week'), now.endOf('week')];
      case 'month':     return [now.startOf('month'), now.endOf('month')];
      case 'lastmonth': return [now.subtract(1, 'month').startOf('month'), now.subtract(1, 'month').endOf('month')];
      case '3months':   return [now.subtract(3, 'month').startOf('day'), now.endOf('day')];
      case 'year':      return [now.startOf('year'), now.endOf('year')];
      case 'custom':    return customRange;
      default:          return null;
    }
  }, [periode, customRange]);

  const filtered = useMemo(() => {
    return leads.filter(l => {
      const ns = l.status?.toLowerCase();
      if (statusFilter.length && !statusFilter.includes(ns)) return false;
      if (sourceFilter.length && !sourceFilter.includes(l.sumber ?? 'Unknown')) return false;
      if (salesFilter.length && !salesFilter.includes(l.assignedTo ?? 'Unknown')) return false;
      if (dateRange) {
        const createdAt = l.createdAt?.seconds ? dayjs.unix(l.createdAt.seconds) : null;
        if (!createdAt) return false;
        if (createdAt.isBefore(dateRange[0]) || createdAt.isAfter(dateRange[1])) return false;
      }
      return true;
    });
  }, [leads, statusFilter, sourceFilter, salesFilter, dateRange]);

  const allSources = [...new Set(leads.map(l => l.sumber ?? 'Unknown'))];
  const allSales   = [...new Set(leads.map(l => l.assignedTo ?? 'Unknown'))];

  // KPI
  const total    = filtered.length;
  const closing  = filtered.filter(l => l.status?.toLowerCase() === 'closing').length;
  const drop     = filtered.filter(l => l.status?.toLowerCase() === 'drop').length;
  const convRate = total ? ((closing / total) * 100).toFixed(1) : '0';

  // Chart: Status Distribution
  const statusChartData = STATUS_OPTIONS.map(s => ({
    name: statusLabel[s],
    value: filtered.filter(l => l.status?.toLowerCase() === s).length,
    color: statusColor[s],
  })).filter(d => d.value > 0);

  // Chart: Lead by Source
  const sourceMap: Record<string, number> = {};
  filtered.forEach(l => {
    const s = l.sumber ?? 'Unknown';
    sourceMap[s] = (sourceMap[s] ?? 0) + 1;
  });
  const sourceChartData = Object.entries(sourceMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // Chart: Lead per Sales
  const salesMap: Record<string, number> = {};
  filtered.forEach(l => {
    const uid = l.assignedTo ?? 'Unknown';
    const name = salesNames[uid] ?? uid;
    salesMap[name] = (salesMap[name] ?? 0) + 1;
  });
  const salesChartData = Object.entries(salesMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // Chart: Alasan Drop
  const dropLeads = filtered.filter(l => l.status?.toLowerCase() === 'drop');
  const dropReasonMap: Record<string, number> = {};
  dropLeads.forEach(l => {
    // Cari alasan drop dari followUpHistory atau field dropReason
    const alasan = l.dropReason ??
      l.followUpHistory?.find(f => f.dropReason)?.dropReason ??
      'Tidak disebutkan';
    dropReasonMap[alasan] = (dropReasonMap[alasan] ?? 0) + 1;
  });
  const dropChartData = Object.entries(dropReasonMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // Export Excel
  const handleExport = () => {
    const data = filtered.map(l => {
      // Ambil riwayat follow up sebagai teks
      const followUpText = (l.followUpHistory ?? [])
        .map(f => `[${f.lastUpdate ? dayjs(f.lastUpdate).format('DD/MM/YY HH:mm') : '—'}] ${f.status}${f.dropReason ? ` (${f.dropReason})` : ''}: ${f.notes || '-'}`)
        .join(' | ');

      return {
        'Nama'            : l.nama ?? '—',
        'No. HP'          : l.hp ?? '—',
        'Project'         : l.project ?? '—',
        'Sumber'          : l.sumber ?? '—',
        'Status'          : l.status ?? '—',
        'Alasan Drop'     : l.dropReason ?? '—',
        'Sales'           : salesNames[l.assignedTo ?? ''] ?? l.assignedTo ?? '—',
        'Next Follow Up'  : l.nextFollowUp ?? '—',
        'Catatan'         : l.catatan ?? '—',
        'Riwayat Follow Up': followUpText || '—',
        'Tanggal Masuk'   : l.createdAt?.seconds
          ? new Date(l.createdAt.seconds * 1000).toLocaleDateString('id-ID')
          : '—',
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);

    // Auto column width
    const colWidths = Object.keys(data[0] ?? {}).map(key => ({
      wch: Math.max(key.length, ...data.map(row => String((row as any)[key] ?? '').length).slice(0, 10))
    }));
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Leads');

    // Sheet khusus alasan drop
    if (dropChartData.length > 0) {
      const dropData = dropChartData.map(d => ({ 'Alasan Drop': d.name, 'Jumlah': d.value }));
      const wsDrop = XLSX.utils.json_to_sheet(dropData);
      XLSX.utils.book_append_sheet(wb, wsDrop, 'Alasan Drop');
    }

    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([buf], { type: 'application/octet-stream' }), `laporan-leads-${dayjs().format('YYYY-MM-DD')}.xlsx`);
  };

  return (
    <div className="sh-page">
      {/* Header */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 20 }}>
        <Col>
          <div className="sh-page-title">Reports</div>
          <div className="sh-page-subtitle">Ringkasan performa leads & sales</div>
        </Col>
        <Col>
          <Button
            icon={<DownloadOutlined />}
            onClick={handleExport}
            style={{ background: '#1F4E79', color: '#fff', fontWeight: 600 }}
            size="large"
          >
            Export Excel
          </Button>
        </Col>
      </Row>

      {/* Filter */}
      <Card style={{ marginBottom: 16 }} styles={{ body: { padding: '12px 16px' } }}>
        <Row gutter={[12, 12]}>
          <Col xs={24} sm={12} md={6}>
            <Select value={periode} onChange={setPeriode} style={{ width: '100%' }} suffixIcon={<CalendarOutlined />}>
              {PERIODE_OPTIONS.map(p => <Option key={p.value} value={p.value}>{p.label}</Option>)}
            </Select>
          </Col>
          {periode === 'custom' && (
            <Col xs={24} sm={12} md={6}>
              <RangePicker style={{ width: '100%' }} format="DD MMM YYYY" onChange={(dates) => {
                if (dates?.[0] && dates?.[1]) setCustom([dates[0], dates[1]]);
              }} />
            </Col>
          )}
          <Col xs={24} sm={8} md={periode === 'custom' ? 4 : 6}>
            <Select mode="multiple" placeholder="Filter Status" value={statusFilter} onChange={setStatusF} allowClear style={{ width: '100%' }}>
              {STATUS_OPTIONS.map(s => (
                <Option key={s} value={s}>
                  <Tag color={statusColor[s]} style={{ margin: 0 }}>{statusLabel[s]}</Tag>
                </Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} sm={8} md={periode === 'custom' ? 4 : 6}>
            <Select mode="multiple" placeholder="Filter Sumber" value={sourceFilter} onChange={setSourceF} allowClear style={{ width: '100%' }}>
              {allSources.map(s => <Option key={s} value={s}>{s}</Option>)}
            </Select>
          </Col>
          <Col xs={24} sm={8} md={periode === 'custom' ? 4 : 6}>
            <Select mode="multiple" placeholder="Filter Sales" value={salesFilter} onChange={setSalesF} allowClear style={{ width: '100%' }}>
              {allSales.map(s => <Option key={s} value={s}>{salesNames[s] ?? s}</Option>)}
            </Select>
          </Col>
        </Row>
      </Card>

      {/* KPI Cards */}
      {loading ? (
        <Row gutter={[16, 16]}>
          {[1,2,3,4].map(i => <Col key={i} xs={24} sm={12} xl={6}><Card><Skeleton active /></Card></Col>)}
        </Row>
      ) : (
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          {[
            { title: 'Total Leads',     value: total,            icon: <TeamOutlined />,     color: '#1F4E79', suffix: '' },
            { title: 'Closing',         value: closing,          icon: <DollarOutlined />,   color: '#10B981', suffix: '' },
            { title: 'Drop',            value: drop,             icon: <StopOutlined />,     color: '#94A3B8', suffix: '' },
            { title: 'Conversion Rate', value: Number(convRate), icon: <TrophyOutlined />,   color: '#C9A66B', suffix: '%' },
          ].map(item => (
            <Col key={item.title} xs={24} sm={12} xl={6}>
              <Card style={{ borderLeft: `4px solid ${item.color}` }}>
                <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                  <div>
                    <Text type="secondary" style={{ fontSize: 13 }}>{item.title}</Text>
                    <Statistic value={item.value} suffix={item.suffix} styles={{ content: { fontWeight: 700, fontSize: 28, color: '#1E293B' } }} />
                  </div>
                  <div style={{ width: 48, height: 48, borderRadius: 10, background: `${item.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: item.color }}>
                    {item.icon}
                  </div>
                </Space>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {/* Charts Row 1 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} xl={10}>
          <Card title={<span style={{ fontWeight: 600 }}>Status Distribution</span>} style={{ height: 320 }}>
            {statusChartData.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Tidak ada data" style={{ paddingTop: 40 }} />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={statusChartData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                    {statusChartData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </Card>
        </Col>
        <Col xs={24} xl={14}>
          <Card title={<span style={{ fontWeight: 600 }}>Lead by Source</span>} style={{ height: 320 }}>
            {sourceChartData.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Tidak ada data" style={{ paddingTop: 40 }} />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={sourceChartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="value" name="Jumlah Lead" radius={[4, 4, 0, 0]}>
                    {sourceChartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
        </Col>
      </Row>

      {/* Charts Row 2 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} xl={14}>
          <Card title={<span style={{ fontWeight: 600 }}>Lead per Sales</span>}>
            {salesChartData.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Tidak ada data" style={{ paddingTop: 40 }} />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={salesChartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="value" name="Jumlah Lead" radius={[4, 4, 0, 0]}>
                    {salesChartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
        </Col>

        {/* ── GRAFIK ALASAN DROP ── */}
        <Col xs={24} xl={10}>
          <Card
            title={
              <Space>
                <StopOutlined style={{ color: '#94A3B8' }} />
                <span style={{ fontWeight: 600 }}>Alasan Drop</span>
                {dropLeads.length > 0 && (
                  <Tag color="default">{dropLeads.length} leads</Tag>
                )}
              </Space>
            }
            style={{ borderTop: '3px solid #94A3B8' }}
          >
            {dropChartData.length === 0 ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={<Text type="secondary">Belum ada leads yang di-drop</Text>}
                style={{ paddingTop: 40 }}
              />
            ) : (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart
                    data={dropChartData}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
                  >
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fontSize: 11 }}
                      width={130}
                    />
                    <Tooltip />
                    <Bar dataKey="value" name="Jumlah" radius={[0, 4, 4, 0]}>
                      {dropChartData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>

                {/* Detail list */}
                <div style={{ marginTop: 8 }}>
                  {dropChartData.map((item, i) => (
                    <div key={item.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: i < dropChartData.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                      <Text style={{ fontSize: 12 }}>{item.name}</Text>
                      <Space size={4}>
                        <Tag color="default" style={{ margin: 0, fontSize: 11 }}>{item.value}</Tag>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          ({dropLeads.length ? Math.round((item.value / dropLeads.length) * 100) : 0}%)
                        </Text>
                      </Space>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}