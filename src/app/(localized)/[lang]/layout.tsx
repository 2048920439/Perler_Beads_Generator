import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isLanguage, supportedLanguages } from '@/config/localization';
import { getDictionary } from '@/i18n/dictionaries';
import '../../../styles.css';

export function generateStaticParams() {
  return supportedLanguages.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLanguage(lang)) notFound();
  const dictionary = await getDictionary(lang);
  return {
    title: dictionary.appName,
    description: lang === 'zh'
      ? '从图片创建可打印的拼豆图纸。'
      : 'Create printable Perler bead patterns from images.',
  };
}

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{ children: React.ReactNode; params: Promise<{ lang: string }> }>) {
  const { lang } = await params;
  if (!isLanguage(lang)) notFound();
  return (
    <html lang={lang}>
      <body>{children}</body>
    </html>
  );
}
