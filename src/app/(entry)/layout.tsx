import type { Metadata } from 'next';
import { ui } from '@/config/localization';
import '../../styles.css';

export const metadata: Metadata = {
  title: ui.zh.appName,
  description: ui.zh.description,
};

export default function EntryLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh">
      <body>{children}</body>
    </html>
  );
}
