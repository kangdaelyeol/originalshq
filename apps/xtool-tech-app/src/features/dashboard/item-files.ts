import { useEffect, useMemo, useState } from 'react';
import { Linking } from 'react-native';
import { httpsCallable } from 'firebase/functions';
import { errorText } from '@xtool-core/error-text';
import { xtoolFirebase } from '@xtool-core/firebase';
import type { TechBoardMeta, TechItemDoc } from '@xtool-core/tech-boards';
import type { FileView } from '../../themes/dashboard/parts';
import { fileView } from './part-data';

// 항목의 파일(사진·동영상·문서) — 웹 data/tech-files.ts(filesOf·fetchFileLinks)와 board/item-files.tsx의 보기 쪽. 원본은
// Monday 파일 칸이고, 보기 주소는 우리 함수(techFileUrls)가 주는 Monday 임시 주소(1시간)다. 올리기·지우기는 아직 웹에서만
// (폰에서 파일을 고르려면 네이티브 패키지가 필요하다).

interface FileRef {
  assetId: string;
  name: string;
  isImage: boolean;
  /** 칸 이름 */
  column: string;
}

interface FileLink {
  id: string;
  name: string;
  url: string | null;
  thumbnail: string | null;
  extension: string | null;
  size: number | null;
}

/** 파일 칸 값(JSON) → 올린 파일 목록(링크·Monday 문서는 뺀다) */
function filesOf(value: string | null | undefined): Omit<FileRef, 'column'>[] {
  if (!value) return [];
  try {
    const files = (JSON.parse(value).files ?? []) as {
      assetId?: number | string;
      name?: string;
      isImage?: string | boolean;
      fileType?: string;
    }[];
    return files
      .filter(f => (f.fileType ?? 'ASSET') === 'ASSET' && f.assetId)
      .map(f => ({
        assetId: String(f.assetId),
        name: f.name ?? '파일',
        isImage: f.isImage === true || f.isImage === 'true',
      }));
  } catch {
    return [];
  }
}

// 임시 주소는 1시간 — 50분까지만 다시 쓴다(웹과 같다)
const URL_TTL_MS = 50 * 60 * 1000;
const linkCache = new Map<string, { link: FileLink; at: number }>();

async function fetchFileLinks(itemId: string, assetIds: string[]): Promise<Map<string, FileLink>> {
  const now = Date.now();
  const result = new Map<string, FileLink>();
  const missing: string[] = [];
  for (const id of assetIds) {
    const cached = linkCache.get(id);
    if (cached && now - cached.at < URL_TTL_MS) result.set(id, cached.link);
    else missing.push(id);
  }
  if (missing.length) {
    const { data } = await httpsCallable<{ itemId: string; assetIds: string[] }, { files: FileLink[] }>(
      xtoolFirebase().functions,
      'techFileUrls',
    )({ itemId, assetIds: missing });
    for (const link of data.files) {
      linkCache.set(link.id, { link, at: now });
      result.set(link.id, link);
    }
  }
  return result;
}

const sizeText = (bytes: number | null): string | null =>
  bytes === null
    ? null
    : bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)}MB`
    : `${Math.max(1, Math.round(bytes / 1024))}KB`;

export interface ItemFilesModel {
  /** 파일 칸이 있는 보드인지 */
  hasFileColumns: boolean;
  files: FileView[];
  /** 주소를 받는 중 */
  loading: boolean;
  error: string | null;
  /** 파일 열기(사진·문서 — 기기의 기본 보기로) */
  open: (file: FileView) => void;
  retry: () => void;
}

/** 항목 하나의 파일 — 칸마다 올린 파일과 임시 주소·썸네일 */
export function useItemFiles(meta: TechBoardMeta | null, item: TechItemDoc | null): ItemFilesModel {
  const fileColumns = useMemo(() => (meta ? meta.columns.filter(c => c.type === 'file') : []), [meta]);
  const refs = useMemo<FileRef[]>(
    () =>
      item ? fileColumns.flatMap(c => filesOf(item.values[c.id]?.value).map(f => ({ ...f, column: c.title }))) : [],
    [fileColumns, item],
  );
  const [links, setLinks] = useState<Map<string, FileLink>>(() => new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const itemId = item?.itemId ?? null;
  const assetKey = refs.map(r => r.assetId).join(',');

  useEffect(() => {
    if (!itemId || !assetKey) return;
    let alive = true;
    setLoading(true);
    setError(null);
    fetchFileLinks(itemId, assetKey.split(','))
      .then(map => {
        if (alive) setLinks(map);
      })
      .catch((e: unknown) => {
        if (alive) setError(errorText(e));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [itemId, assetKey, attempt]);

  const files = refs.map(ref => {
    const link = links.get(ref.assetId);
    return fileView({
      key: ref.assetId,
      name: ref.name,
      isImage: ref.isImage,
      url: link?.url ?? null,
      thumbUrl: ref.isImage ? link?.thumbnail ?? link?.url ?? null : null,
      meta: [ref.column, sizeText(link?.size ?? null)].filter(Boolean).join(' · '),
    });
  });

  return {
    hasFileColumns: fileColumns.length > 0,
    files,
    loading,
    error,
    open: file => {
      if (file.url) Linking.openURL(file.url).catch(() => undefined);
    },
    retry: () => setAttempt(n => n + 1),
  };
}
