import { Fragment, type ReactNode } from 'react';

/** 영수증 아래쪽 절취면. **코사인 곡선**으로 그린 물결이다 — 폭 13 / 깊이 7 짜리가
 * 300pt 를 채운다.
 *
 * 원호로 그리면 호와 호가 수직 접선으로 만나 **골이 첨점으로 뾰족하게 남는다.** 코사인은
 * 마루와 골 양쪽 모두에서 기울기가 0이라 골까지 자연스럽게 둥글어진다. 삼각 톱니의
 * 꼭짓점만 둥글리는 방식도 같은 한계를 갖는다 — 꼭짓점은 둥글어져도 골은 뾰족하다.
 *
 * 곡선은 반주기마다 3차 베지에 한 개로 옮긴다. 양 끝 제어점을 수평으로 두면
 * 끝점 기울기가 정확히 0이 되어 코사인과 같은 성질을 갖는다.
 *
 * 윗면에는 절취면을 두지 않는다. 종이 윗변은 프린터 슬롯 안에 물려 있는 상태라
 * 잘린 자국이 보일 자리가 아니다.
 *
 * 주의: 이 도형은 반드시 종이와 **분리해서** 그린다. 종이 프레임에 배경색을 칠하고
 * 그 위에 얹으면 골 사이가 종이색으로 메워져 일자로 보인다. */
export function TornEdge({
  width = 300,
  scallopWidth = 13,
  depth = 7,
}: {
  width?: number;
  scallopWidth?: number;
  depth?: number;
}) {
  const count = Math.max(1, Math.round(width / scallopWidth));
  const w = width / count;
  const height = depth + 1;
  const half = w / 2;
  const ease = half / 3; // 제어점을 끝점에서 수평으로 뺀 거리 — 기울기 0을 만든다

  // y = depth/2 · (1 − cos(2πx/w)). 위쪽이 몸통, 아래로 볼록.
  let d = 'M0,0';
  for (let i = 0; i < count; i++) {
    const x = i * w;
    // 마루까지 (기울기 0 → 0)
    d += ` C${x + ease},0 ${x + half - ease},${depth} ${x + half},${depth}`;
    // 골까지 (기울기 0 → 0)
    d += ` C${x + half + ease},${depth} ${x + w - ease},0 ${x + w},0`;
  }
  d += ' Z';

  return (
    <svg className="torn" width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <path d={d} fill="var(--paper)" />
    </svg>
  );
}

/** 종이 면 + 아래 절취면. 배경색은 안쪽 컨테이너에만 칠한다. */
export function ReceiptPaper({ children }: { children: ReactNode }) {
  return (
    <div className="paper">
      <div className="paper-body">{children}</div>
      <TornEdge />
    </div>
  );
}

/** 굵은 핑크 대시 13개. 영수증 안의 구역을 나눈다. */
export function PerforationLine({ count = 13 }: { count?: number }) {
  return (
    <div className="perforation">
      {Array.from({ length: count }, (_, i) => (
        <i key={i} />
      ))}
    </div>
  );
}

/** 잔 점선 40개. 항목과 항목 사이. */
export function DottedLine({
  count = 40,
  thickness = 2,
  color = 'var(--pink)',
}: {
  count?: number;
  thickness?: number;
  color?: string;
}) {
  return (
    <div className="dotted">
      {Array.from({ length: count }, (_, i) => (
        <i key={i} style={{ height: thickness, background: color }} />
      ))}
    </div>
  );
}

/** 60개 막대, 고정 패턴. 디자인 원본과 같은 순서를 쓴다(ReceiptParts.swift). */
const BARCODE_PATTERN = [
  3, 1, 2, 1, 4, 1, 1, 2, 3, 1, 2, 4, 1, 1, 3, 2, 1, 4, 2, 1, 1, 3, 1, 2, 4, 1, 3, 1, 1, 2, 3, 1,
  4, 1, 2, 1, 1, 3, 2, 4, 1, 1, 2, 3, 1, 2, 1, 4, 1, 3, 2, 1, 1, 3, 4, 1, 2, 1, 3, 1,
];

export function Barcode({ height = 70, color = 'var(--pink)' }: { height?: number; color?: string }) {
  return (
    <div className="barcode" style={{ height }}>
      {BARCODE_PATTERN.map((w, i) => (
        <i key={i} style={{ width: w, background: color }} />
      ))}
    </div>
  );
}

/** 촬영·스캔 창의 네 모서리 괄호. */
export function ScanBrackets({ arm = 28, thickness = 2.5 }: { arm?: number; thickness?: number }) {
  const corners = [
    { top: 0, left: 0 },
    { top: 0, right: 0 },
    { bottom: 0, left: 0 },
    { bottom: 0, right: 0 },
  ];
  return (
    <div className="brackets">
      {corners.map((pos, i) => (
        <Fragment key={i}>
          <i style={{ ...pos, width: arm, height: thickness }} />
          <i style={{ ...pos, width: thickness, height: arm }} />
        </Fragment>
      ))}
    </div>
  );
}

/** 종이 뒤에 깔리는 본체. 슬롯 위 빈 면은 S07 의 머리글(항목 이름 · 개수)이 앉는 자리다. */
export function PrinterHousing({ label }: { label?: ReactNode }) {
  return (
    <div className="printer housing">
      <div className="housing-body" />
      <div className="housing-highlight" />
      {label && <div className="printer-label">{label}</div>}
    </div>
  );
}

/** 종이 앞을 덮는 슬롯. 이게 있어야 종이가 프린터 안으로 들어가는 것처럼 보인다. */
export function PrinterLip() {
  return (
    <div className="printer lip">
      <div className="lip-slot" />
      <div className="lip-line" />
      <div className="lip-shadow" />
    </div>
  );
}
