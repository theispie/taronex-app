'use client';

import { createContext, useCallback, useContext, useMemo } from 'react';
import { type DictKey, translate } from './dictionary';
import { DEFAULT_LOCALE, type Locale } from './types';

/**
 * ส่งภาษาจาก server component ลงมาให้ client component ใช้
 *
 * ไม่ให้ฝั่ง client ไปอ่านคุกกี้เอง เพราะจะวาดครั้งแรกด้วยภาษาผิดแล้วกระพริบ
 * (server รู้ภาษาตั้งแต่ก่อนส่ง HTML ออกมา)
 */
const Ctx = createContext<Locale>(DEFAULT_LOCALE);

export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  return <Ctx.Provider value={locale}>{children}</Ctx.Provider>;
}

export function useLocale(): Locale {
  return useContext(Ctx);
}

export function useT() {
  const locale = useLocale();
  const t = useCallback(
    (key: DictKey, vars?: Record<string, string | number>) => translate(locale, key, vars),
    [locale],
  );
  return useMemo(() => ({ t, locale }), [t, locale]);
}
