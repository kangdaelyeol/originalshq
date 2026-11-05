import { FileText, ImagePlus, RotateCcw, Upload } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { WaterButton, WaterChips, type WaterOption } from '@/ohq-ui/water/controls'
import type { TechBoardMeta } from '@xtool-core/tech-boards'
import { WaterItemFiles } from '../board/water-item-files'
import { dropOn, samplePhotoFile, useSampleFiles, type SampleUploadMode } from './sample-files'

// 보기만 — actions 없이(주소만 가짜) 그리면 기존 ItemFiles와 같은 기능: 파일이 있는 칸만, 단추·놓을 자리 없음
const KINDS: WaterOption<'edit' | 'view'>[] = [
  { value: 'edit', label: '올리기 켬' },
  { value: 'view', label: '보기만' },
]

const MODES: WaterOption<SampleUploadMode>[] = [
  { value: 'fast', label: '빠르게' },
  { value: 'slow', label: '느리게' },
  { value: 'fail', label: '실패' },
]

// 견본 보드 — 파일 칸 둘만(useSampleFiles가 더한다)
const META: TechBoardMeta = {
  key: 'sample-files',
  boardId: '0',
  name: '견본 보드',
  columns: [],
  groups: [],
  syncedAt: null,
  lastSync: null,
}

let dropped = 0

/**
 * 물 파일 칸 견본 — 상세 서랍 속처럼 불투명 유리 판 위에 띄운다. "올리기"(파일 고르기)·끌어다 놓기는 진짜로
 * 되고, 위 단추는 견본 파일을 칸에 끌어다 놓은 것처럼 보낸다(진짜 drop 이벤트). 다음 올리기를 느리게·실패로
 * 바꿔 진행·실패·다시 시도를 볼 수 있다. 실제로 아무 데도 올리지 않는다.
 */
export function FilesSample() {
  const files = useSampleFiles(META)
  const [kind, setKind] = useState<'edit' | 'view'>('edit')
  const viewOnly = useMemo(() => ({ links: files.actions.links }), [files.actions])
  const box = useRef<HTMLDivElement>(null)
  const zoneOf = (columnId: string) => box.current?.querySelector(`.water-files[data-column="${columnId}"]`)

  const dropPhoto = async () => {
    const file = await samplePhotoFile(++dropped)
    const zone = zoneOf('photos')
    if (zone) dropOn(zone, file)
  }
  const dropDoc = () => {
    const zone = zoneOf('docs')
    if (zone) dropOn(zone, new File(['견본 문서'], `견본 문서 ${++dropped}.pdf`, { type: 'application/pdf' }))
  }
  // 10MB 넘는 파일 — 기존 검사(checkFile)에 걸려 글로만 알린다(올리지 않는다)
  const dropBig = () => {
    const zone = zoneOf('docs')
    if (zone) dropOn(zone, new File([new Uint8Array(10 * 1024 * 1024 + 1)], '큰 영상.mp4', { type: 'video/mp4' }))
  }

  return (
    <div className="water-files-demo">
      <div className="water-files-demo__bar">
        <WaterChips ariaLabel="견본 쓰임" options={KINDS} value={kind} onChange={setKind} size="sm" />
        <WaterChips ariaLabel="다음 올리기" options={MODES} value={files.mode} onChange={files.setMode} size="sm" />
        <WaterButton variant="ghost" size="sm" icon={ImagePlus} onClick={() => void dropPhoto()}>
          사진 놓기
        </WaterButton>
        <WaterButton variant="ghost" size="sm" icon={FileText} onClick={dropDoc}>
          문서 놓기
        </WaterButton>
        <WaterButton variant="ghost" size="sm" icon={Upload} onClick={dropBig}>
          10MB 넘는 파일
        </WaterButton>
        <WaterButton variant="ghost" size="sm" icon={RotateCcw} onClick={files.reset}>
          처음으로
        </WaterButton>
      </div>
      <div ref={box} className="water-files-demo__panel">
        <WaterItemFiles
          meta={files.meta}
          item={files.itemOf('demo')}
          actions={kind === 'edit' ? files.actions : viewOnly}
        />
      </div>
    </div>
  )
}
