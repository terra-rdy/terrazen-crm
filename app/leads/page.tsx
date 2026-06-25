'use client';

import React, { useEffect, useState, useRef } from 'react';
import {
  Card, Table, Tag, Button, Input, Select, Space, Modal,
  Form, Row, Col, Typography, Tooltip, Popconfirm, message,
  Drawer, Descriptions, Avatar, DatePicker, Alert,
  Radio, Timeline, Divider,
} from 'antd';
import {
  PlusOutlined, SearchOutlined, EyeOutlined,
  EditOutlined, DeleteOutlined, FilterOutlined,
  PhoneOutlined, UserOutlined,
  TeamOutlined, ClockCircleOutlined, WarningOutlined,
  WhatsAppOutlined, SwapOutlined, ThunderboltOutlined,
  MessageOutlined, CalendarOutlined, CheckCircleOutlined,
  InboxOutlined,
} from '@ant-design/icons';
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc,
  doc, query, orderBy, serverTimestamp, where, getDoc, onSnapshot,
} from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';

const { Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

interface FollowUpEntry {
  id: string;
  status: string;
  notes: string;
  nextAction: string | null;
  lastUpdate: any;
  createdBy: string;
  createdByNama: string;
  dropReason?: string;
}

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
  distributionType?: 'rolling' | 'rebutan' | 'assigned';
  distributionStatus?: 'pending' | 'taken' | 'databank';
  rollingQueue?: string[];
  currentQueueIndex?: number;
  queueExpiredAt?: any;
  takenBy?: string;
  takenAt?: any;
  followUpHistory?: FollowUpEntry[];
  dropReason?: string;
}

interface SalesUser {
  id: string;
  nama: string;
  email: string;
  role: string;
  hp?: string;
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

interface DropReason {
  id: string;
  nama: string;
  aktif: boolean;
  urutan: number;
}

interface DistribusiConfig {
  rollingOrder: string[];
  rollingSkip: string[];
  rebutanGroup: string[];
  lastWinnerIndex: number;
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

const DIST_TYPE_LABEL: Record<string, { label: string; color: string }> = {
  rolling:  { label: 'Rolling',  color: '#1F4E79' },
  rebutan:  { label: 'Rebutan',  color: '#10B981' },
  assigned: { label: 'Assigned', color: '#F59E0B' },
};

type FilterType = 'all' | 'aktif' | 'today' | 'overdue' | 'archived';

export default function LeadsPage() {
  const [leads, setLeads]               = useState<Lead[]>([]);
  const [allLeads, setAllLeads]         = useState<Lead[]>([]);
  const [filtered, setFiltered]         = useState<Lead[]>([]);
  const [salesList, setSalesList]       = useState<SalesUser[]>([]);
  const [nowTick, setNowTick]           = useState<number>(Date.now());
  const leadsUnsubRef = useRef<null | (() => void)>(null);
  const [projects, setProjects]         = useState<Project[]>([]);
  const [statuses, setStatuses]         = useState<StatusItem[]>([]);
  const [sources, setSources]           = useState<SourceItem[]>([]);
  const [dropReasons, setDropReasons]   = useState<DropReason[]>([]);
  const [distribusiConfig, setDistConfig] = useState<DistribusiConfig | null>(null);
  const [loading, setLoading]           = useState(true);
  const [searchText, setSearch]         = useState('');
  const [statusFilter, setStatusF]      = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [modalOpen, setModal]           = useState(false);
  const [drawerOpen, setDrawer]         = useState(false);
  const [followUpModal, setFollowUpModal] = useState(false);
  const [selectedLead, setSelected]     = useState<Lead | null>(null);
  const [editingLead, setEditing]       = useState<Lead | null>(null);
  const [submitting, setSubmitting]     = useState(false);
  const [submittingFU, setSubmittingFU] = useState(false);
  const [currentRole, setRole]          = useState<string>('');
  const [currentUid, setUid]            = useState<string>('');
  const [currentNama, setNama]          = useState<string>('');
  const [duplicateInfo, setDuplicate]   = useState<{ lead: Lead; salesNama: string } | null>(null);
  const [distribusiType, setDistType]   = useState<'rolling' | 'rebutan' | 'assigned'>('assigned');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [form] = Form.useForm();
  const [followUpForm] = Form.useForm();

  const today = dayjs().format('YYYY-MM-DD');

  const getStatusColor = (nama: string) => {
    if (nama?.toLowerCase() === 'drop') return 'default';
    const idx = statuses.findIndex(s => s.nama.toLowerCase() === nama?.toLowerCase());
    return STATUS_COLORS[idx % STATUS_COLORS.length] ?? 'default';
  };

  const getStatusNama = (val: string) => {
    const found = statuses.find(s => s.id === val || s.nama.toLowerCase() === val?.toLowerCase());
    return found?.nama ?? val ?? '—';
  };

  // Live timer untuk monitoring (update tiap 30 detik)
  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

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
      // Semua role (admin & sales) bisa memilih semua project yang aktif
      setProjects(allProjects.filter(p => p.aktif));

      const statusSnap = await getDocs(query(collection(db, 'statuses'), orderBy('urutan')));
      setStatuses(statusSnap.docs.map(d => ({ id: d.id, ...d.data() })) as StatusItem[]);

      const sourceSnap = await getDocs(query(collection(db, 'sources'), orderBy('urutan')));
      setSources(sourceSnap.docs.map(d => ({ id: d.id, ...d.data() })) as SourceItem[]);

      const dropSnap = await getDocs(query(collection(db, 'drop_reasons'), orderBy('urutan')));
      setDropReasons(dropSnap.docs.map(d => ({ id: d.id, ...d.data() })) as DropReason[]);

      const distSnap = await getDoc(doc(db, 'distribution_settings', 'config'));
      if (distSnap.exists()) {
        const data = distSnap.data() as DistribusiConfig;
        setDistConfig({
          rollingOrder: data.rollingOrder?.filter(Boolean) ?? [],
          rollingSkip: data.rollingSkip?.filter(Boolean) ?? [],
          rebutanGroup: data.rebutanGroup?.filter(Boolean) ?? [],
          lastWinnerIndex: data.lastWinnerIndex ?? 0,
        });
      }

      await fetchLeads(me?.role ?? 'sales', firebaseUser.uid);

      const allSnap = await getDocs(collection(db, 'leads'));
      setAllLeads(allSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Lead[]);
    });

    return () => {
      unsubscribe();
      // Bersihkan listener leads real-time saat keluar halaman
      if (leadsUnsubRef.current) {
        leadsUnsubRef.current();
        leadsUnsubRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    let data = [...leads];

    // Filter by active card
    if (activeFilter === 'aktif') {
      data = data.filter(l => l.status?.toLowerCase() !== 'drop');
    } else if (activeFilter === 'today') {
      data = data.filter(l => l.nextFollowUp === today);
    } else if (activeFilter === 'overdue') {
      data = data.filter(l =>
        l.nextFollowUp && l.nextFollowUp < today &&
        l.status?.toLowerCase() !== 'drop'
      );
    } else if (activeFilter === 'archived') {
      data = data.filter(l => l.status?.toLowerCase() === 'drop');
    }

    // Filter by search
    if (searchText) {
      const s = searchText.toLowerCase();
      data = data.filter(l =>
        l.nama?.toLowerCase().includes(s) ||
        l.hp?.includes(s) ||
        l.project?.toLowerCase().includes(s)
      );
    }

    // Filter by status dropdown
    if (statusFilter) {
      data = data.filter(l => l.status?.toLowerCase() === statusFilter.toLowerCase());
    }

    setFiltered(data);
  }, [leads, searchText, statusFilter, activeFilter, today]);

  const fetchLeads = async (role: string, uid: string) => {
    setLoading(true);
    // Bersihkan listener lama kalau ada (hindari listener ganda)
    if (leadsUnsubRef.current) {
      leadsUnsubRef.current();
      leadsUnsubRef.current = null;
    }
    let q;
    if (role === 'admin') {
      q = query(collection(db, 'leads'), orderBy('createdAt', 'desc'));
    } else {
      q = query(collection(db, 'leads'), where('assignedTo', '==', uid), orderBy('createdAt', 'desc'));
    }
    // Pasang listener real-time: halaman update otomatis tiap ada perubahan
    const unsub = onSnapshot(
      q,
      (snap) => {
        setLeads(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Lead[]);
        setLoading(false);
      },
      async (err) => {
        console.error('Snapshot leads error, fallback ke getDocs:', err);
        // Fallback: kalau listener gagal (mis. index belum ada), ambil sekali
        try {
          const snapAll = await getDocs(collection(db, 'leads'));
          const all = snapAll.docs.map(d => ({ id: d.id, ...d.data() })) as Lead[];
          setLeads(role === 'admin' ? all : all.filter(l => l.assignedTo === uid));
        } finally {
          setLoading(false);
        }
      }
    );
    leadsUnsubRef.current = unsub;
  };

  // Stat counts
  const totalLeads  = leads.length;
  const leadsAktif  = leads.filter(l => l.status?.toLowerCase() !== 'drop').length;
  const todayTask   = leads.filter(l => l.nextFollowUp === today).length;
  const overdue     = leads.filter(l =>
    l.nextFollowUp && l.nextFollowUp < today &&
    l.status?.toLowerCase() !== 'drop'
  ).length;
  const archived    = leads.filter(l => l.status?.toLowerCase() === 'drop').length;

  const statCards = [
    { key: 'all',      label: 'Total Leads',  value: totalLeads, color: '#1F4E79', icon: <TeamOutlined /> },
    { key: 'aktif',    label: 'Leads Aktif',  value: leadsAktif, color: '#8B5CF6', icon: <CheckCircleOutlined /> },
    { key: 'today',    label: 'Today Task',   value: todayTask,  color: '#F59E0B', icon: <ClockCircleOutlined /> },
    { key: 'overdue',  label: 'Overdue',      value: overdue,    color: '#EF4444', icon: <WarningOutlined /> },
    { key: 'archived', label: 'Archived',     value: archived,   color: '#64748B', icon: <InboxOutlined /> },
  ];

  const checkDuplicate = (hp: string, excludeId?: string): Lead | null => {
    const normalized = normalizeHP(hp);
    return allLeads.find(l =>
      l.id !== excludeId && l.hp && normalizeHP(l.hp) === normalized
    ) ?? null;
  };

  const openAdd = async () => {
    setEditing(null);
    setDuplicate(null);
    setDistType('assigned');
    form.resetFields();
    if (currentRole !== 'admin') form.setFieldsValue({ assignedTo: currentUid });
    try {
      const distSnap = await getDoc(doc(db, 'distribution_settings', 'config'));
      if (distSnap.exists()) {
        const data = distSnap.data() as DistribusiConfig;
        setDistConfig({
          rollingOrder: data.rollingOrder?.filter(Boolean) ?? [],
          rollingSkip: data.rollingSkip?.filter(Boolean) ?? [],
          rebutanGroup: data.rebutanGroup?.filter(Boolean) ?? [],
          lastWinnerIndex: data.lastWinnerIndex ?? 0,
        });
      }
    } catch (e) { console.error('Gagal refresh distribusi config:', e); }
    setModal(true);
  };

  const openEdit = (lead: Lead) => {
    setEditing(lead);
    setDuplicate(null);
    setDistType((lead.distributionType as any) ?? 'assigned');
    form.setFieldsValue({
      ...lead,
      nextFollowUp: lead.nextFollowUp ? dayjs(lead.nextFollowUp) : null,
    });
    setModal(true);
  };

  const openDetail = async (lead: Lead) => {
    setSelected(lead);
    setDrawer(true);
    if (currentRole === 'sales' && !lead.firstOpenedAt) {
      try {
        await updateDoc(doc(db, 'leads', lead.id), {
          firstOpenedAt: serverTimestamp(),
          firstOpenedBy: currentUid,
        });
        setLeads(prev => prev.map(l =>
          l.id === lead.id ? { ...l, firstOpenedAt: new Date() } : l
        ));
      } catch (e) { console.error('Gagal catat firstOpenedAt:', e); }
    }
  };

  const openFollowUp = (lead: Lead) => {
    setSelected(lead);
    setSelectedStatus('');
    followUpForm.resetFields();
    setFollowUpModal(true);
  };

  const handleFollowUpSubmit = async () => {
    if (!selectedLead) return;
    try {
      const values = await followUpForm.validateFields();
      setSubmittingFU(true);

      const isDrop = values.status?.toLowerCase() === 'drop';

      // Ambil nama sales dari salesList kalau currentNama kosong
      const namaSales = currentNama || salesList.find(s => s.id === currentUid)?.nama || 'Sales';

      // Buat entry tanpa undefined values
      const newEntry: any = {
        id: Date.now().toString(),
        status: values.status,
        notes: values.notes ?? '',
        nextAction: values.nextAction ? dayjs(values.nextAction).format('YYYY-MM-DD') : null,
        lastUpdate: new Date().toISOString(),
        createdBy: currentUid,
        createdByNama: namaSales,
      };
      if (isDrop && values.dropReason) {
        newEntry.dropReason = values.dropReason;
      }

      const existing: FollowUpEntry[] = selectedLead.followUpHistory ?? [];
      const updated = [newEntry, ...existing];

      const updatePayload: any = {
        followUpHistory: updated,
        status: values.status,
        nextFollowUp: newEntry.nextAction ?? selectedLead.nextFollowUp ?? null,
        lastFollowUpAt: serverTimestamp(),
      };

      if (isDrop && values.dropReason) {
        updatePayload.dropReason = values.dropReason;
      }

      await updateDoc(doc(db, 'leads', selectedLead.id), updatePayload);

      const updatedLead = {
        ...selectedLead,
        followUpHistory: updated,
        status: values.status,
        nextFollowUp: newEntry.nextAction ?? selectedLead.nextFollowUp ?? undefined,
        dropReason: isDrop ? values.dropReason : selectedLead.dropReason,
      };
      setSelected(updatedLead);
      setLeads(prev => prev.map(l => l.id === selectedLead.id ? updatedLead : l));

      message.success('Follow up berhasil disimpan');
      setFollowUpModal(false);
      followUpForm.resetFields();
      setSelectedStatus('');
    } catch (e: any) {
      if (e?.errorFields) return;
      console.error('Follow up error:', e);
      message.error('Gagal menyimpan follow up: ' + (e?.message ?? ''));
    } finally {
      setSubmittingFU(false);
    }
  };

  const handleWAClick = async (lead: Lead) => {
    if (!lead.hp) return;
    try {
      await updateDoc(doc(db, 'leads', lead.id), {
        waClickedAt: serverTimestamp(),
        waClickedBy: currentUid,
      });
      setLeads(prev => prev.map(l =>
        l.id === lead.id ? { ...l, waClickedAt: new Date() } : l
      ));
      if (selectedLead?.id === lead.id) setSelected({ ...lead, waClickedAt: new Date() });
    } catch (e) { console.error('Gagal catat waClickedAt:', e); }
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

  const buildRollingQueue = (): string[] => {
    if (!distribusiConfig) return [];
    const { rollingOrder, rollingSkip, lastWinnerIndex } = distribusiConfig;
    const aktif = rollingOrder.filter(uid => !rollingSkip.includes(uid));
    if (aktif.length === 0) return [];
    const winnerIdx = lastWinnerIndex % rollingOrder.length;
    let firstIdx = -1;
    for (let i = 1; i <= rollingOrder.length; i++) {
      const idx = (winnerIdx + i) % rollingOrder.length;
      if (!rollingSkip.includes(rollingOrder[idx])) { firstIdx = idx; break; }
    }
    if (firstIdx === -1) return aktif;
    const queue: string[] = [];
    for (let i = 0; i < rollingOrder.length && queue.length < 2; i++) {
      const idx = (firstIdx + i) % rollingOrder.length;
      if (!rollingSkip.includes(rollingOrder[idx])) queue.push(rollingOrder[idx]);
    }
    return queue;
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

      let distribusiPayload: any = { distributionType: distribusiType, distributionStatus: 'pending' };

      if (distribusiType === 'rolling') {
        const queue = buildRollingQueue();
        if (queue.length === 0) { message.error('Belum ada sales aktif dalam urutan rolling.'); setSubmitting(false); return; }
        distribusiPayload = { ...distribusiPayload, rollingQueue: queue, currentQueueIndex: 0, queueExpiredAt: new Date(Date.now() + 3 * 60 * 1000), assignedTo: null, takenBy: null, takenAt: null };
      } else if (distribusiType === 'rebutan') {
        if (!distribusiConfig?.rebutanGroup?.length) { message.error('Belum ada sales dalam grup rebutan.'); setSubmitting(false); return; }
        distribusiPayload = { ...distribusiPayload, assignedTo: null, takenBy: null, takenAt: null };
      } else {
        distribusiPayload = { ...distribusiPayload, distributionStatus: 'taken', takenBy: values.assignedTo ?? currentUid, takenAt: serverTimestamp() };
      }

      const payload = {
        nama: values.nama, hp: values.hp,
        project: values.project ?? null, sumber: values.sumber ?? null,
        status: values.status, catatan: values.catatan ?? null,
        nextFollowUp: nextFollowUp ?? null, ...distribusiPayload,
      };

      if (editingLead) {
        await updateDoc(doc(db, 'leads', editingLead.id), payload);
        message.success('Lead berhasil diupdate');
      } else {
        const assignedTo = distribusiType === 'assigned' ? (currentRole === 'admin' ? (values.assignedTo ?? currentUid) : currentUid) : null;
        const docRef = await addDoc(collection(db, 'leads'), { ...payload, assignedTo, createdAt: serverTimestamp(), firstOpenedAt: null, waClickedAt: null, followUpHistory: [] });
        message.success(distribusiType === 'rolling' ? 'Lead masuk antrian rolling' : distribusiType === 'rebutan' ? 'Lead masuk sistem rebutan' : 'Lead berhasil ditambahkan');

        try {
          if (distribusiType === 'rolling') {
            const queue: string[] = distribusiPayload.rollingQueue ?? [];
            const firstUid = queue[0];
            if (firstUid) {
              await fetch('/api/send-notification', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  title: '🏠 Lead Baru Untuk Anda!',
                  body: `${values.nama} - ${values.project ?? ''}`,
                  targetUid: firstUid,
                  projectName: values.project ?? '',
                  data: { type: 'new_lead_distribution', leadId: docRef.id },
                }),
              });
            }
          } else if (distribusiType === 'rebutan') {
            const group: string[] = distribusiConfig?.rebutanGroup ?? [];
            await Promise.allSettled(
              group.map(uid =>
                fetch('/api/send-notification', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    title: '⚡ Lead Rebutan Masuk!',
                    body: `${values.nama} - ${values.project ?? ''}`,
                    targetUid: uid,
                    projectName: values.project ?? '',
                    data: { type: 'new_lead_distribution', leadId: docRef.id },
                  }),
                })
              )
            );
          } else if (distribusiType === 'assigned') {
            // Kirim email HANYA saat admin assign ke sales LAIN (bukan ke diri sendiri)
            const targetSales = values.assignedTo;
            if (currentRole === 'admin' && targetSales && targetSales !== currentUid) {
              await fetch('/api/send-notification', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  title: '🎯 Lead Baru Hanya Untuk Anda!',
                  body: `${values.nama} - ${values.project ?? ''}`,
                  targetUid: targetSales,
                  projectName: values.project ?? '',
                  data: { type: 'new_lead_distribution', leadId: docRef.id },
                }),
              });
            }
          }
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
  const getSalesHP = (uid: string) => salesList.find(u => u.id === uid)?.hp ?? '';

  // Hitung durasi sejak lead masuk (untuk monitoring)
  const hitungDurasi = (createdAt: any): string => {
    if (!createdAt?.seconds) return '—';
    const masuk = createdAt.seconds * 1000;
    const selisihMnt = Math.floor((nowTick - masuk) / 60000);
    if (selisihMnt < 1) return 'Baru saja';
    if (selisihMnt < 60) return `${selisihMnt} menit lalu`;
    const jam = Math.floor(selisihMnt / 60);
    const sisaMnt = selisihMnt % 60;
    return `${jam} jam ${sisaMnt} menit lalu`;
  };

  // Sisa waktu giliran rolling (dari queueExpiredAt)
  const sisaWaktuGiliran = (expiredAt: any): string => {
    if (!expiredAt) return '';
    const exp = expiredAt.seconds ? expiredAt.seconds * 1000 : new Date(expiredAt).getTime();
    const sisaDetik = Math.floor((exp - nowTick) / 1000);
    if (sisaDetik <= 0) return 'Habis';
    const m = Math.floor(sisaDetik / 60);
    const d = sisaDetik % 60;
    return `${m}:${String(d).padStart(2, '0')}`;
  };

  // Buka WhatsApp untuk notifikasi lead (monitoring admin)
  const waMonitoring = (lead: Lead) => {
    let nomor = '';
    let pesan = '';
    if (lead.distributionType === 'rolling') {
      const uidGiliran = lead.rollingQueue?.[lead.currentQueueIndex ?? 0] ?? '';
      nomor = getSalesHP(uidGiliran);
      pesan = `Halo ${getSalesName(uidGiliran)}, ada *Lead Baru* untuk Anda (giliran rolling):\n\nNama: ${lead.nama}\nProject: ${lead.project ?? '-'}\n\nMohon segera dicek & diterima di aplikasi ya. Terima kasih.`;
    } else if (lead.distributionType === 'rebutan') {
      // Tanpa nomor — admin pilih tujuan (grup / sales) sendiri di WA
      pesan = `*Lead Rebutan Masuk!* ⚡\n\nNama: ${lead.nama}\nProject: ${lead.project ?? '-'}\n\nSiapa cepat dia dapat! Buka aplikasi untuk klaim.`;
    } else {
      const uid = lead.assignedTo ?? lead.takenBy ?? '';
      nomor = getSalesHP(uid);
      pesan = `Halo ${getSalesName(uid)}, ada *Lead Baru* ditugaskan untuk Anda:\n\nNama: ${lead.nama}\nProject: ${lead.project ?? '-'}\n\nMohon segera ditindaklanjuti. Terima kasih.`;
    }
    const teks = encodeURIComponent(pesan);
    const url = nomor
      ? `https://wa.me/${nomor.replace(/^0/, '62').replace(/[^0-9]/g, '')}?text=${teks}`
      : `https://wa.me/?text=${teks}`;
    window.open(url, '_blank');
  };

  // Lead yang masih berjalan / belum diterima (untuk monitoring admin):
  // distributionStatus 'pending' ATAU belum punya sales (assignedTo & takenBy kosong),
  // tapi yang sudah drop/closing dikecualikan.
  const leadsOnProgress = leads.filter(l => {
    const statusLower = (l.status ?? '').toLowerCase();
    if (statusLower === 'drop' || statusLower === 'closing') return false;
    const belumPunyaSales = !l.assignedTo && !l.takenBy;
    return l.distributionStatus === 'pending' || belumPunyaSales;
  });

  const getFollowUpTag = (date?: string) => {
    if (!date) return <Text type="secondary">—</Text>;
    if (date < today) return <Tag color="error">Overdue: {date}</Tag>;
    if (date === today) return <Tag color="warning">Hari ini</Tag>;
    return <Tag color="processing">{date}</Tag>;
  };

  const getDistribusiTag = (lead: Lead) => {
    if (!lead.distributionType || lead.distributionType === 'assigned') return null;
    const cfg = DIST_TYPE_LABEL[lead.distributionType];
    return <Tag color={cfg.color} style={{ fontSize: 11 }}>{cfg.label}</Tag>;
  };

  // Semua status + Drop
  const allStatuses = [
    ...statuses.filter(s => s.aktif),
    { id: 'drop', nama: 'Drop', aktif: true, urutan: 999 },
  ];

  const columns: ColumnsType<Lead> = [
    {
      title: 'Nama', dataIndex: 'nama', key: 'nama',
      render: (nama: string, record: Lead) => (
        <Space>
          <Avatar size={32} style={{ background: record.status?.toLowerCase() === 'drop' ? '#94A3B8' : '#1F4E79', fontSize: 13, flexShrink: 0 }}>
            {nama?.[0]?.toUpperCase() ?? '?'}
          </Avatar>
          <div>
            <Text style={{ fontWeight: 500, color: record.status?.toLowerCase() === 'drop' ? '#94A3B8' : undefined }}>{nama}</Text>
            {getDistribusiTag(record) && <div style={{ marginTop: 2 }}>{getDistribusiTag(record)}</div>}
          </div>
        </Space>
      ),
    },
    {
      title: 'No. HP', dataIndex: 'hp', key: 'hp', responsive: ['md'],
      render: (p: string, record: Lead) => p ? (
        <Space size={4}>
          <Text>{p}</Text>
          <Tooltip title="Chat WhatsApp">
            <Button type="text" size="small" icon={<WhatsAppOutlined style={{ color: '#25D366' }} />} onClick={() => handleWAClick(record)} />
          </Tooltip>
        </Space>
      ) : <Text type="secondary">—</Text>,
    },
    { title: 'Project', dataIndex: 'project', key: 'project', responsive: ['sm'], render: (p: string) => <Text type="secondary">{p ?? '—'}</Text> },
    { title: 'Follow Up', dataIndex: 'nextFollowUp', key: 'nextFollowUp', responsive: ['md'], render: (date: string, record: Lead) => record.status?.toLowerCase() === 'drop' ? <Tag color="default">Drop</Tag> : getFollowUpTag(date) },
    { title: 'Sales', dataIndex: 'assignedTo', key: 'assignedTo', responsive: ['lg'], render: (uid: string) => <Text type="secondary">{getSalesName(uid)}</Text> },
    {
      title: 'Status', dataIndex: 'status', key: 'status',
      render: (s: string) => (
        <Tag color={s?.toLowerCase() === 'drop' ? 'default' : getStatusColor(s)}>
          {s?.toLowerCase() === 'drop' ? '🚫 Drop' : getStatusNama(s)}
        </Tag>
      ),
    },
    {
      title: '', key: 'actions', width: 120,
      render: (_: any, record: Lead) => (
        <Space size={4}>
          <Tooltip title="Detail"><Button type="text" size="small" icon={<EyeOutlined />} onClick={() => openDetail(record)} /></Tooltip>
          <Tooltip title="Follow Up">
            <Button type="text" size="small" icon={<MessageOutlined style={{ color: '#10B981' }} />} onClick={() => openFollowUp(record)} />
          </Tooltip>
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

      {/* ── STAT CARDS (clickable, toggle) — ringkas, 1 baris ── */}
      <Row gutter={[8, 8]} wrap={false} style={{ marginBottom: 16, overflowX: 'auto' }}>
        {statCards.map(item => (
          <Col key={item.key} flex="1 1 0" style={{ minWidth: 0 }}>
            <Card
              onClick={() => setActiveFilter(activeFilter === item.key ? 'all' : item.key as FilterType)}
              style={{
                borderTop: `3px solid ${item.color}`,
                cursor: 'pointer',
                background: activeFilter === item.key ? `${item.color}12` : '#fff',
                boxShadow: activeFilter === item.key ? `0 0 0 2px ${item.color}40` : '0 1px 3px rgba(0,0,0,0.06)',
                transition: 'all 0.2s',
                transform: activeFilter === item.key ? 'translateY(-2px)' : 'none',
              }}
              styles={{ body: { padding: '10px 8px', textAlign: 'center' } }}
            >
              <div style={{
                fontSize: 10,
                lineHeight: 1.15,
                color: activeFilter === item.key ? item.color : '#94A3B8',
                fontWeight: activeFilter === item.key ? 600 : 400,
                minHeight: 24,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
              }}>
                {item.label}
              </div>
              <div style={{
                fontWeight: 700,
                fontSize: 24,
                lineHeight: 1.2,
                marginTop: 2,
                color: activeFilter === item.key ? item.color : '#1E293B',
              }}>
                {item.value}
              </div>
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
              {allStatuses.map((s, i) => (
                <Option key={s.id} value={s.nama}>
                  <Tag color={s.nama.toLowerCase() === 'drop' ? 'default' : STATUS_COLORS[i % STATUS_COLORS.length]} style={{ margin: 0 }}>
                    {s.nama.toLowerCase() === 'drop' ? '🚫 Drop' : s.nama}
                  </Tag>
                </Option>
              ))}
            </Select>
          </Col>
        </Row>
      </Card>

      {/* Card Monitoring Lead Berjalan — admin only */}
      {currentRole === 'admin' && leadsOnProgress.length > 0 && (
        <Card
          style={{ marginBottom: 16, borderLeft: '4px solid #C9A66B' }}
          styles={{ body: { padding: 16 } }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <Space>
              <ClockCircleOutlined style={{ color: '#C9A66B', fontSize: 18 }} />
              <Text strong style={{ fontSize: 15 }}>Lead Berjalan (Belum Diterima)</Text>
              <Tag color="gold">{leadsOnProgress.length}</Tag>
            </Space>
            <Text type="secondary" style={{ fontSize: 11 }}>Live · update tiap 30 detik</Text>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {leadsOnProgress.map(l => {
              const tipe = l.distributionType ?? 'assigned';
              const tipeLabel = tipe === 'rolling' ? 'Rolling' : tipe === 'rebutan' ? 'Rebutan' : 'Assign';
              const tipeColor = tipe === 'rolling' ? '#1F4E79' : tipe === 'rebutan' ? '#10B981' : '#8B5CF6';
              const uidGiliran = tipe === 'rolling' ? (l.rollingQueue?.[l.currentQueueIndex ?? 0] ?? '') : '';
              return (
                <div
                  key={l.id}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    gap: 8, padding: '8px 12px', background: '#FafafA',
                    border: '1px solid #F0F0F0', borderRadius: 8, flexWrap: 'wrap',
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <Text strong style={{ whiteSpace: 'nowrap' }}>{l.nama}</Text>
                      <Tag color={tipeColor} style={{ margin: 0 }}>{tipeLabel}</Tag>
                      {l.project && <Text type="secondary" style={{ fontSize: 12 }}>{l.project}</Text>}
                    </div>
                    <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>
                      Masuk {hitungDurasi(l.createdAt)}
                      {tipe === 'rolling' && uidGiliran && (
                        <> · Giliran: <b>{getSalesName(uidGiliran)}</b>
                          {l.queueExpiredAt && <> · sisa {sisaWaktuGiliran(l.queueExpiredAt)}</>}
                        </>
                      )}
                    </div>
                  </div>
                  <Button
                    size="small"
                    icon={<WhatsAppOutlined />}
                    onClick={() => waMonitoring(l)}
                    style={{ background: '#25D366', color: '#fff', borderColor: '#25D366', flexShrink: 0 }}
                  >
                    {tipe === 'rebutan' ? 'WA Grup' : 'WA Sales'}
                  </Button>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <Card styles={{ body: { padding: 0 } }}>
        <Table columns={columns} dataSource={filtered} rowKey="id" loading={loading}
          pagination={{ pageSize: 10, showSizeChanger: false, showTotal: total => `${total} leads` }}
          size="middle" style={{ borderRadius: 12, overflow: 'hidden' }}
          rowClassName={(record) => record.status?.toLowerCase() === 'drop' ? 'opacity-50' : ''}
        />
      </Card>

      {/* ── MODAL FOLLOW UP ── */}
      <Modal
        title={<Space><MessageOutlined style={{ color: '#10B981' }} /><span>Follow Up — {selectedLead?.nama}</span></Space>}
        open={followUpModal}
        onOk={handleFollowUpSubmit}
        onCancel={() => { setFollowUpModal(false); followUpForm.resetFields(); setSelectedStatus(''); }}
        confirmLoading={submittingFU}
        okText="Simpan Follow Up"
        cancelText="Batal"
        okButtonProps={{ style: { background: '#10B981', borderColor: '#10B981' } }}
        width={520}
      >
        {/* Info customer read-only */}
        <div style={{ background: '#F8FAFC', borderRadius: 8, padding: '10px 14px', marginBottom: 16, border: '1px solid #E2E8F0' }}>
          <Row gutter={16}>
            <Col span={12}>
              <Text type="secondary" style={{ fontSize: 11 }}>Nama Customer</Text>
              <div style={{ fontWeight: 600 }}>{selectedLead?.nama}</div>
            </Col>
            <Col span={12}>
              <Text type="secondary" style={{ fontSize: 11 }}>Nomor HP</Text>
              <div style={{ fontWeight: 600 }}>{selectedLead?.hp ?? '—'}</div>
            </Col>
          </Row>
        </div>

        <Form form={followUpForm} layout="vertical">
          <Form.Item name="status" label="Status" rules={[{ required: true, message: 'Pilih status' }]}>
            <Select placeholder="Pilih status terkini" onChange={val => setSelectedStatus(val)}>
              {allStatuses.map((s, i) => (
                <Option key={s.id} value={s.nama}>
                  <Tag color={s.nama.toLowerCase() === 'drop' ? 'default' : STATUS_COLORS[i % STATUS_COLORS.length]} style={{ margin: 0 }}>
                    {s.nama.toLowerCase() === 'drop' ? '🚫 Drop' : s.nama}
                  </Tag>
                </Option>
              ))}
            </Select>
          </Form.Item>

          {/* Alasan Drop — muncul hanya jika status Drop */}
          {selectedStatus?.toLowerCase() === 'drop' && (
            <Form.Item name="dropReason" label="Alasan Drop" rules={[{ required: true, message: 'Pilih alasan drop' }]}>
              <Select placeholder="Pilih alasan drop">
                {dropReasons.filter(d => d.aktif).map(d => (
                  <Option key={d.id} value={d.nama}>{d.nama}</Option>
                ))}
              </Select>
            </Form.Item>
          )}

          <Form.Item name="notes" label="Notes">
            <TextArea rows={3} placeholder="Catatan hasil follow up..." />
          </Form.Item>

          {selectedStatus?.toLowerCase() !== 'drop' && (
            <Form.Item name="nextAction" label="Next Action">
              <DatePicker
                style={{ width: '100%' }}
                format="DD MMM YYYY"
                placeholder="Pilih tanggal tindak lanjut berikutnya"
                disabledDate={d => d && d < dayjs().startOf('day')}
                suffixIcon={<CalendarOutlined />}
              />
            </Form.Item>
          )}

          <Text type="secondary" style={{ fontSize: 11 }}>Last Update terisi otomatis saat disimpan</Text>
        </Form>

        {/* Riwayat follow up */}
        {(selectedLead?.followUpHistory?.length ?? 0) > 0 && (
          <>
            <Divider style={{ margin: '16px 0 12px' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>Riwayat Follow Up</Text>
            </Divider>
            <div style={{ maxHeight: 200, overflowY: 'auto' }}>
              <Timeline
                items={(selectedLead?.followUpHistory ?? []).map(entry => ({
                  color: entry.status?.toLowerCase() === 'drop' ? '#94A3B8' : '#10B981',
                  content: (
                    <div style={{ marginBottom: 4 }}>
                      <Space size={6} wrap>
                        <Tag color={entry.status?.toLowerCase() === 'drop' ? 'default' : getStatusColor(entry.status)} style={{ margin: 0 }}>
                          {entry.status?.toLowerCase() === 'drop' ? '🚫 Drop' : entry.status}
                        </Tag>
                        <Text type="secondary" style={{ fontSize: 11 }}>{entry.lastUpdate ? dayjs(entry.lastUpdate).format('DD MMM YYYY HH:mm') : '—'}</Text>
                        <Text type="secondary" style={{ fontSize: 11 }}>· {entry.createdByNama}</Text>
                      </Space>
                      {entry.dropReason && <div style={{ marginTop: 4, fontSize: 12, color: '#EF4444' }}>Alasan: {entry.dropReason}</div>}
                      {entry.notes && <div style={{ marginTop: 4, fontSize: 13 }}>{entry.notes}</div>}
                      {entry.nextAction && <Text type="secondary" style={{ fontSize: 11 }}><CalendarOutlined style={{ marginRight: 4 }} />Next: {entry.nextAction}</Text>}
                    </div>
                  ),
                }))}
              />
            </div>
          </>
        )}
      </Modal>

      {/* Modal Tambah/Edit Lead */}
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
                  {allStatuses.map((s, i) => (
                    <Option key={s.id} value={s.nama}>
                      <Tag color={s.nama.toLowerCase() === 'drop' ? 'default' : STATUS_COLORS[i % STATUS_COLORS.length]} style={{ margin: 0 }}>
                        {s.nama.toLowerCase() === 'drop' ? '🚫 Drop' : s.nama}
                      </Tag>
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
            <div style={{ background: '#F8FAFC', borderRadius: 8, padding: '12px 14px', marginBottom: 16, border: '1px solid #E2E8F0' }}>
              <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 10 }}>Distribusi Leads</Text>
              <Radio.Group value={distribusiType} onChange={e => setDistType(e.target.value)} style={{ width: '100%' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <Radio value="assigned">
                    <Space><UserOutlined style={{ color: '#F59E0B' }} /><div><Text strong style={{ fontSize: 13 }}>Assign ke Sales</Text><Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Langsung ditugaskan ke sales tertentu</Text></div></Space>
                  </Radio>
                  <Radio value="rolling">
                    <Space><SwapOutlined style={{ color: '#1F4E79' }} /><div><Text strong style={{ fontSize: 13 }}>Rolling (Giliran)</Text><Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Dikirim ke sales sesuai urutan giliran (3 menit per sales){distribusiConfig?.rollingOrder?.filter(u => !distribusiConfig.rollingSkip.includes(u)).length ? ` · ${distribusiConfig.rollingOrder.filter(u => !distribusiConfig.rollingSkip.includes(u)).length} sales aktif` : ' · Belum ada sales'}</Text></div></Space>
                  </Radio>
                  <Radio value="rebutan">
                    <Space><ThunderboltOutlined style={{ color: '#10B981' }} /><div><Text strong style={{ fontSize: 13 }}>Rebutan</Text><Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Muncul di dashboard semua sales, siapa cepat dia dapat{distribusiConfig?.rebutanGroup?.length ? ` · ${distribusiConfig.rebutanGroup.length} sales dalam grup` : ' · Belum ada sales'}</Text></div></Space>
                  </Radio>
                </div>
              </Radio.Group>
              {distribusiType === 'assigned' && (
                <Form.Item name="assignedTo" label="Pilih Sales" style={{ marginTop: 12, marginBottom: 0 }}>
                  <Select placeholder="Pilih sales" allowClear>
                    {salesList.map(s => <Option key={s.id} value={s.id}>{s.nama} ({s.role})</Option>)}
                  </Select>
                </Form.Item>
              )}
              {distribusiType === 'rolling' && distribusiConfig && (
                <div style={{ marginTop: 10, padding: '8px 10px', background: '#EFF6FF', borderRadius: 6 }}>
                  <Text style={{ fontSize: 12, color: '#1F4E79' }}>Giliran berikutnya: <strong>{(() => { const q = buildRollingQueue(); return q.length > 0 ? getSalesName(q[0]) : 'Tidak ada sales aktif'; })()}</strong></Text>
                </div>
              )}
              {distribusiType === 'rebutan' && distribusiConfig && distribusiConfig.rebutanGroup.length > 0 && (
                <div style={{ marginTop: 10, padding: '8px 10px', background: '#ECFDF5', borderRadius: 6 }}>
                  <Text style={{ fontSize: 12, color: '#065F46' }}>Dikirim ke: {distribusiConfig.rebutanGroup.map(uid => getSalesName(uid)).join(', ')}</Text>
                </div>
              )}
            </div>
          )}

          <Form.Item name="catatan" label="Catatan">
            <Input.TextArea rows={3} placeholder="Catatan tambahan..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* Drawer Detail */}
      <Drawer
        title={
          <Space>
            <Avatar size={40} style={{ background: selectedLead?.status?.toLowerCase() === 'drop' ? '#94A3B8' : '#1F4E79' }}>{selectedLead?.nama?.[0]?.toUpperCase()}</Avatar>
            <div>
              <div style={{ fontWeight: 600 }}>{selectedLead?.nama}</div>
              <Space size={4}>
                <Tag color={selectedLead?.status?.toLowerCase() === 'drop' ? 'default' : getStatusColor(selectedLead?.status ?? '')} style={{ marginTop: 2 }}>
                  {selectedLead?.status?.toLowerCase() === 'drop' ? '🚫 Drop' : getStatusNama(selectedLead?.status ?? '')}
                </Tag>
                {selectedLead?.distributionType && selectedLead.distributionType !== 'assigned' && (
                  <Tag color={DIST_TYPE_LABEL[selectedLead.distributionType]?.color} style={{ marginTop: 2 }}>{DIST_TYPE_LABEL[selectedLead.distributionType]?.label}</Tag>
                )}
              </Space>
            </div>
          </Space>
        }
        open={drawerOpen} onClose={() => setDrawer(false)} size="default"
      >
        {selectedLead && (
          <>
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="Nama">{selectedLead.nama}</Descriptions.Item>
              <Descriptions.Item label="No. HP">{selectedLead.hp ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="Project">{selectedLead.project ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="Sumber">{selectedLead.sumber ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={selectedLead.status?.toLowerCase() === 'drop' ? 'default' : getStatusColor(selectedLead.status)}>
                  {selectedLead.status?.toLowerCase() === 'drop' ? '🚫 Drop' : getStatusNama(selectedLead.status)}
                </Tag>
              </Descriptions.Item>
              {selectedLead.status?.toLowerCase() === 'drop' && selectedLead.dropReason && (
                <Descriptions.Item label="Alasan Drop">
                  <Tag color="error">{selectedLead.dropReason}</Tag>
                </Descriptions.Item>
              )}
              <Descriptions.Item label="Sales">{getSalesName(selectedLead.assignedTo ?? selectedLead.takenBy ?? '')}</Descriptions.Item>
              <Descriptions.Item label="Next Follow Up">{getFollowUpTag(selectedLead.nextFollowUp)}</Descriptions.Item>
              <Descriptions.Item label="Catatan">{selectedLead.catatan ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="Lead Masuk">{formatTs(selectedLead.createdAt)}</Descriptions.Item>
              <Descriptions.Item label="Pertama Dibuka">{selectedLead.firstOpenedAt ? formatTs(selectedLead.firstOpenedAt) : <Tag color="warning">Belum dibuka</Tag>}</Descriptions.Item>
              <Descriptions.Item label="Response Time">{selectedLead.firstOpenedAt ? diffMenit(selectedLead.createdAt, selectedLead.firstOpenedAt) : '—'}</Descriptions.Item>
              <Descriptions.Item label="WA Diklik">{selectedLead.waClickedAt ? formatTs(selectedLead.waClickedAt) : <Tag color="warning">Belum chat WA</Tag>}</Descriptions.Item>
              <Descriptions.Item label="WA Response Time">{selectedLead.waClickedAt ? diffMenit(selectedLead.createdAt, selectedLead.waClickedAt) : '—'}</Descriptions.Item>
            </Descriptions>

            {/* Tombol aksi — dipindah ke bawah detail */}
            <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
              {selectedLead.hp && (
                <Button
                  icon={<WhatsAppOutlined />}
                  onClick={() => handleWAClick(selectedLead)}
                  style={{ flex: 1, minWidth: 100, background: '#25D366', borderColor: '#25D366', color: '#fff' }}
                >
                  Chat WA
                </Button>
              )}
              <Button
                icon={<MessageOutlined />}
                onClick={() => { setDrawer(false); openFollowUp(selectedLead!); }}
                style={{ flex: 1, minWidth: 100, background: '#10B981', borderColor: '#10B981', color: '#fff' }}
              >
                Follow Up
              </Button>
              <Button
                type="primary"
                icon={<EditOutlined />}
                onClick={() => { setDrawer(false); openEdit(selectedLead!); }}
                style={{ flex: 1, minWidth: 100, background: '#1F4E79' }}
              >
                Edit
              </Button>
            </div>

            {(selectedLead.followUpHistory?.length ?? 0) > 0 && (
              <>
                <Divider style={{ margin: '16px 0 12px' }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>Riwayat Follow Up ({selectedLead.followUpHistory!.length})</Text>
                </Divider>
                <Timeline
                  items={selectedLead.followUpHistory!.map(entry => ({
                    color: entry.status?.toLowerCase() === 'drop' ? '#94A3B8' : '#10B981',
                    content: (
                      <div>
                        <Space size={6} wrap>
                          <Tag color={entry.status?.toLowerCase() === 'drop' ? 'default' : getStatusColor(entry.status)} style={{ margin: 0 }}>
                            {entry.status?.toLowerCase() === 'drop' ? '🚫 Drop' : entry.status}
                          </Tag>
                          <Text type="secondary" style={{ fontSize: 11 }}>{entry.lastUpdate ? dayjs(entry.lastUpdate).format('DD MMM YYYY HH:mm') : '—'}</Text>
                          <Text type="secondary" style={{ fontSize: 11 }}>· {entry.createdByNama}</Text>
                        </Space>
                        {entry.dropReason && <div style={{ marginTop: 4, fontSize: 12, color: '#EF4444' }}>Alasan: {entry.dropReason}</div>}
                        {entry.notes && <div style={{ marginTop: 4, fontSize: 13 }}>{entry.notes}</div>}
                        {entry.nextAction && <Text type="secondary" style={{ fontSize: 11 }}><CalendarOutlined style={{ marginRight: 4 }} />Next: {entry.nextAction}</Text>}
                      </div>
                    ),
                  }))}
                />
              </>
            )}
          </>
        )}
      </Drawer>
    </div>
  );
}