import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { AntdRegistry } from '@ant-design/nextjs-registry';
import ConditionalLayout from '@/components/ConditionalLayout';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'SalesHub – Your Central Hub for Leads & Sales.',
  description: 'CRM untuk developer properti',
  manifest: '/manifest.json',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className={inter.className}>
        <AntdRegistry>
          <ConditionalLayout>{children}</ConditionalLayout>
        </AntdRegistry>
      </body>
    </html>
  );
}