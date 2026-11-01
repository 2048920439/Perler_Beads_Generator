'use client';

import dynamic from 'next/dynamic';
import type { Language } from '@/config/localization';

const ClientApp = dynamic(() => import('./client-app'), { ssr: false });

export default function ClientEntry({ language }: { language: Language }) {
  return <ClientApp language={language} />;
}
