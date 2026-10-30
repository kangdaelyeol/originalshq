import { useId, type InputHTMLAttributes } from 'react'

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
}

export function TextField({ label, id, ...rest }: TextFieldProps) {
  const fallbackId = useId()
  const inputId = id ?? fallbackId
  return (
    <div className="field">
      <label className="field__label" htmlFor={inputId}>
        {label}
      </label>
      <input id={inputId} className="field__input" {...rest} />
    </div>
  )
}
