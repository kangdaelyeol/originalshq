import {
  DeviceFilterLabel,
  SortField,
  type Lead,
  type SortDirection,
} from '../types'

export const filterLeadsByKeywords = (rows: Lead[], keyword: string) => {
  const trimmed = keyword.trim().toLowerCase()
  if (!trimmed) return rows
  return rows.filter((row) => row.fn.toLowerCase().includes(trimmed))
}

export const sortLeads = (
  rows: Lead[],
  sortField: SortField,
  sortDirection: SortDirection,
) => {
  const sorted = [...rows]
  sorted.sort((a, b) => {
    let res: number
    if (sortField === SortField.CREATED_AT) {
      res = a.createdAt - b.createdAt
    } else {
      res = a[sortField].localeCompare(b[sortField], 'ko')
    }
    return sortDirection === 'asc' ? res : -res
  })

  return sorted
}

export const filterLeadsByDevice = (
  rows: Lead[],
  deviceFilter: DeviceFilterLabel,
) => {
  if (deviceFilter === DeviceFilterLabel.ALL) return rows
  return rows.filter((row) => row.device === deviceFilter)
}
