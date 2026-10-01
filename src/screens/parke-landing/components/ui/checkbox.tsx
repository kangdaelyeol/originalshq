import type { ComponentProps } from 'react'

/**
 * Stand-in for the handoff's shadcn/@base-ui checkbox. The landing CSS styles
 * `[data-slot=checkbox]` and the checked state through `[data-checked]`.
 *
 * It stays a real `<input type="checkbox">` so `<label htmlFor>` and form
 * semantics keep working; the tick mark is drawn in `styles/base.css` rather
 * than by an icon child.
 */
function Checkbox({
  checked = false,
  onCheckedChange,
  onChange,
  ...props
}: Omit<ComponentProps<'input'>, 'type' | 'checked'> & {
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
}) {
  return (
    <input
      type="checkbox"
      checked={checked}
      data-slot="checkbox"
      data-checked={checked ? '' : undefined}
      onChange={(event) => {
        onChange?.(event)
        onCheckedChange?.(event.target.checked)
      }}
      {...props}
    />
  )
}

export { Checkbox }
