import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { detectLang, MESSAGES, type Lang, type Messages } from './messages'

const STORAGE_KEY = 'pngquant-web:lang'

function loadLang(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'zh' || stored === 'en') return stored
  } catch {
    // Storage blocked: fall back to the browser language.
  }
  return detectLang()
}

type I18n = {
  lang: Lang
  t: Messages
  setLang: (lang: Lang) => void
}

const I18nContext = createContext<I18n | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(loadLang)
  const t = MESSAGES[lang]

  useEffect(() => {
    document.documentElement.lang = t.htmlLang
    document.querySelector('meta[name="description"]')?.setAttribute('content', t.description)
  }, [t])

  const value = useMemo<I18n>(
    () => ({
      lang,
      t,
      setLang: (next) => {
        setLangState(next)
        try {
          localStorage.setItem(STORAGE_KEY, next)
        } catch {
          // Not persisted; the choice still holds for this visit.
        }
      },
    }),
    [lang, t],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

// eslint-disable-next-line react/only-export-components
export function useI18n(): I18n {
  const value = useContext(I18nContext)
  if (!value) throw new Error('useI18n must be used inside I18nProvider')
  return value
}
