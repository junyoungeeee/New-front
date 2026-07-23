# New. — 웹 MVP 구현 문서

영수증 컨셉의 신제품 리뷰 **웹앱**. 바코드를 찍어 제품을 찾고, 없으면 직접 등록하면서 첫 리뷰를 남긴다.

- 원본 계획: `docs/MVP.md` (iOS 버전) — 화면 구조·플로우·디자인 판단은 그쪽이 기준이다. 이 문서는 **웹에서 달라지는 것만** 다룬다.
- 디자인 원본: `design/design.pen` (파운데이션 보드 5개 + 화면 7개)
- 이식 참고: `NewApp/Sources/` — 부품 구현이 이미 검증돼 있다. §6의 이식표 참고.

---

## 1. MVP 범위

iOS 버전 §1과 **동일하다.** 전부 기기 안에 저장하고, 서버·계정·남의 리뷰는 없다.

**한다**

- 바코드 스캔 → 등록된 제품이면 제품 화면, 없으면 등록 플로우
- 제품 등록: 사진 촬영(배경 자동 제거) → 제품명 → 카테고리 — **사진은 필수**
- 리뷰 작성: 별점 + 본문 + 키워드
- 카테고리별 제품 목록(영수증 스크롤), 제품별 리뷰 목록
- **전부 브라우저 안에 저장** (IndexedDB)

**안 한다**

- 서버, 계정, 다른 사람 리뷰
- 바코드→제품명 자동 조회
- 검색, 알림, 저장/북마크, 도움돼요

### 웹에서 이 선택이 더 비싸진다

iOS에서 로컬 온리의 대가는 "남의 리뷰가 없다" 하나였다. 웹에서는 **하나 더 붙는다.**

> **iOS Safari는 사용자 상호작용이 7일간 없으면 script-writable 저장소(IndexedDB 포함)를 삭제한다.**
> 홈화면에 추가한 웹앱은 이 정책에서 제외된다.

즉 웹에서 로컬 온리는 "데이터가 조용히 사라질 수 있는 설계"다. 이걸 감수하기로 했으므로, **PWA 설치 유도는 부가 기능이 아니라 MVP 필수 요구사항**이 된다(§5.4). 데이터 보존이 설치라는 사용자 행동에 걸려 있다는 사실을 문서 전체가 전제로 깔고 간다.

서버로 전환하는 경로는 §8에 그대로 열어둔다.

---

## 2. 스택

| 항목 | 선택 | 이유 |
|---|---|---|
| 빌드 | **Vite + React + TypeScript** | 서버가 없으므로 SSR도 필요 없다. 정적 SPA 하나로 끝난다. Next.js는 서버를 붙일 때 다시 고려 |
| 배포 | 정적 호스팅 (Vercel/Netlify/Cloudflare Pages) | **HTTPS가 카메라의 전제 조건**이라 http 호스팅은 후보가 아니다 |
| 저장 | **IndexedDB (Dexie)** | SwiftData의 대체. 관계형 조회 + 스키마 버전 마이그레이션 지원 |
| 앱 형태 | **PWA (manifest + Service Worker)** | 저장소 만료 회피 + 전체화면 + 오프라인. §1 참고 |
| 카메라 | `getUserMedia` + `<video playsinline>` | 카메라가 전체화면이 아니라 영수증 안의 작은 창이므로 video를 직접 배치·클립한다 |
| 바코드 | **`zxing-wasm`** | `BarcodeDetector`는 Chrome/Android 전용이고 **iOS Safari에 없다.** 폴백이 아니라 주력으로 쓴다 |
| 누끼 | **`@imgly/background-removal`** (ONNX/WASM) | 서버가 없으므로 온디바이스 추론뿐이다. Vision의 대체. §5.2 |
| 스타일 | CSS Modules + CSS 커스텀 프로퍼티 | 토큰이 16개뿐이고 부품이 고정 픽셀이라 유틸리티 프레임워크의 이점이 적다 |

**최소 지원**: iOS Safari 16+, Chrome/Android 최신. 데스크톱은 카메라 없이 조회만 되면 충분(개발용).

---

## 3. 데이터 모델

```ts
export type Category = '라면' | '과자' | '음료' | '아이스크림' | '커피' | '기타';

export interface Product {
  barcode: string;        // 주키 (자연키 — §8)
  name: string;
  category: Category;
  photoIsCutout: boolean; // 누끼 성공 여부. 실패 시 false
  createdAt: number;      // epoch ms
}

export interface Review {
  id: string;             // crypto.randomUUID()
  barcode: string;        // Product.barcode 참조
  rating: number;         // 1...5
  body: string;
  keywords: string[];
  createdAt: number;
}

export interface Photo {
  barcode: string;        // 주키
  blob: Blob;             // 누끼 PNG
}

db.version(1).stores({
  products: 'barcode, category, createdAt',
  reviews:  'id, barcode, createdAt',
  photos:   'barcode',
});
```

**이미지는 `products`와 같은 스토어에 넣지 않는다.** iOS 버전 §3의 판단과 같은 이유다 — 누끼 PNG는 2000px 안팎이고, 같은 레코드에 있으면 목록 조회(S01·S07)마다 수 MB를 역직렬화하게 된다. **별도 `photos` 스토어**에 두면 제품 목록 쿼리는 blob을 건드리지 않고, 상세 화면에서만 꺼내 쓴다. iOS의 "파일 시스템에 두고 파일명만 들고 있는다"와 정확히 같은 구조다.

읽을 때는 `URL.createObjectURL(blob)`로 `<img src>`에 물리고, **화면을 벗어날 때 `revokeObjectURL`을 반드시 부른다.** 영수증 스크롤(S07)에서 수십 개를 만들고 해제하지 않으면 메모리가 그대로 쌓인다.

`averageRating` / `reviewCount`는 SwiftData의 계산 프로퍼티 대신 조회 시점에 집계한다(제품당 리뷰가 수십 개 수준이므로 충분).

---

## 4. 화면 ↔ 구현

라우팅은 `react-router`. 화면 대응은 iOS 버전 §4와 1:1이다.

| 디자인 | 라우트 | 컴포넌트 | 핵심 |
|---|---|---|---|
| S01 홈 | `/` | `Home` | 카테고리별 제품 수 집계 |
| S02 바코드 스캔 | `/scan` | `BarcodeScan` | 스캔 성공 → barcode 조회 → 있으면 S03, 없으면 S04 |
| 검색 | `/search` | `Search` | 이름·카테고리·바코드 부분 일치. 제품 수가 수십 개라 인덱스 없이 전부 훑는다 |
| S03 제품 | `/p/:barcode` | `ProductPage` | 제품 + 리뷰 목록. `리뷰 쓰기` → S06(리뷰 전용 모드) |
| S04 없는 제품 | `/p/:barcode/new` | `NotFound` | CTA → 곧바로 S05 |
| S05 제품 사진 | `/p/:barcode/photo` | `ProductPhoto` | 촬영 → 누끼 → S06으로 전달 |
| S06 등록 + 리뷰 | `/p/:barcode/write` | `RegisterReview` | `mode: 'register' \| 'reviewOnly'` |
| S07 카테고리 스크롤 | `/c/:category` | `CategoryFeed` | 프린터 고정 + 영수증 스크롤 (§5.3) |

S06을 두 모드로 쓰는 판단(iOS §4)은 그대로 유지한다.

**저장 뒤 행선지는 모드에 따라 다르다.** 리뷰만 추가한 경우는 원래 보던 S03으로 돌아간다. 신규 등록은 **그 카테고리(S07)로 보내** 방금 만든 영수증이 프린터에서 뽑혀 나오는 걸 보여주고, 그때 징을 울린다 — 등록의 결과물이 실제로 생겼다는 걸 보여주는 자리라서 제품 상세보다 낫다. 소리는 저장 버튼 클릭 **안에서** 오디오 컨텍스트를 깨워둬야 한다. 화면을 옮긴 뒤에는 사용자 제스처가 아니라 자동재생 정책에 막힌다.

**웹에서 새로 생기는 문제: 뒤로가기.** 등록 플로우가 URL을 4개 거치므로 브라우저 뒤로가기로 촬영 화면에 되돌아올 수 있다. S05→S06으로 넘길 때 촬영 결과는 **메모리(라우터 state)로만 전달**하고, S06에 결과 없이 진입하면 S05로 돌려보낸다. 저장 완료 후에는 `navigate(..., { replace: true })`로 플로우 전체를 히스토리에서 걷어낸다.

---

## 5. 핵심 기술 4가지

### 5.1 바코드 스캔 (S02)

카메라 프리뷰가 영수증 안 248×206 창에만 보여야 한다. `<video>`를 그 크기의 컨테이너에 넣고 자른다.

```css
.scanWindow { width: 248px; height: 206px; overflow: hidden; border-radius: 8px; }
.scanWindow video { width: 100%; height: 100%; object-fit: cover; }
```

```ts
const stream = await navigator.mediaDevices.getUserMedia({
  video: { facingMode: { ideal: 'environment' } },  // exact 로 주면 후면이 없는 기기에서 실패한다
  audio: false,
});
video.srcObject = stream;
video.setAttribute('playsinline', '');   // ← iOS Safari에서 이게 없으면 전체화면으로 튄다
await video.play();
```

`playsinline`이 빠지면 iOS가 비디오를 전체화면으로 띄워버려 **영수증 안의 작은 창이라는 디자인 자체가 무너진다.** 가장 먼저 확인할 것.

`rectOfInterest`(iOS §5.1)에 대응하는 API는 없다. 대신 **프레임을 canvas에 그릴 때 가이드 창 영역만 잘라서** 디코더에 넘긴다 — 같은 효과에 디코딩 비용도 준다.

```ts
const loop = async () => {
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);   // 창 영역만
  const result = await readBarcodeFromImageData(ctx.getImageData(0, 0, sw, sh), {
    formats: ['EAN-13', 'EAN-8', 'UPC-E', 'Code128'],
  });
  if (result.length) return onFound(result[0].text);
  rafId = requestAnimationFrame(loop);   // 매 프레임은 과하다 — 5~10fps로 throttle
};
```

같은 바코드가 연속으로 잡히므로 **첫 인식 후 루프를 멈추고 `stream.getTracks().forEach(t => t.stop())`** 로 카메라를 끈 뒤 전환한다. iOS는 스트림을 놓지 않으면 다음 화면에서 카메라를 다시 못 여는 경우가 있다.

### 5.2 배경 제거 (S05) — 최대 리스크

Vision의 `VNGenerateForegroundInstanceMaskRequest`에 대응하는 웹 API는 **없다.** 서버를 두지 않기로 했으므로 브라우저에서 모델을 직접 돌린다.

```ts
import { removeBackground } from '@imgly/background-removal';

async function cutout(source: Blob, guideRect: Rect): Promise<{ blob: Blob; isCutout: boolean }> {
  const cropped = await cropToGuide(source, guideRect);   // 1. 가이드 영역만 — 옆 제품이 애초에 안 들어옴
  try {
    const out = await withTimeout(removeBackground(cropped), 15_000);   // 2. 피사체 분리
    if (await isMostlyOpaque(out, 0.9)) throw new Error('배경을 통째로 잡음');
    return { blob: out, isCutout: true };
  } catch {
    return { blob: cropped, isCutout: false };            // 3. 폴백 — 가이드 영역 정사각 크롭
  }
}
```

**가이드 크롭을 먼저 하는 판단(iOS §5.2)은 웹에서 이득이 두 배다.** 진열대 사진에서 옆 제품이 하나의 인스턴스로 잡히는 문제를 막아줄 뿐 아니라, 모델 입력이 작아져서 추론 시간이 줄어든다. 순서를 바꾸지 말 것.

**폴백은 여전히 선택이 아니라 필수다.** 사진 없이는 등록할 수 없다. 웹에서는 실패 경우가 하나 더 늘어난다:

- `results`가 비었을 때 (피사체 없음)
- 결과가 크롭 영역의 90% 이상일 때 (배경을 통째로 잡음)
- **모델 다운로드 실패 / 추론 타임아웃** ← 웹에서 추가

`photoIsCutout` 플래그를 남겨 나중에 재처리 대상을 찾을 수 있게 하는 것도 그대로 유지한다.

#### 모델 다운로드를 언제 하느냐가 체감을 정한다

`@imgly/background-removal`은 첫 실행에 수 MB~수십 MB의 모델을 내려받는다. **촬영 후에 받으면 사용자는 셔터를 누르고 수십 초를 기다린다.** S05에 진입하는 순간(사용자가 구도를 잡는 동안) 백그라운드로 프리페치하고, Cache API에 담아 두 번째부터는 즉시 쓴다.

```ts
useEffect(() => { void preload(); }, []);   // S05 마운트 시점 — 촬영 전에 시작
```

셀룰러에서 첫 등록이 무거운 건 이 구조의 근본적인 비용이다. S05의 **"배경은 자동으로 지워집니다"** 문구 아래에 진행 표시를 두고, 폴백으로 끝났을 때 S06에서 결과를 보여주고 `다시 찍기`를 주는 건 디자인에 이미 있다.

> 서버(rembg)를 두면 이 문제가 통째로 사라진다. 로컬 온리를 유지하는 대가로 받아들인 항목이다.

### 5.3 영수증 급지 (S07)

디자인 파일은 다 뽑혀 나온 정지 상태이고, 동작은 코드에서 만든다. 핵심은 **프린터가 고정이고, 종이가 아래로 밀려 나오는 것.**

일반 스크롤과 방향이 반대다. 스크롤은 종이를 위로 걷어 올리지만 프린터는 종이를 아래로 밀어낸다(참고: `스크롤 느낌 복사본.mov`). 그래서 **먼저 나올 영수증을 DOM 의 맨 아래**에 두고, 종이 뭉치의 아랫변을 슬롯 선에 맞춘 뒤 통째로 내린다.

```css
.feed-strip {
  position: absolute;
  top: var(--slot-line);
  left: 50%;
  transform: translate(-50%, calc(-100% + var(--fed, 0px)));  /* -100% = 아랫변이 슬롯에 */
}
.feed-viewport {
  -webkit-mask-image: linear-gradient(to bottom, transparent var(--slot-line), #000 var(--slot-line));
          mask-image: linear-gradient(to bottom, transparent var(--slot-line), #000 var(--slot-line));
}
```

마스크가 빠지면 **프린터 위쪽 여백에 영수증이 그대로 나타난다.** 슬롯 라인 아래만 보이게 잘라야 종이가 프린터에서 나오는 것처럼 보인다. iOS 버전에서 겪은 것과 같은 함정이고, 원인도 같다.

`-webkit-` 접두사를 같이 쓴다 — iOS Safari가 여전히 접두사 없는 `mask-image`를 일부 조합에서 무시한다.

**급지는 한 장 단위로 끊어서 움직인다.** 손가락을 1:1로 따라가지 않는다 — 사용자가 종이를 잡아당기는 게 아니라 프린터에 "한 장 더"를 시키는 동작이라, 제스처 방향과 종이 방향이 달라도 어색하지 않다. 모터는 일정한 속도로 돌고, **상품 한 장이 2초**다(참고 영상 4.0→6.0초 구간). 급지가 도는 동안 래칫음(`public/feed.m4a` — 원본 7.0~9.0초 구간)이 같이 난다.

절취면은 **코사인 곡선**으로 그린 물결(폭 13 / 깊이 7)이고 **아랫변에만** 둔다. 종이 윗변은 슬롯 안에 물려 있어 잘린 자국이 보일 자리가 아니다.

곡선 선택이 결과를 가른다. 원호로 이으면 호와 호가 수직 접선으로 만나 **골이 첨점으로 뾰족하게 남고**, 삼각 톱니의 꼭짓점만 둥글려도 골은 여전히 뾰족하다. 코사인은 마루와 골 양쪽에서 기울기가 0이라 골까지 자연스럽게 둥글어진다. 구현은 반주기마다 3차 베지에 하나씩 — 양 끝 제어점을 수평으로 두면 끝점 기울기가 정확히 0이 되어 같은 성질을 갖는다.

> 원호로 그리던 시절의 함정 하나: SVG 호의 `sweep` 플래그를 1로 두면 위로 솟아 뷰박스 밖으로 잘려 나가고, 절취면이 통째로 사라진 것처럼 보인다. 스크린샷으로는 "평평하네" 정도로만 보이므로 `getBBox()` 로 확인하는 게 빠르다.

### 5.4 저장소를 지키기 (신규)

§1에서 정한 대로, 이건 MVP 요구사항이다.

```ts
// 1. 지속 저장소 요청 — 승인되면 자동 삭제 대상에서 빠진다
if (navigator.storage?.persist) {
  const granted = await navigator.storage.persist();
}
```

Safari는 이 요청을 대체로 거절하고, **홈화면 추가만이 확실한 방법**이다. 그래서:

- 첫 등록을 마친 직후(= 잃을 게 생긴 시점) 홈화면 추가를 안내한다. 앱 실행 직후가 아니다 — 그때는 사용자가 이유를 모른다.
- iOS는 `beforeinstallprompt`가 없으므로 **공유 → 홈 화면에 추가** 안내를 직접 그린다. Android/Chrome은 `beforeinstallprompt`를 잡아 버튼으로.
- `navigator.standalone` / `display-mode: standalone`으로 이미 설치된 경우엔 안내를 띄우지 않는다.

---

## 6. 디자인 시스템 이식

### 토큰

`design.pen`의 값 그대로. iOS `Sources/Design/Tokens.swift`와 같은 값이다.

```css
:root {
  /* 배경 */
  --canvas:      #E4DED6;   /* 홈·제품·없는제품·등록리뷰·카테고리 */
  --canvas-dark: #241F1D;   /* 바코드 스캔·제품 사진 */
  --paper:       #F8F6F3;   /* 영수증 종이 + 절취면 */
  --paper-card:  #FFFDFB;   /* 입력창 등 올라온 면 */
  --paper-shade: #EFEAE4;
  --line:        #DED7D0;

  /* 텍스트 */
  --ink:  #191817;
  --ink2: #55504B;
  --ink3: #9A938C;

  /* 브랜드 */
  --pink:       #E8427E;
  --pink-tint:  #FBDDE9;                     /* 빈 별 */
  --pink-faint: #FDF1F6;
  --pink-glass: rgba(232, 66, 126, 0.19);    /* 버튼 채움 */

  /* 아이콘 (반투명) */
  --icon-pink:    rgba(232, 66, 126, 0.72);
  --icon-ink:     rgba(25, 24, 23, 0.65);
  --icon-on-pink: rgba(255, 255, 255, 0.67);

  --r-sm: 8px; --r-md: 14px; --r-full: 999px;
}
```

간격 `4·8·12·16·20·24·32`.

### 폰트 — 웹이 더 낫다

표시·로고 `Archivo`, 본문·라벨·바코드 `Space Mono`. 파일은 `NewApp/Resources/Fonts/`에 이미 있다(woff2로 변환해 `@font-face`로 self-host).

`$font-body`인 Space Mono에 한글 글리프가 없는 문제는 iOS와 같지만, **웹에서는 폴백 체인이 기기와 무관하게 결정적으로 동작한다.**

```css
--font-body: 'Space Mono', 'Pretendard', system-ui, sans-serif;
```

라틴은 Space Mono, 한글은 Pretendard로 자동으로 갈린다. "기기마다 결과가 달라진다"는 iOS §6의 걱정이 여기선 사라진다. Pretendard는 서브셋 동적 버전을 쓴다.

### 부품 이식표

화면 7개가 전부 같은 부품을 쓴다. **먼저 만들고 시작한다.** 구현은 `NewApp/Sources/Design/ReceiptParts.swift`에 검증된 게 있으니 수치를 그대로 옮긴다.

| Swift | 웹 | 이식 방법 |
|---|---|---|
| `TornEdge: Shape` | `<TornEdge />` | 같은 계산(폭 15 / 깊이 14)으로 **SVG `<path>`** 생성. `pointingUp` 옵션 동일 |
| `PerforationLine` | `.perforation` | `display:flex; gap:9px` + 자식 13개 `flex:1; height:2.5px; background:var(--pink)` |
| `DottedLine` | `.dotted` | 같은 방식, 자식 40개 `height:2px; gap:4px; border-radius:var(--r-full)` |
| `BarcodeView` | `<Barcode />` | **60개 막대 패턴 배열을 그대로 복사한다** (`ReceiptParts.swift:86`). 디자인 원본과 순서가 같아야 함. `gap:1.5px` |
| `ReceiptPaper` | `<ReceiptPaper />` | 종이 div + 톱니 SVG **형제**. `box-shadow: 0 3px 3px rgba(25,24,23,.2)` |
| `PrinterHousing` | `.printerHousing` | 378×92, `border-radius:18px`, `linear-gradient(#3A3A3A 0%, #141414 55%, #242424 100%)` + 하이라이트 바 326×2 `#5A5A5A` opacity .5, y+7 |
| `PrinterLip` | `.printerLip` | 338×24 `#0B0B0B` y+38, 라인 338×2 `#4A4A4A` opacity .7, 안쪽 그림자 326×6 `rgba(0,0,0,.15)` y+60, `pointer-events:none` |
| `GlassButton` | `.glassButton` | `background:var(--pink-glass); color:var(--pink); border:none; border-radius:var(--r-full)` |

**절취면은 반드시 종이와 분리해서 그린다.** 종이 div에 배경색을 칠하고 그 위에 톱니를 얹으면 골 사이가 종이색으로 메워져 일자로 보인다 — 디자인 작업 중 실제로 겪은 문제다. 종이 배경은 안쪽 컨테이너에만, 톱니 SVG는 형제 노드로. `mask-image`로 종이를 통째로 깎는 방식은 그림자가 같이 잘려서 쓰지 않는다.

---

## 7. 마일스톤

| # | 목표 | 완료 기준 |
|---|---|---|
| 1 | 디자인 시스템 | `TornEdge`·`ReceiptPaper`·`PrinterHousing/Lip`으로 S01 홈이 디자인과 일치 |
| 2 | 데이터 + 등록 | Dexie 스키마 + 더미 시드로 S03·S07이 실데이터로 뜸 |
| 3 | 바코드 | S02에서 실제 바코드 인식 → 있으면 S03, 없으면 S04 분기 |
| 4 | 사진 + 누끼 | S05 촬영 → 배경 제거 → S06에 미리보기. **폴백·프리로드 경로까지** |
| 5 | PWA 마감 | manifest·Service Worker·설치 유도(§5.4), 세이프에어리어, 인앱 브라우저 안내 |

1·2는 데스크톱 브라우저에서 가능. **3·4는 실기기 + HTTPS가 필요하다** — `vite --host` + `mkcert`로 로컬 인증서를 만들거나 터널(ngrok 등)을 쓴다. iOS 버전이 "실기기 필요"였던 자리에 "HTTPS"가 추가된 것.

---

## 8. 나중에 서버를 붙일 때

iOS 버전 §8의 원칙을 그대로 지킨다 — 웹에서는 전환이 훨씬 싸므로 더 중요하다.

- **`barcode`를 자연키로 쓴다.** UUID를 주키로 두면 나중에 같은 제품이 사람마다 다른 행으로 생겨 병합이 지옥이 된다.
- `createdAt`을 모든 레코드에 남긴다. 동기화 시 충돌 해결 기준.
- 사진 키를 `<barcode>.png`로 통일한다. 그대로 오브젝트 스토리지 키가 된다.
- **데이터 접근을 `db/` 모듈 하나로 좁힌다.** 컴포넌트가 Dexie를 직접 부르지 않으면, 나중에 그 모듈만 Supabase 호출로 갈아끼우면 된다.

전환 시 추가로 필요한 것: 계정, 제품 중복 정리, 신고·차단. 그리고 **기존 사용자의 로컬 데이터를 서버로 올리는 1회성 마이그레이션** — 로컬 온리로 시작한 대가로 생기는 항목이다.

---

## 9. 남은 이슈

### iOS 버전에서 이어지는 것

- **리뷰 전용 진입점** — S03에서 이미 등록된 제품에 리뷰만 추가하는 경로의 디자인이 없다. S06을 두 모드로 쓴다(§4).
- **브랜드 표기** — S07 영수증에 브랜드(`하림` 등)가 남아 있는데 S06에 브랜드 입력이 없다. 표시를 빼거나 입력을 되살려야 한다.
- **사진 촬영 이탈** — 사진이 필수라 S05에 우회로가 없다. 아래 인앱 브라우저 항목과 겹쳐서 웹에서 더 심각하다.

### 웹에서 새로 생기는 것

- **인앱 브라우저** — 카카오톡·인스타그램 등에서 열면 `getUserMedia`가 막히거나 조용히 실패하는 경우가 많다. 링크 공유로 유입되는 게 웹의 주 경로인데 **그 경로가 정확히 카메라가 안 되는 경로다.** UA로 감지해 "Safari로 열기" 안내를 띄우고, `<input type="file" accept="image/*" capture="environment">` 폴백을 열어둘지 정해야 한다. 사진첩 선택을 허용하면 가이드 크롭(§5.2)의 전제가 깨지므로, 그 경우 크롭 UI가 따로 필요하다.
- **카메라 권한 거부** — 웹은 iOS 설정 앱으로 보낼 방법이 없다. "주소창의 ⓐ → 카메라 허용" 같은 브라우저별 안내를 직접 그려야 한다.
- **세이프에어리어** — 프린터가 y=48에서 시작하는데 다이나믹 아일랜드 기기는 59pt가 필요하다. `<meta name="viewport" content="viewport-fit=cover">` + `top: calc(48px + env(safe-area-inset-top))`. **standalone(홈화면 추가)과 브라우저 탭에서 값이 다르므로 두 모드 모두 확인해야 한다.**
- **상태바 색** — S02·S05는 배경이 어두운데 PWA `theme-color`는 화면별로 바꾸기 어렵다. `<meta name="theme-color">`를 런타임에 교체하면 iOS standalone에서 반영이 늦다. 다크 화면 전환 시 상단 밴드가 튀는 걸 감수하거나, 전 화면 통일 색을 고를 것.
- **저장소 만료** — §5.4로 완화하되 완전히 막지는 못한다. 안전장치로 **JSON 내보내기/가져오기**를 넣을지 정해야 한다(사진 blob 포함 시 용량 문제).
- **Service Worker 캐시 무효화** — 정적 SPA + SW 조합에서 배포 후 구버전이 계속 뜨는 사고가 흔하다. `vite-plugin-pwa`의 자동 업데이트 + 새 버전 알림을 milestone 5에 포함한다.
