import { useEffect, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from './Icon';
import { PrinterHousing, PrinterLip } from './parts';
import { playFeedSound } from '../lib/feedSound';

/** 슬롯에서 영수증이 뽑혀 나오는 모션 길이. styles.css 의 `.roll.print-in` 애니메이션과 같아야
 *  급지음이 모션과 함께 끝난다. */
const PRINT_MS = 1100;

/** 배경 사진(배경.png, 빈 슬롯) 안의 좌표. 종이·슬롯을 사진에 맞춰 얹으려면 이 값이 기준이다. */
const PHOTO = {
  width: 1046, // 원본 폭
  frameMax: 430, // 데스크톱에서 사진이 무한정 커지지 않게 잡는 상한
  paperWidth: 580, // 슬롯 개구부(약 620) 안에 들어오는 폭
  designWidth: 300, // 코드로 그린 영수증의 설계 폭
};

/** 사진 배경은 폭에 맞춰 늘어난다. 영수증도 같은 비율로 줄여야 사진 속 영수증과 겹친다.
 *
 * `zoom` 을 쓰는 이유: `transform: scale` 은 레이아웃 높이를 바꾸지 않아 스크롤 길이가 틀어진다.
 * 배율은 CSS calc 로 못 만든다 — 길이끼리 나눈 무단위 값이 필요해서 여기서 계산한다. */
export function usePhotoScale(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const root = document.documentElement;
    const apply = () => {
      // CSS 의 `--frame-w: min(100vw, 430px)` 와 **같은 폭**을 써야 한다.
      // `window.innerWidth` 는 비주얼 뷰포트(핀치줌·툴바에 따라 달라지고 브라우저마다 다르다)라
      // 100vw 와 어긋날 수 있다 — 그러면 영수증만 사진 슬롯과 다른 배율로 그려진다.
      // `documentElement.clientWidth` 가 레이아웃 뷰포트 = 100vw 에 대응한다.
      const frame = Math.min(document.documentElement.clientWidth, PHOTO.frameMax);
      const paper = (PHOTO.paperWidth * frame) / PHOTO.width;
      root.style.setProperty('--photo-zoom', String(paper / PHOTO.designWidth));
    };
    apply();
    window.addEventListener('resize', apply);
    return () => {
      window.removeEventListener('resize', apply);
      root.style.removeProperty('--photo-zoom');
    };
  }, [enabled]);
}

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
  photo = true,
  printIn = false,
  children,
}: {
  dark?: boolean;
  scrolls?: boolean;
  /** 프린터를 코드로 그리는 대신 배경 사진(배경.png)을 쓴다. 기본값. 끄면 코드 프린터로 돌아간다. */
  photo?: boolean;
  /** 슬롯에서 뽑혀 나오는 모션 + 급지음으로 등장한다(스캔으로 이미 있는 제품에 들어올 때). */
  printIn?: boolean;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  usePhotoScale(photo);

  // 모션과 같은 길이로 급지음을 낸다. 컨텍스트는 스캔 확인 탭에서 이미 깨어 있다.
  useEffect(() => {
    if (!printIn) return;
    return playFeedSound(PRINT_MS);
  }, [printIn]);

  return (
    <div className={`stage${dark ? ' dark' : ''}${photo ? ' photo' : ''}`}>
      {!photo && <PrinterHousing />}
      <div className={`roll${scrolls ? '' : ' static'}${printIn ? ' print-in' : ''}`}>
        <div className="roll-inner">
          <div className="roll-scale">{children}</div>
        </div>
      </div>
      {!photo && <PrinterLip />}
      {/* 사진 간판에 그려진 돋보기를 실제 검색 버튼으로 만든다 — 모든 화면 공통. */}
      {photo && (
        <button
          className="sign-search"
          onClick={() => navigate('/search')}
          aria-label="제품 검색"
        />
      )}
    </div>
  );
}

/** 영수증 머리글 — 왼쪽 제목 + 오른쪽 액션. 제목은 화면마다 다르다(간판의 "New." 는 기계 브랜드로 고정). */
export function ReceiptHeader({
  title = 'New.',
  trailingIcon,
  onAction,
}: {
  title?: string;
  trailingIcon: 'xmark' | 'magnifyingglass';
  onAction: () => void;
}) {
  return (
    <div className="receipt-header">
      <span className="logo">{title}</span>
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
