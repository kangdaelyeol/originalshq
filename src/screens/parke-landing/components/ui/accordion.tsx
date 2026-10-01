import {
  createContext,
  useCallback,
  useContext,
  useId,
  useMemo,
  useState,
  type ComponentProps,
  type ReactNode,
} from 'react'
import { ChevronDownIcon } from 'lucide-react'

/**
 * Stand-in for the handoff's shadcn/@base-ui accordion. The landing CSS styles
 * it through `[data-slot=...]`, so the slots and the open/closed state
 * attributes are what matter here — not the implementation.
 */

type AccordionContextValue = {
  openValues: string[]
  toggle: (value: string) => void
}

const AccordionContext = createContext<AccordionContextValue | null>(null)

type ItemContextValue = {
  value: string
  open: boolean
  triggerId: string
  panelId: string
}

const ItemContext = createContext<ItemContextValue | null>(null)

function useAccordion() {
  const context = useContext(AccordionContext)
  if (!context)
    throw new Error('Accordion parts must be used within <Accordion>')
  return context
}

function useAccordionItem() {
  const context = useContext(ItemContext)
  if (!context)
    throw new Error('Accordion parts must be used within <AccordionItem>')
  return context
}

type AccordionProps = Omit<
  ComponentProps<'div'>,
  'defaultValue' | 'value' | 'onChange'
> & {
  /** Allow more than one panel open at a time. Matches the handoff default. */
  openMultiple?: boolean
  defaultValue?: string[]
}

function Accordion({
  openMultiple = true,
  defaultValue = [],
  children,
  ...props
}: AccordionProps) {
  const [openValues, setOpenValues] = useState<string[]>(defaultValue)

  const toggle = useCallback(
    (value: string) => {
      setOpenValues((current) => {
        if (current.includes(value))
          return current.filter((entry) => entry !== value)
        return openMultiple ? [...current, value] : [value]
      })
    },
    [openMultiple],
  )

  const context = useMemo(() => ({ openValues, toggle }), [openValues, toggle])

  return (
    <AccordionContext.Provider value={context}>
      <div data-slot="accordion" {...props}>
        {children}
      </div>
    </AccordionContext.Provider>
  )
}

function AccordionItem({
  value,
  children,
  ...props
}: ComponentProps<'div'> & { value: string }) {
  const { openValues } = useAccordion()
  const id = useId()
  const open = openValues.includes(value)
  const context = useMemo(
    () => ({ value, open, triggerId: `${id}-trigger`, panelId: `${id}-panel` }),
    [value, open, id],
  )

  return (
    <ItemContext.Provider value={context}>
      <div
        data-slot="accordion-item"
        data-state={open ? 'open' : 'closed'}
        {...props}
      >
        {children}
      </div>
    </ItemContext.Provider>
  )
}

function AccordionTrigger({ children, ...props }: ComponentProps<'button'>) {
  const { toggle } = useAccordion()
  const { value, open, triggerId, panelId } = useAccordionItem()

  return (
    <h3 data-slot="accordion-header">
      <button
        type="button"
        id={triggerId}
        data-slot="accordion-trigger"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => toggle(value)}
        {...props}
      >
        {children}
        <ChevronDownIcon
          data-slot="accordion-trigger-icon"
          aria-hidden="true"
        />
      </button>
    </h3>
  )
}

function AccordionContent({
  children,
  ...props
}: ComponentProps<'div'> & { children?: ReactNode }) {
  const { open, triggerId, panelId } = useAccordionItem()

  return (
    <div
      id={panelId}
      role="region"
      aria-labelledby={triggerId}
      data-slot="accordion-content"
      data-state={open ? 'open' : 'closed'}
      {...props}
    >
      <div>{children}</div>
    </div>
  )
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }
