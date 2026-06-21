'use client';

import React, { useEffect, useState } from 'react';
import { Card, Tabs, Space } from 'antd';
import { BarChartOutlined, ClockCircleOutlined, HistoryOutlined } from '@ant-design/icons';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import PerformaContent from '@/components/PerformaContent';
import ResponseTimeContent from '@/components/ResponseTimeContent';
import ActivityLogContent from '@/components/ActivityLogContent';

export default function ReportPage() {
  const router = useRouter();
  const [authorized, setAuth] = useState<boolean | null>(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      if (!firebaseUser) { router.push('/login'); return; }
      const snap = await getDoc(doc(db, 'users', firebaseUser.uid));
      if (!snap.exists() || snap.data()?.role !== 'admin') {
        setAuth(false);
        router.push('/forbidden');
        return;
      }
      setAuth(true);
    });
    return () => unsubscribe();
  }, [router]);

  if (authorized === false) return null;

  const tabItems = [
    {
      key: 'performa',
      label: <Space><BarChartOutlined />Performa</Space>,
      children: <PerformaContent />,
    },
    {
      key: 'response',
      label: <Space><ClockCircleOutlined />Response Time</Space>,
      children: <ResponseTimeContent />,
    },
    {
      key: 'activity',
      label: <Space><HistoryOutlined />Activity Log</Space>,
      children: <ActivityLogContent />,
    },
  ];

  return (
    <div className="sh-page">
      <div className="sh-page-title">Reports</div>
      <div className="sh-page-subtitle">Ringkasan performa, response time, & aktivitas</div>
      <Card style={{ marginTop: 16 }}>
        <Tabs items={tabItems} defaultActiveKey="performa" style={{ minHeight: 320 }} destroyOnHidden />
      </Card>
    </div>
  );
}