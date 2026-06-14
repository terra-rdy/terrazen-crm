'use client';

import { usePathname } from 'next/navigation';
import LayoutSalesHub from '@/components/LayoutSalesHub';

const NO_LAYOUT_PATHS = ['/login', '/forbidden'];

export default function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const noLayout = NO_LAYOUT_PATHS.some(p => pathname.startsWith(p));

  if (noLayout) return <>{children}</>;
  return <LayoutSalesHub>{children}</LayoutSalesHub>;
}