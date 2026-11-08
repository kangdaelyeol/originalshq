import { Linking } from 'react-native';
import { ExternalLink } from 'lucide-react-native';
import type { TechBoardMeta, TechItemDoc } from '@xtool-core/tech-boards';
import type { DetailSpec } from '../../../features/dashboard/boards';
import { useItemFiles } from '../../../features/dashboard/item-files';
import { useParts } from '../parts';

// 상세 "정보" — 웹 RecordDrawer 본문: 이름/값 목록(연락처는 전화, 교체 영상은 열기), 긴 글(빈 것은 뺀다), 작은 목록
// (설치 품목·청구 부품), 파일(사진은 썸네일 — 누르면 기기의 기본 보기로 연다). 칸·순서는 보드 정의가 정한다.

export function DetailBody({
  detail,
  meta,
  item,
}: {
  detail: DetailSpec;
  meta: TechBoardMeta | null;
  item: TechItemDoc | null;
}) {
  const P = useParts();
  return (
    <>
      <P.DetailFields
        fields={detail.fields.map(field => ({
          key: field.key,
          label: field.label,
          value: field.value,
          content: field.phone ? (
            <P.PhoneLink phone={field.phone} />
          ) : field.link ? (
            <P.Button
              variant="plain"
              size="sm"
              icon={ExternalLink}
              label={field.link.label}
              onPress={() => {
                if (field.link) Linking.openURL(field.link.url).catch(() => undefined);
              }}
            />
          ) : undefined,
        }))}
      />
      {detail.texts.map(t => (t.text ? <P.DetailText key={t.label} label={t.label} text={t.text} /> : null))}
      {detail.lists.map(list => (
        <P.DetailList key={list.key} title={list.title} items={list.items} />
      ))}
      <ItemFiles meta={meta} item={item} />
    </>
  );
}

/** 파일 칸(웹 ItemFiles) — 파일 칸이 있는 보드만. 올리기·지우기는 웹에서 */
function ItemFiles({ meta, item }: { meta: TechBoardMeta | null; item: TechItemDoc | null }) {
  const P = useParts();
  const files = useItemFiles(meta, item);
  if (!files.hasFileColumns) return null;
  return (
    <>
      <P.FileList
        title={files.files.length ? `파일 ${files.files.length}` : '파일'}
        files={files.files}
        empty="올린 파일이 없어요."
        onPressFile={files.open}
      />
      {files.loading && <P.Notice loading text="파일 주소를 받는 중…" />}
      {files.error && (
        <P.Notice
          tone="error"
          text={`파일을 열 주소를 받지 못했어요 — ${files.error}`}
          action={{ label: '다시 시도', onPress: files.retry }}
        />
      )}
    </>
  );
}
