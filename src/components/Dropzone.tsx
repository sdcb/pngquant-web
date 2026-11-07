import { useRef, type ReactNode } from 'react'
import { useI18n } from '../i18n/context'

type Props = {
  onFiles: (files: FileList | File[] | null) => void
  className?: string
  children: ReactNode
}

/** Opens the file picker on click or Enter/Space. Dropping and pasting are handled for the whole window in App. */
export function Dropzone({ onFiles, className = '', children }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const { t } = useI18n()

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={t.pickImage}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          inputRef.current?.click()
        }
      }}
      onClick={() => inputRef.current?.click()}
      className={[
        'cursor-pointer rounded-2xl border border-dashed border-line-strong transition-colors hover:border-gold/50 hover:bg-white/[0.015]',
        className,
      ].join(' ')}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          onFiles(event.target.files)
          event.currentTarget.value = ''
        }}
      />
      {children}
    </div>
  )
}
