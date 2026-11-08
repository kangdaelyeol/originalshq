import type { ReactNode } from 'react';
import { useParts } from './parts';

// 고르기 시트 — 웹 select·팝오버 메뉴(담당자·직원·보드·진행 단계)를 폰에서는 아래에서 올라오는 목록으로. 고르면 닫는다.

export interface PickOption<T> {
  value: T;
  label: string;
  description?: string;
  right?: ReactNode;
}

interface PickSheetProps<T> {
  visible: boolean;
  title: string;
  options: readonly PickOption<T>[];
  value: T;
  onPick: (value: T) => void;
  onClose: () => void;
}

export function PickSheet<T>({ visible, title, options, value, onPick, onClose }: PickSheetProps<T>) {
  const P = useParts();
  return (
    <P.Sheet visible={visible} onClose={onClose} title={title}>
      {options.map(option => (
        <P.OptionRow
          key={String(option.value)}
          label={option.label}
          description={option.description}
          right={option.right}
          selected={option.value === value}
          onPress={() => {
            onPick(option.value);
            onClose();
          }}
        />
      ))}
    </P.Sheet>
  );
}
