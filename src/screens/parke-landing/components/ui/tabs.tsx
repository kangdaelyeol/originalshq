import {
  createContext,
  useCallback,
  useContext,
  useId,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type KeyboardEvent,
} from 'react'

/**
 * Stand-in for the handoff's shadcn/@base-ui tabs. The landing CSS selects on
 * `[data-slot=tabs-trigger][data-active]` and `[aria-selected=true]`, so both
 * are emitted for the active tab.
 */

type TabsContextValue = {
  value: string
  setValue: (value: string) => void
  baseId: string
}

const TabsContext = createContext<TabsContextValue | null>(null)

function useTabs() {
  const context = useContext(TabsContext)
  if (!context) throw new Error('Tabs parts must be used within <Tabs>')
  return context
}

type TabsProps = Omit<ComponentProps<'div'>, 'onChange' | 'defaultValue'> & {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
}

function Tabs({
  value,
  defaultValue,
  onValueChange,
  children,
  ...props
}: TabsProps) {
  const [uncontrolled, setUncontrolled] = useState(defaultValue ?? '')
  const baseId = useId()
  const current = value ?? uncontrolled

  const setValue = useCallback(
    (next: string) => {
      if (value === undefined) setUncontrolled(next)
      onValueChange?.(next)
    },
    [value, onValueChange],
  )

  const context = useMemo(
    () => ({ value: current, setValue, baseId }),
    [current, setValue, baseId],
  )

  return (
    <TabsContext.Provider value={context}>
      <div data-slot="tabs" data-orientation="horizontal" {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  )
}

function TabsList({ children, ...props }: ComponentProps<'div'>) {
  const list = useRef<HTMLDivElement>(null)

  // Roving arrow-key navigation, the one tablist behaviour the CSS cannot supply.
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    const tabs = Array.from(
      list.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? [],
    )
    const index = tabs.indexOf(document.activeElement as HTMLButtonElement)
    if (index === -1) return
    event.preventDefault()
    const step = event.key === 'ArrowRight' ? 1 : -1
    tabs[(index + step + tabs.length) % tabs.length].focus()
  }

  return (
    <div
      ref={list}
      role="tablist"
      data-slot="tabs-list"
      onKeyDown={onKeyDown}
      {...props}
    >
      {children}
    </div>
  )
}

function TabsTrigger({
  value,
  children,
  ...props
}: ComponentProps<'button'> & { value: string }) {
  const { value: active, setValue, baseId } = useTabs()
  const selected = active === value

  return (
    <button
      type="button"
      role="tab"
      id={`${baseId}-tab-${value}`}
      aria-selected={selected}
      aria-controls={`${baseId}-panel-${value}`}
      tabIndex={selected ? 0 : -1}
      data-slot="tabs-trigger"
      data-active={selected ? '' : undefined}
      onClick={() => setValue(value)}
      {...props}
    >
      {children}
    </button>
  )
}

function TabsContent({
  value,
  children,
  ...props
}: ComponentProps<'div'> & { value: string }) {
  const { value: active, baseId } = useTabs()
  if (active !== value) return null

  return (
    <div
      role="tabpanel"
      id={`${baseId}-panel-${value}`}
      aria-labelledby={`${baseId}-tab-${value}`}
      tabIndex={0}
      data-slot="tabs-content"
      {...props}
    >
      {children}
    </div>
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
