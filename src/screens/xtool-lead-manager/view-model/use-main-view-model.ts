import { useState } from 'react'
import { sampleLeads } from '../sample-data'
import type { ConfirmVariant, Device, Lead } from '../types'

export type UserState = 'new' | 'contacted' | 'purchased'

type Field = 'fn' | 'ph' | 'price'

type EditingCell = {
  rowId: string
  field: Field
} | null

export const useMainViewModel = () => {
  const [allChecked, setAllChecked] = useState(false)
  const [rows, setRows] = useState<Lead[]>(sampleLeads)
  const [editingCell, setEditingCell] = useState<EditingCell>(null)
  const [newReadFold, setNewReadFold] = useState(false)
  const [readCompleteFold, setReadCompleteFold] = useState(false)
  const [purchaseCompleteFold, setPurchaseCompleteFold] = useState(false)
  const [selectedRowIndex, setSelectedRowIndex] = useState<number>(-1)
  const [variant, setVariant] = useState<ConfirmVariant>('delete')

  const registerCustomer = async (): Promise<void> => {
    await new Promise<void>((resolve) =>
      setTimeout(() => {
        setRows((prev) => {
          const newRows = [...prev]
          const newRow = { ...newRows[selectedRowIndex] }
          if (newRows[selectedRowIndex].state === 'new')
            newRow.state = 'contacted'
          else newRow.state = 'purchased'
          newRows[selectedRowIndex] = newRow
          return newRows
        })
        setSelectedRowIndex(-1)
        resolve()
      }, 500),
    )
  }

  const deleteCustomer = async (): Promise<void> => {
    await new Promise<void>((resolve) =>
      setTimeout(() => {
        resolve()
      }, 500),
    )
  }

  const handleConfirmClick = async () => {
    if (variant === 'delete') await deleteCustomer()
    if (variant === 'register') await registerCustomer()
  }

  const handleCancelConfirmClick = () => {
    setSelectedRowIndex(-1)
  }

  const toggleNewReadFold = () => {
    setNewReadFold((prev) => !prev)
  }

  const toggleReadCompleteFold = () => {
    setReadCompleteFold((prev) => !prev)
  }

  const togglePurchasCompleteFold = () => {
    setPurchaseCompleteFold((prev) => !prev)
  }

  const handleEditingKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === 'Escape') stopEditing()
  }

  const createNewReadRow = () => {
    setRows((prev) => {
      const newRows = [...prev]
      newRows.push({
        id: Date.now().toString(),
        createdAt: Date.now(),
        fn: '',
        ph: '',
        device: 'Metalfab',
        purchasedAt: 0,
        price: 0,
        state: 'new',
        utm_campaign: '',
        utm_medium: '',
        utm_source: '',
        ip: '',
        user_agent: '',
        fbc: '',
        fbp: '',
      })
      return newRows
    })
  }

  const toggleAllChecked = () => {
    setAllChecked((prev) => !prev)
  }

  const startEditing = (rowId: string, field: Field) => {
    setEditingCell({ rowId, field })
  }

  const updateCellValue = (rowId: string, field: Field, value: string) => {
    setRows((prev) =>
      prev.map((row) => (row.id === rowId ? { ...row, [field]: value } : row)),
    )
  }

  const stopEditing = () => {
    setEditingCell(null)
  }

  const updateDevice = (rowId: string, device: Device) => {
    setRows((prev) =>
      prev.map((row) => (row.id === rowId ? { ...row, device } : row)),
    )
  }

  const deleteRow = (rowId: string) => {
    const idx = rows.findIndex((row) => row.id === rowId)
    if (idx === -1) return
    setSelectedRowIndex(idx)
    setVariant('delete')
  }

  const registerRow = async (rowId: string) => {
    const idx = rows.findIndex((row) => row.id === rowId)
    if (idx === -1) return
    setSelectedRowIndex(idx)
    setVariant('register')
  }

  return {
    state: {
      allChecked,
      editingCell,
      rows,
      newReadFold,
      readCompleteFold,
      purchaseCompleteFold,
      selectedRowIndex,
      variant,
    },
    actions: {
      toggleAllChecked,
      startEditing,
      updateCellValue,
      stopEditing,
      updateDevice,
      deleteRow,
      registerRow,
      handleEditingKeyDown,
      toggleNewReadFold,
      createNewReadRow,
      toggleReadCompleteFold,
      togglePurchasCompleteFold,
      handleCancelConfirmClick,
      handleConfirmClick,
    },
  }
}
