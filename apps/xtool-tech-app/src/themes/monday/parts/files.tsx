import { ActivityIndicator, Image, Pressable, ScrollView, View } from 'react-native';
import { ExternalLink, FileText, ImageOff, RotateCcw, Upload } from 'lucide-react-native';
import type { TechBoardMeta, TechItemDoc } from '@xtool-core/tech-boards';
import { useItemFiles } from '../../../features/dashboard/item-files';
import type { FileView } from '../../dashboard/parts';
import type { MonPalette } from '../theme';
import { useMon, useStyles } from '../theme-context';
import { MText } from './basics';
import { Sheet } from './chrome';
import { Notice } from './editors';

// 파일 보기(웹 monday-files-modal의 보기 쪽) — 칸 제목, "{항목} · 파일 N개", 2칸 파일 카드(미리보기 위, 이름·열기 아래).
// 사진은 썸네일, 나머지는 문서 아이콘과 확장자. 누르면 기기의 기본 보기로 연다. 올리기·지우기는 아직 웹에서만(폰에서
// 파일을 고르려면 네이티브 패키지가 필요하다). 주소·썸네일은 대시보드와 같은 useItemFiles(techFileUrls).

export function FilesSheet({
  title,
  itemName,
  meta,
  item,
  onClose,
}: {
  title: string;
  itemName: string;
  meta: TechBoardMeta;
  item: TechItemDoc;
  onClose: () => void;
}) {
  const p = useMon();
  const s = useStyles(styles);
  const files = useItemFiles(meta, item);
  return (
    <Sheet visible onClose={onClose} title={title} tall>
      <MText size={13} color={p.text2} style={s.sub}>
        {itemName} · 파일 {files.files.length}개
      </MText>
      <ScrollView contentContainerStyle={s.body}>
        {!!files.error && (
          <View style={s.error}>
            <MText size={13} color={p.dangerText} style={s.flex}>
              파일 주소를 받지 못했어요 — {files.error}
            </MText>
            <Pressable onPress={files.retry} style={s.retry} hitSlop={6}>
              <RotateCcw size={13} color={p.text} />
              <MText size={13}>다시 시도</MText>
            </Pressable>
          </View>
        )}
        {files.files.length === 0 ? (
          <View style={s.empty}>
            <Upload size={22} color={p.primary} />
            <MText color={p.text2}>올린 파일이 없어요</MText>
          </View>
        ) : (
          <View style={s.grid}>
            {files.files.map(file => (
              <FileCard key={file.key} file={file} loading={files.loading} onOpen={() => files.open(file)} />
            ))}
          </View>
        )}
        <Notice>파일 올리기·지우기는 웹에서 해요 — 사진·동영상·문서, 10MB까지.</Notice>
      </ScrollView>
    </Sheet>
  );
}

/** 파일 카드 — 1px 줄, 반경 8, 위 미리보기(--mon-preview), 아래 이름 13 + 열기 */
function FileCard({ file, loading, onOpen }: { file: FileView; loading: boolean; onOpen: () => void }) {
  const p = useMon();
  const s = useStyles(styles);
  const ext = /\.([a-z0-9]+)$/i.exec(file.name)?.[1]?.toUpperCase() ?? '';
  const Icon = file.kind === 'image' ? ImageOff : FileText;
  return (
    <Pressable
      onPress={onOpen}
      disabled={!file.url}
      style={({ pressed }) => [s.card, pressed && { borderColor: p.lineStrong }]}
      accessibilityLabel={`${file.name} 열기`}
    >
      <View style={s.preview}>
        {file.thumbUrl ? (
          <Image source={{ uri: file.thumbUrl }} style={s.image} resizeMode="cover" />
        ) : loading && !file.url ? (
          <ActivityIndicator size="small" color={p.text2} />
        ) : (
          <>
            <Icon size={24} color={p.text2} />
            {!!ext && (
              <MText size={12} color={p.text2}>
                {ext}
              </MText>
            )}
          </>
        )}
      </View>
      <View style={s.meta}>
        <View style={s.flex}>
          <MText size={13} numberOfLines={1}>
            {file.name}
          </MText>
          {!!file.meta && (
            <MText size={11} color={p.text2} numberOfLines={1}>
              {file.meta}
            </MText>
          )}
        </View>
        <View style={s.open}>
          <ExternalLink size={14} color={file.url ? p.text2 : p.text4} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = (p: MonPalette) => ({
  flex: { flex: 1 },
  sub: { paddingHorizontal: 16, marginTop: -2, marginBottom: 8 },
  body: { paddingHorizontal: 16, paddingBottom: 12, gap: 12 },
  error: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8 },
  retry: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    height: 30,
    paddingHorizontal: 10,
    borderRadius: 4,
    backgroundColor: p.overlay,
  },
  empty: {
    minHeight: 160,
    borderWidth: 1,
    borderStyle: 'dashed' as const,
    borderColor: p.lineStrong,
    borderRadius: 8,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 10,
  },
  grid: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 12 },
  card: {
    flexBasis: '45%' as const,
    flexGrow: 1,
    borderWidth: 1,
    borderColor: p.line,
    borderRadius: 8,
    backgroundColor: p.bg,
    overflow: 'hidden' as const,
  },
  preview: {
    height: 120,
    backgroundColor: p.preview,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
  },
  image: { width: '100%' as const, height: '100%' as const },
  meta: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    paddingVertical: 8,
    paddingLeft: 10,
    paddingRight: 4,
  },
  open: { width: 26, height: 26, alignItems: 'center' as const, justifyContent: 'center' as const },
});
