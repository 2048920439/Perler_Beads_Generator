import type { Metadata } from 'next';
import { ui } from '@/config/localization';
import '../../styles.css';

export const metadata: Metadata = {
  title: ui.zh.appName,
  description: '从图片创建可打印的拼豆图纸。',
};

export default function EntryLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh">
      <body>{children}</body>
    </html>
  );
}
