import { useCallback, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent } from 'react'
import {
  BRAND_OPTIONS,
  Channel,
  ChannelKo,
  type BrandId,
  type CsvFileInput,
  type DetectedChannel,
  type ImportCsvResult,
  type PreviewCsvResult,
} from '../types'
import { fileToBase64 } from '../utils'
import { importCsv, previewCsv } from '../client'

export interface SelectedFile {
  id: string
  file: File
  channelHint: DetectedChannel | null
}

export type Stage =
  | 'idle'
  | 'previewing'
  | 'previewed'
  | 'importing'
  | 'imported'

/** ChannelKo 매핑을 그대로 재사용 — 별도로 라벨을 하드코딩하지 않는다. */
export const CHANNEL_OPTIONS: readonly { value: Channel; label: string }[] =
  Channel.map((value) => ({ value, label: ChannelKo[value] }))

function makeId(file: File): string {
  return `${file.name}-${file.size}-${file.lastModified}`
}

async function toFileInputs(selected: SelectedFile[]): Promise<CsvFileInput[]> {
  return Promise.all(
    selected.map(async (sf) => ({
      name: sf.file.name,
      contentBase64: await fileToBase64(sf.file),
      channelHint: sf.channelHint,
    })),
  )
}

export const useCsvImporterViewModel = () => {
  const [brandId, setBrandId] = useState<BrandId>(BRAND_OPTIONS[0].id)
  const [selected, setSelected] = useState<SelectedFile[]>([])
  const [stage, setStage] = useState<Stage>('idle')
  const [preview, setPreview] = useState<PreviewCsvResult | null>(null)
  const [importResult, setImportResult] = useState<ImportCsvResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const addFiles = useCallback((files: FileList | File[]) => {
    const incoming = Array.from(files).filter((f) =>
      f.name.toLowerCase().endsWith('.csv'),
    )
    if (incoming.length === 0) return
    setSelected((prev) => {
      const existingIds = new Set(prev.map((sf) => sf.id))
      const additions = incoming
        .map((file) => ({
          id: makeId(file),
          file,
          channelHint: null as DetectedChannel | null,
        }))
        .filter((sf) => !existingIds.has(sf.id))
      return [...prev, ...additions]
    })
    setPreview(null)
    setImportResult(null)
    setStage('idle')
  }, [])

  const removeFile = useCallback((id: string) => {
    setSelected((prev) => prev.filter((sf) => sf.id !== id))
    setPreview(null)
    setImportResult(null)
    setStage('idle')
  }, [])

  const setChannelHint = useCallback(
    (id: string, value: DetectedChannel | null) => {
      setSelected((prev) =>
        prev.map((sf) => (sf.id === id ? { ...sf, channelHint: value } : sf)),
      )
    },
    [],
  )

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setIsDragOver(false)
      if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files)
    },
    [addFiles],
  )

  const handleFileInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.length) addFiles(e.target.files)
      e.target.value = ''
    },
    [addFiles],
  )

  const handlePreview = useCallback(async () => {
    if (selected.length === 0) return
    setError(null)
    setImportResult(null)
    setStage('previewing')
    try {
      const files = await toFileInputs(selected)
      const result = await previewCsv({ brandId, files })
      setPreview(result)
      setStage('previewed')
    } catch (err) {
      setError(
        err instanceof Error ? err.message : '미리보기 중 오류가 발생했습니다.',
      )
      setStage('idle')
    }
  }, [brandId, selected])

  const handleImport = useCallback(async () => {
    if (selected.length === 0) return
    setError(null)
    setStage('importing')
    try {
      const files = await toFileInputs(selected)
      const result = await importCsv({ brandId, files })
      setImportResult(result)
      setStage('imported')
    } catch (err) {
      setError(
        err instanceof Error ? err.message : '적재 중 오류가 발생했습니다.',
      )
      setStage('previewed')
    }
  }, [brandId, selected])

  const reset = useCallback(() => {
    setSelected([])
    setPreview(null)
    setImportResult(null)
    setError(null)
    setStage('idle')
  }, [])

  const busy = stage === 'previewing' || stage === 'importing'
  const totalWarnings =
    preview?.files.reduce((n, f) => n + f.warnings.length, 0) ?? 0

  return {
    // 입력
    brandId,
    setBrandId,
    // 파일 목록
    selected,
    addFiles,
    removeFile,
    setChannelHint,
    // 드롭존
    isDragOver,
    setIsDragOver,
    handleDrop,
    fileInputRef,
    handleFileInputChange,
    // 진행 상태
    stage,
    busy,
    // 결과
    preview,
    importResult,
    error,
    totalWarnings,
    // 액션
    handlePreview,
    handleImport,
    reset,
  }
}
