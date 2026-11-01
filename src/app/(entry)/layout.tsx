import type { Metadata } from 'next';
import '../../styles.css';

export const metadata: Metadata = {
  title: 'Perler Beads Generator',
  description: 'Create printable Perler bead patterns from images.',
};

export default function EntryLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh">
      <body>{children}</body>
    </html>
  );
}
