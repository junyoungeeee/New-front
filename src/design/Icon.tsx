/** SF Symbols 대체. 원본에서 쓰는 것만 24×24 뷰박스로 옮긴다. */

type Name =
  | 'magnifyingglass'
  | 'chevron.left'
  | 'chevron.right'
  | 'chevron.down'
  | 'xmark'
  | 'plus'
  | 'arrow.counterclockwise'
  | 'keyboard'
  | 'camera.fill'
  | 'pencil.line'
  | 'printer'
  | 'checkmark.seal.fill'
  | 'photo'
  // 카테고리 (S01 표의 항목 앞에 붙는다)
  | 'ramen'
  | 'snack'
  | 'drink'
  | 'icecream'
  | 'coffee'
  | 'etc';

/** 카테고리 이름 → 아이콘. `CATEGORIES`(db.ts) 와 짝을 맞춘다. */
export const CATEGORY_ICONS: Record<string, Name> = {
  라면: 'ramen',
  과자: 'snack',
  음료: 'drink',
  아이스크림: 'icecream',
  커피: 'coffee',
  기타: 'etc',
};

const STROKE: Partial<Record<Name, JSX.Element>> = {
  magnifyingglass: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.5 15.5 21 21" />
    </>
  ),
  'chevron.left': <path d="M15 4 7 12l8 8" />,
  'chevron.right': <path d="M9 4l8 8-8 8" />,
  'chevron.down': <path d="M4 8.5 12 16l8-7.5" />,
  xmark: <path d="M5 5l14 14M19 5 5 19" />,
  plus: <path d="M12 4v16M4 12h16" />,
  'arrow.counterclockwise': (
    <>
      <path d="M4 5.5v5h5" />
      <path d="M4.6 10.5A8 8 0 1 1 5.2 16" />
    </>
  ),
  keyboard: (
    <>
      <rect x="2.5" y="5.5" width="19" height="13" rx="2.5" />
      <path d="M6.5 9.5h.01M10.5 9.5h.01M14.5 9.5h.01M18 9.5h.01M6.5 13h.01M10.5 13h.01M14.5 13h.01M18 13h.01M7.5 16.5h9" />
    </>
  ),
  'pencil.line': (
    <>
      <path d="M4 21h16" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L9 17l-4 1 1-4z" />
    </>
  ),
  printer: (
    <>
      <path d="M7 9V3.5h10V9" />
      <path d="M7 18H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" />
      <path d="M7 14.5h10V21H7z" />
    </>
  ),

  // ─── 카테고리 ───
  // 점은 길이 0짜리 경로(`h.01`)로 찍는다 — strokeLinecap="round" 라 동그란 점이 된다.
  ramen: (
    <>
      <path d="M3.2 10.2h17.6a8.8 8.8 0 0 1-8.8 8.8 8.8 8.8 0 0 1-8.8-8.8Z" />
      <path d="M9.3 7.4c.9-1-.9-1.8 0-2.8" />
      <path d="M13.4 7.4c.9-1-.9-1.8 0-2.8" />
    </>
  ),
  snack: (
    <>
      <circle cx="12" cy="12" r="8.6" />
      {/* 점을 좌우대칭으로 두면 눈·입처럼 보여 얼굴로 읽힌다 — 흩뜨려 놓는다 */}
      <path d="M9.5 10.3h.01M13.8 9.2h.01M14.7 13.6h.01M10.2 14.4h.01" />
    </>
  ),
  drink: (
    <>
      <path d="M6.4 7.6h11.2l-1.1 11.5a2 2 0 0 1-2 1.8H9.5a2 2 0 0 1-2-1.8Z" />
      <path d="M5 7.6h14" />
      <path d="M13.6 7.6 16.2 3" />
    </>
  ),
  icecream: (
    <>
      <path d="M7.1 10.4a4.9 4.9 0 0 1 9.8 0Z" />
      <path d="M7.3 10.4 12 20.8l4.7-10.4" />
    </>
  ),
  coffee: (
    <>
      <path d="M4.2 8.2h12.6v5.6a5.6 5.6 0 0 1-5.6 5.6h-1.4a5.6 5.6 0 0 1-5.6-5.6Z" />
      <path d="M16.8 9.6h1.4a2.6 2.6 0 0 1 0 5.2h-1.4" />
      <path d="M8.4 3.8v1.8M12.2 3.4v2.2" />
    </>
  ),
  etc: (
    <>
      <circle cx="6.4" cy="12" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="17.6" cy="12" r="1.5" />
    </>
  ),
};

const FILL: Partial<Record<Name, JSX.Element>> = {
  'camera.fill': (
    <path d="M9.2 4h5.6l1.3 2H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3.9zM12 8.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9z" />
  ),
  'checkmark.seal.fill': (
    <path d="m12 1.8 2.5 2 3.2-.3 1 3 2.7 1.7-1 3 1 3-2.7 1.7-1 3-3.2-.3-2.5 2-2.5-2-3.2.3-1-3-2.7-1.7 1-3-1-3L4.3 6.5l1-3 3.2.3zm4.3 7-1.5-1.4-4 4.2-1.7-1.7-1.5 1.5 3.2 3.2z" />
  ),
  photo: (
    <path d="M3 5.5A2.5 2.5 0 0 1 5.5 3h13A2.5 2.5 0 0 1 21 5.5v13a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 18.5zm3.2 12.3h11.6l-3.6-5-2.7 3.5-1.9-2.2zM8.3 10a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2z" />
  ),
};

export function Icon({
  name,
  size = 16,
  weight = 2,
  color,
}: {
  name: Name;
  size?: number;
  weight?: number;
  color?: string;
}) {
  const filled = FILL[name];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? (color ?? 'currentColor') : 'none'}
      stroke={filled ? 'none' : (color ?? 'currentColor')}
      strokeWidth={(weight * 24) / size}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flex: 'none', display: 'block' }}
      aria-hidden
    >
      {filled ?? STROKE[name]}
    </svg>
  );
}
