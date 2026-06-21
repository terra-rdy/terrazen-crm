'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  Row, Col, Card, Statistic, Tag, Select,
  Space, Typography, Skeleton, Button, DatePicker, Empty,
  Modal, Checkbox, message,
} from 'antd';
import {
  TeamOutlined, DollarOutlined,
  TrophyOutlined, DownloadOutlined, CalendarOutlined,
  StopOutlined,
} from '@ant-design/icons';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import dayjs, { Dayjs } from 'dayjs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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

export default function PerformaContent() {
  const [leads, setLeads]           = useState<Lead[]>([]);
  const [loading, setLoad]          = useState(true);
  const [statusFilter, setStatusF]  = useState<string[]>([]);
  const [sourceFilter, setSourceF]  = useState<string[]>([]);
  const [salesFilter, setSalesF]    = useState<string[]>([]);
  const [periode, setPeriode]       = useState<string>('month');
  const [customRange, setCustom]    = useState<[Dayjs, Dayjs] | null>(null);
  const [salesNames, setSalesNames] = useState<Record<string, string>>({});

  // State popup export
  const [exportModalOpen, setExportModal] = useState(false);
  const [exportPilihan, setExportPilihan] = useState<string[]>(['mentah', 'source', 'sales', 'drop']);

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

  const total    = filtered.length;
  const closing  = filtered.filter(l => l.status?.toLowerCase() === 'closing').length;
  const drop     = filtered.filter(l => l.status?.toLowerCase() === 'drop').length;
  const convRate = total ? ((closing / total) * 100).toFixed(1) : '0';

  const statusChartData = STATUS_OPTIONS.map(s => ({
    name: statusLabel[s],
    value: filtered.filter(l => l.status?.toLowerCase() === s).length,
    color: statusColor[s],
  })).filter(d => d.value > 0);

  const sourceMap: Record<string, number> = {};
  filtered.forEach(l => {
    const s = l.sumber ?? 'Unknown';
    sourceMap[s] = (sourceMap[s] ?? 0) + 1;
  });
  const sourceChartData = Object.entries(sourceMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const salesMap: Record<string, number> = {};
  filtered.forEach(l => {
    const uid = l.assignedTo ?? 'Unknown';
    const name = salesNames[uid] ?? uid;
    salesMap[name] = (salesMap[name] ?? 0) + 1;
  });
  const salesChartData = Object.entries(salesMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const dropLeads = filtered.filter(l => l.status?.toLowerCase() === 'drop');
  const dropReasonMap: Record<string, number> = {};
  dropLeads.forEach(l => {
    const alasan = l.dropReason ??
      l.followUpHistory?.find(f => f.dropReason)?.dropReason ??
      'Tidak disebutkan';
    dropReasonMap[alasan] = (dropReasonMap[alasan] ?? 0) + 1;
  });
  const dropChartData = Object.entries(dropReasonMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // Rekap By Source (sumber) — jumlah + persen
  const totalForPct = filtered.length || 1;
  const sourceRekap = sourceChartData.map(d => ({
    'Sumber': d.name,
    'Jumlah': d.value,
    'Persentase': `${((d.value / totalForPct) * 100).toFixed(2)}%`,
  }));

  // Rekap By Sales — jumlah + persen
  const salesRekap = salesChartData.map(d => ({
    'Sales': d.name,
    'Jumlah': d.value,
    'Persentase': `${((d.value / totalForPct) * 100).toFixed(2)}%`,
  }));

  // Rekap Drop by Reason — jumlah + persen (basis: total lead drop)
  const totalDropForPct = dropLeads.length || 1;
  const dropRekap = dropChartData.map(d => ({
    'Alasan Drop': d.name,
    'Jumlah': d.value,
    'Persentase': `${((d.value / totalDropForPct) * 100).toFixed(2)}%`,
  }));

  // Tambah autofilter pada sheet (panah dropdown di header)
  const tambahAutofilter = (ws: XLSX.WorkSheet) => {
    if (ws['!ref']) ws['!autofilter'] = { ref: ws['!ref'] };
  };

  // Atur lebar kolom otomatis
  const aturLebar = (ws: XLSX.WorkSheet, rows: any[]) => {
    if (!rows.length) return;
    ws['!cols'] = Object.keys(rows[0]).map(key => ({
      wch: Math.max(key.length, ...rows.map(r => String((r as any)[key] ?? '').length).slice(0, 20)) + 2,
    }));
  };

  // ─── Helper: gambar PIE chart ke canvas, return dataURL ──────────────
  const buatPieChart = (
    data: { name: string; value: number }[],
    judul: string,
    palet: string[],
  ): string => {
    const W = 520, H = 320;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    // Judul
    ctx.fillStyle = '#1E293B';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(judul, 16, 28);

    const total = data.reduce((a, d) => a + d.value, 0) || 1;
    const cx = 150, cy = 180, r = 100;
    let start = -Math.PI / 2;

    data.forEach((d, i) => {
      const slice = (d.value / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, start, start + slice);
      ctx.closePath();
      ctx.fillStyle = palet[i % palet.length];
      ctx.fill();
      start += slice;
    });

    // Legenda
    let ly = 70;
    ctx.font = '13px Arial';
    data.forEach((d, i) => {
      ctx.fillStyle = palet[i % palet.length];
      ctx.fillRect(300, ly - 10, 14, 14);
      ctx.fillStyle = '#334155';
      const pct = ((d.value / total) * 100).toFixed(1);
      ctx.fillText(`${d.name}: ${d.value} (${pct}%)`, 320, ly + 2);
      ly += 24;
    });

    return canvas.toDataURL('image/png');
  };

  // ─── Helper: gambar BAR chart ke canvas, return dataURL ──────────────
  const buatBarChart = (
    data: { name: string; value: number }[],
    judul: string,
    palet: string[],
  ): string => {
    const W = 520, H = 320;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = '#1E293B';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(judul, 16, 28);

    const padL = 40, padB = 70, padT = 50;
    const chartW = W - padL - 20;
    const chartH = H - padT - padB;
    const maxVal = Math.max(...data.map(d => d.value), 1);
    const n = data.length || 1;
    const barW = Math.min(50, (chartW / n) * 0.6);
    const gap = chartW / n;

    // Sumbu
    ctx.strokeStyle = '#CBD5E1';
    ctx.beginPath();
    ctx.moveTo(padL, padT);
    ctx.lineTo(padL, padT + chartH);
    ctx.lineTo(padL + chartW, padT + chartH);
    ctx.stroke();

    data.forEach((d, i) => {
      const x = padL + gap * i + (gap - barW) / 2;
      const h = (d.value / maxVal) * chartH;
      const y = padT + chartH - h;
      ctx.fillStyle = palet[i % palet.length];
      ctx.fillRect(x, y, barW, h);

      // Nilai di atas bar
      ctx.fillStyle = '#1E293B';
      ctx.font = 'bold 12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(String(d.value), x + barW / 2, y - 5);

      // Label di bawah (dipotong kalau panjang)
      ctx.fillStyle = '#64748B';
      ctx.font = '10px Arial';
      const label = d.name.length > 12 ? d.name.slice(0, 11) + '…' : d.name;
      ctx.save();
      ctx.translate(x + barW / 2, padT + chartH + 8);
      ctx.rotate(-Math.PI / 4);
      ctx.textAlign = 'right';
      ctx.fillText(label, 0, 0);
      ctx.restore();
    });

    return canvas.toDataURL('image/png');
  };

  const handleExportPDF = () => {
    if (filtered.length === 0) {
      message.warning('Tidak ada data untuk dibuat laporan');
      return;
    }

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 14;
    let y = 16;

    // Header
    doc.setFontSize(18);
    doc.setTextColor(31, 78, 121);
    doc.setFont('helvetica', 'bold');
    doc.text('Laporan Leads & Sales', margin, y);
    y += 7;
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'normal');
    const periodeLabel = PERIODE_OPTIONS.find(p => p.value === periode)?.label ?? periode;
    doc.text(`Periode: ${periodeLabel}  |  Dibuat: ${dayjs().format('DD MMM YYYY HH:mm')}`, margin, y);
    y += 8;

    // KPI ringkas
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin, y, pageW - margin * 2, 16, 2, 2, 'F');
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    const kpiText = `Total Leads: ${total}     Closing: ${closing}     Drop: ${drop}     Conversion: ${convRate}%`;
    doc.text(kpiText, margin + 4, y + 10);
    y += 24;

    const PAL = ['#1F4E79', '#C9A66B', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#3B82F6', '#94A3B8'];
    const imgW = pageW - margin * 2;
    const imgH = imgW * (320 / 520);

    const tambahGambar = (dataUrl: string) => {
      if (y + imgH > doc.internal.pageSize.getHeight() - 12) {
        doc.addPage();
        y = 16;
      }
      doc.addImage(dataUrl, 'PNG', margin, y, imgW, imgH);
      y += imgH + 6;
    };

    // Chart-chart
    if (statusChartData.length) {
      tambahGambar(buatPieChart(statusChartData, 'Distribusi Status', PAL));
    }
    if (sourceChartData.length) {
      tambahGambar(buatBarChart(sourceChartData, 'Lead by Source', PAL));
    }
    if (salesChartData.length) {
      tambahGambar(buatBarChart(salesChartData, 'Lead per Sales', PAL));
    }
    if (dropChartData.length) {
      tambahGambar(buatPieChart(dropChartData, 'Drop by Reason', PAL));
    }

    // Tabel rekap By Source
    if (sourceRekap.length) {
      doc.addPage(); y = 16;
      doc.setFontSize(13); doc.setTextColor(31, 78, 121); doc.setFont('helvetica', 'bold');
      doc.text('Rekap By Source', margin, y); y += 4;
      autoTable(doc, {
        startY: y + 2,
        head: [['Sumber', 'Jumlah', 'Persentase']],
        body: sourceRekap.map(r => [r['Sumber'], String(r['Jumlah']), r['Persentase']]),
        headStyles: { fillColor: [31, 78, 121] },
        styles: { fontSize: 9 },
        margin: { left: margin, right: margin },
      });
      y = (doc as any).lastAutoTable.finalY + 8;
    }

    // Tabel rekap By Sales
    if (salesRekap.length) {
      if (y > doc.internal.pageSize.getHeight() - 40) { doc.addPage(); y = 16; }
      doc.setFontSize(13); doc.setTextColor(31, 78, 121); doc.setFont('helvetica', 'bold');
      doc.text('Rekap By Sales', margin, y); y += 4;
      autoTable(doc, {
        startY: y + 2,
        head: [['Sales', 'Jumlah', 'Persentase']],
        body: salesRekap.map(r => [r['Sales'], String(r['Jumlah']), r['Persentase']]),
        headStyles: { fillColor: [31, 78, 121] },
        styles: { fontSize: 9 },
        margin: { left: margin, right: margin },
      });
      y = (doc as any).lastAutoTable.finalY + 8;
    }

    // Tabel rekap Drop by Reason
    if (dropRekap.length) {
      if (y > doc.internal.pageSize.getHeight() - 40) { doc.addPage(); y = 16; }
      doc.setFontSize(13); doc.setTextColor(31, 78, 121); doc.setFont('helvetica', 'bold');
      doc.text('Rekap Drop by Reason', margin, y); y += 4;
      autoTable(doc, {
        startY: y + 2,
        head: [['Alasan Drop', 'Jumlah', 'Persentase']],
        body: dropRekap.map(r => [r['Alasan Drop'], String(r['Jumlah']), r['Persentase']]),
        headStyles: { fillColor: [148, 163, 184] },
        styles: { fontSize: 9 },
        margin: { left: margin, right: margin },
      });
    }

    doc.save(`laporan-leads-${dayjs().format('YYYY-MM-DD')}.pdf`);
  };

  const handleExport = () => {
    if (exportPilihan.length === 0) {
      message.warning('Pilih minimal satu data untuk di-export');
      return;
    }

    const wb = XLSX.utils.book_new();

    // Sheet Data Mentah
    if (exportPilihan.includes('mentah')) {
      const data = filtered.map(l => {
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
      const ws = XLSX.utils.json_to_sheet(data.length ? data : [{ 'Info': 'Tidak ada data' }]);
      aturLebar(ws, data);
      tambahAutofilter(ws);
      XLSX.utils.book_append_sheet(wb, ws, 'Data Mentah');
    }

    // Sheet By Source
    if (exportPilihan.includes('source')) {
      const ws = XLSX.utils.json_to_sheet(sourceRekap.length ? sourceRekap : [{ 'Info': 'Tidak ada data' }]);
      aturLebar(ws, sourceRekap);
      tambahAutofilter(ws);
      XLSX.utils.book_append_sheet(wb, ws, 'By Source');
    }

    // Sheet By Sales
    if (exportPilihan.includes('sales')) {
      const ws = XLSX.utils.json_to_sheet(salesRekap.length ? salesRekap : [{ 'Info': 'Tidak ada data' }]);
      aturLebar(ws, salesRekap);
      tambahAutofilter(ws);
      XLSX.utils.book_append_sheet(wb, ws, 'By Sales');
    }

    // Sheet Drop by Reason
    if (exportPilihan.includes('drop')) {
      const ws = XLSX.utils.json_to_sheet(dropRekap.length ? dropRekap : [{ 'Info': 'Belum ada lead drop' }]);
      aturLebar(ws, dropRekap);
      tambahAutofilter(ws);
      XLSX.utils.book_append_sheet(wb, ws, 'Drop by Reason');
    }

    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([buf], { type: 'application/octet-stream' }), `laporan-leads-${dayjs().format('YYYY-MM-DD')}.xlsx`);
    setExportModal(false);
  };

  return (
    <div>
      <Row justify="end" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Space>
            <Button
              icon={<DownloadOutlined />}
              onClick={handleExportPDF}
              style={{ background: '#C9A66B', color: '#fff', fontWeight: 600, borderColor: '#C9A66B' }}
            >
              Export PDF
            </Button>
            <Button
              icon={<DownloadOutlined />}
              onClick={() => setExportModal(true)}
              style={{ background: '#1F4E79', color: '#fff', fontWeight: 600 }}
            >
              Export Excel
            </Button>
          </Space>
        </Col>
      </Row>

      {/* Popup pilih data yang mau di-export */}
      <Modal
        title={<Space><DownloadOutlined style={{ color: '#1F4E79' }} />Export Excel — Pilih Data</Space>}
        open={exportModalOpen}
        onOk={handleExport}
        onCancel={() => setExportModal(false)}
        okText="Export"
        cancelText="Batal"
        okButtonProps={{ style: { background: '#1F4E79', borderColor: '#1F4E79' } }}
      >
        <div style={{ marginBottom: 12 }}>
          <Checkbox
            checked={exportPilihan.length === 4}
            indeterminate={exportPilihan.length > 0 && exportPilihan.length < 4}
            onChange={e => setExportPilihan(e.target.checked ? ['mentah', 'source', 'sales', 'drop'] : [])}
          >
            <Text strong>Pilih Semua</Text>
          </Checkbox>
        </div>
        <Checkbox.Group
          value={exportPilihan}
          onChange={(vals) => setExportPilihan(vals as string[])}
          style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
        >
          <Checkbox value="mentah">Data Mentah (semua lead per baris)</Checkbox>
          <Checkbox value="source">Rekap By Source (sumber + jumlah + %)</Checkbox>
          <Checkbox value="sales">Rekap By Sales (sales + jumlah + %)</Checkbox>
          <Checkbox value="drop">Rekap Drop by Reason (alasan + jumlah + %)</Checkbox>
        </Checkbox.Group>
        <div style={{ marginTop: 16, padding: '8px 12px', background: '#F8FAFC', borderRadius: 6 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Data mengikuti filter yang sedang aktif. Tiap sheet sudah dilengkapi autofilter (panah di header).
          </Text>
        </div>
      </Modal>

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