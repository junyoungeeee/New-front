import type { ReactNode } from 'react';
import { Icon } from './Icon';
import { PrinterHousing, PrinterLip } from './parts';

/** 화면 7개가 전부 이 골격을 쓴다.
 *
 * 프린터는 고정, 영수증은 그 슬롯을 통과하는 긴 롤. 스크롤은 코드에서 만든다 —
 * 디자인 파일은 다 뽑혀 나온 정지 상태를 그린 것이다.
 *
 * **마스크가 핵심이다**(styles.css 의 `.roll`). 슬롯 라인 아래만 보이게 잘라야 종이가
 * 프린터 안으로 빨려 들어간다. 빠지면 스크롤할 때 영수증이 프린터 위쪽 여백에 그대로 나타난다. */
export function ReceiptScreen({
  dark = false,
  scrolls = true,
  children,
}: {
  dark?: boolean;
  scrolls?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`stage${dark ? ' dark' : ''}`}>
      <PrinterHousing />
      <div className={`roll${scrolls ? '' : ' static'}`}>
        <div className="roll-inner">{children}</div>
      </div>
      <PrinterLip />
    </div>
  );
}

/** "New." 로고 + 오른쪽 액션. S01·S02·S04·S05·S06 이 공유한다. */
export function ReceiptHeader({
  trailingIcon,
  onAction,
}: {
  trailingIcon: 'xmark' | 'magnifyingglass';
  onAction: () => void;
}) {
  return (
    <div className="receipt-header">
      <span className="logo">New.</span>
      <button onClick={onAction} aria-label={trailingIcon === 'xmark' ? '닫기' : '검색'}>
        <Icon name={trailingIcon} size={21} color="var(--icon-pink)" />
      </button>
    </div>
  );
}

/** 반투명 핑크 채움 + 핑크 글씨. 테두리는 유리 느낌만 남긴다. */
export function GlassButton({
  icon,
  title,
  fontSize = 14,
  disabled,
  onClick,
}: {
  icon: 'plus' | 'printer';
  title: string;
  fontSize?: number;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button className="glass-button" style={{ fontSize }} disabled={disabled} onClick={onClick}>
      <Icon name={icon} size={15} color="var(--icon-pink)" />
      {title}
    </button>
  );
}

/** 선택 상태가 있는 알약. 카테고리·키워드가 같은 모양을 쓴다. */
export function Chip({
  title,
  selected,
  onClick,
}: {
  title: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button className={`chip${selected ? ' selected' : ''}`} onClick={onClick}>
      {title}
    </button>
  );
}

/** 별점. 읽기 전용과 입력용을 한 뷰로 쓴다. */
export function StarRating({
  rating,
  size = 15,
  spacing = 3,
  onSelect,
}: {
  rating: number;
  size?: number;
  spacing?: number;
  onSelect?: (value: number) => void;
}) {
  return (
    <div className="stars" style={{ gap: spacing }}>
      {[1, 2, 3, 4, 5].map((index) => {
        const filled = index <= Math.round(rating);
        const star = (
          <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: 'block' }}>
            <path
              fill={filled ? 'var(--pink)' : 'var(--pink-tint)'}
              d="M12 2.2l2.9 6.1 6.6.9-4.8 4.6 1.2 6.6L12 17.3 6.1 20.4l1.2-6.6L2.5 9.2l6.6-.9z"
            />
          </svg>
        );
        return onSelect ? (
          <button key={index} onClick={() => onSelect(index)} aria-label={`별점 ${index}`}>
            {star}
          </button>
        ) : (
          <span key={index}>{star}</span>
        );
      })}
    </div>
  );
}
