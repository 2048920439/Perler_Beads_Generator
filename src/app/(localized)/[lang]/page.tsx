import { notFound } from 'next/navigation';
import ClientEntry from '../../client-entry';
import { isLanguage, supportedLanguages } from '@/config/localization';

export function generateStaticParams() {
  return supportedLanguages.map((lang) => ({ lang }));
}

export default async function LocalePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLanguage(lang)) notFound();
  return <ClientEntry language={lang} />;
}
