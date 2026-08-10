import { useState } from 'react'
import { sampleLeads } from '../sample-data'
import type { Lead } from '../hooks/types'

export type UserState = 'new' | 'contacted' | 'purchased'

type Field = 'fn' | 'ph' | 'price'

type EditingCell = {
  rowId: string
  field: Field
} | null

// TODO: Register
async function registerCustomerCAPI(): Promise<{ success: boolean }> {
  await new Promise((resolve) => setTimeout(resolve, 800))
  return { success: true }
}

export const useMainViewModel = () => {
  const [allChecked, setAllChecked] = useState(false)
  const [rows, setRows] = useState<Lead[]>(sampleLeads)

  const [editingCell, setEditingCell] = useState<EditingCell>(null)
  const [newReadFold, setNewReadFold] = useState(false)
  const [readCompleteFold, setReadCompleteFold] = useState(false)
  const [purchaseCompleteFold, setPurchaseCompleteFold] = useState(false)

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
        device: 'metalfab',
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

  const updateDevice = (rowId: string, device: string) => {
    setRows((prev) =>
      prev.map((row) => (row.id === rowId ? { ...row, device } : row)),
    )
  }

  const deleteRow = (rowId: string) => {
    setRows((prev) => prev.filter((row) => row.id !== rowId))
  }

  const registerRow = async (rowId: string) => {
    const target = rows.find((row) => row.id === rowId)
    if (!target) return

    try {
      const result = await registerCustomerCAPI()
      setRows((prev) =>
        prev.map((row) =>
          row.id === rowId
            ? { ...row, registering: false, registered: result.success }
            : row,
        ),
      )
    } catch (e) {
      console.log(e)
      setRows((prev) =>
        prev.map((row) =>
          row.id === rowId ? { ...row, registering: false } : row,
        ),
      )
    }
  }

  return {
    state: {
      allChecked,
      editingCell,
      rows,
      newReadFold,
      readCompleteFold,
      purchaseCompleteFold,
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
    },
  }
}
