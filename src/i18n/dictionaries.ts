import { ui, type EditorText, type Language } from '@/config/localization';

export type Dictionary = EditorText;

export async function getDictionary(language: Language): Promise<Dictionary> {
  return ui[language];
}
