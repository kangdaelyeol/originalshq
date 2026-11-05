import { useAppearance } from '@/ohq-ui/appearance/appearance'
import { GlassCard } from '../../components/layout-parts'
import { SharedPhotoPicker, type SharedPhotoPickerProps } from './shared-photo-picker'

/**
 * Monday 표 배경 사진 — 팀이 공유한 사진을 Monday 바탕 대신 깐다(판은 그대로 불투명이라 글자는 그대로 읽힌다).
 * 유리 배경과 따로 고른다(mondayPhotoId). 사진은 판 사이·바깥 여백으로 보인다.
 */
export function MondayPhotoCard(props: Pick<SharedPhotoPickerProps, 'shared' | 'uploading' | 'onUpload'>) {
  const { mondayPhotoId, setMondayPhoto } = useAppearance()
  return (
    <GlassCard title="배경 사진">
      <SharedPhotoPicker
        {...props}
        selectedId={mondayPhotoId}
        onSelect={setMondayPhoto}
        onCleared={() => setMondayPhoto(null)}
        none={{ label: 'Monday 바탕', description: '사진 없이 Monday 바탕색', onSelect: () => setMondayPhoto(null) }}
      />
    </GlassCard>
  )
}
