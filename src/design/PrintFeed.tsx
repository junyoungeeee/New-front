import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { PrinterHousing, PrinterLip } from './parts';
import { usePhotoScale } from './ReceiptScreen';
import { playFeedSound, primeFeedSound } from '../lib/feedSound';

/** 영수증 사이 간격. styles.css 의 `.feed-strip` gap 과 같아야 한다. */
const GAP = 18;

/** 상품 한 장이 슬롯을 완전히 빠져나오는 데 걸리는 시간.
 *  참고 영상(`스크롤 느낌 복사본.mov`)의 4.0초→6.0초 구간이 정확히 한 장이다. */
const SLIP_MS = 2000;

/** 종이가 프린터에서 **아래로 뽑혀 나오는** 화면.
 *
 * 일반 스크롤과 방향이 반대다. 스크롤은 종이를 위로 걷어 올리지만, 프린터는 종이를 아래로
 * 밀어낸다. 그래서 먼저 나올 영수증을 DOM 의 **맨 아래**에 두고, 종이 뭉치의 아랫변을
 * 슬롯 선에 맞춘 뒤 통째로 아래로 내린다 — 슬롯에서 한 장씩 솟아 나오고, 이미 나온 장은
 * 아래로 밀려 내려간다.
 *
 * 급지는 손가락을 따라가지 않고 **한 장 단위로 끊어서** 움직인다. 사용자가 종이를 직접
 * 잡아당기는 게 아니라 프린터에 "한 장 더"를 시키는 동작이라, 제스처 방향과 종이 방향이
 * 달라도 어색하지 않다. */
export function PrintFeed({
  items,
  label,
  initial = 1,
  photo = true,
}: {
  items: ReactNode[];
  /** 프린터 본체에 얹는 머리글 (코드 프린터 모드 전용). 사진 모드에선 제목을 종이 슬립으로 뽑는다. */
  label?: ReactNode;
  /** 화면에 들어오자마자 뽑아 둘 장 수. 빈 화면으로 시작하지 않게. */
  initial?: number;
  /** 코드 프린터 대신 배경 사진(배경.png)을 쓴다. 기본값. */
  photo?: boolean;
}) {
  const navigate = useNavigate();
  usePhotoScale(photo);
  const stageRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  const [step, setStep] = useState(0);
  const fedRef = useRef(0);
  const animationRef = useRef<number>();
  const stopSoundRef = useRef<() => void>();
  const busyRef = useRef(false);
  const stepRef = useRef(0);

  const setFed = (value: number) => {
    fedRef.current = value;
    stripRef.current?.style.setProperty('--fed', `${value}px`);
  };

  /** 나온 순서(k)별 위치를 잰다. DOM 은 뒤집혀 있으므로 인덱스를 되돌려 찾는다.
   *
   * 급지량을 **높이 계산이 아니라 현재 위치와의 차이**로 구한다. 사진 모드에선 슬립만 `zoom` 으로
   * 축소되는데, 종이 뭉치(feed-strip)는 zoom 밖이고 슬립은 zoom 안이라 두 좌표계를 섞으면
   * (stripHeight − topOf) 가 배율만큼 어긋난다 — 쉴 때도 맨 위 장의 윗부분(사진)이 슬롯에 잘려
   * 있던 원인이다. 반면 "지금 이 장의 윗변이 화면 어디에 있나"와 "슬롯 선이 화면 어디인가"는
   * 둘 다 실제 렌더 픽셀이라 배율과 무관하게 맞는다. 급지량을 그 차이만큼 옮기면 끝. */
  const measure = useCallback(() => {
    const strip = stripRef.current;
    const viewport = strip?.parentElement;
    if (!strip || !viewport) return null;
    // `.feed-strip` 의 top 이 곧 슬롯 선(마스크가 자르는 높이)이다. transform 은 섞이지 않는다.
    const slotY =
      viewport.getBoundingClientRect().top + parseFloat(getComputedStyle(strip).top || '0');
    const at = (k: number) => itemRefs.current[items.length - 1 - k];
    return {
      /** n 장이 나온 상태 = n-1 번째 장의 윗변이 슬롯 선에 딱 걸린 상태. */
      fedFor: (n: number) => {
        if (n <= 0) return 0;
        const el = at(n - 1);
        if (!el) return fedRef.current;
        return fedRef.current + (slotY - el.getBoundingClientRect().top);
      },
      heightOf: (k: number) => at(k)?.getBoundingClientRect().height ?? 0,
    };
  }, [items.length]);

  /** 내용 높이가 바뀌어도 "n 장 나온 상태"를 그대로 유지하도록 급지량을 다시 맞춘다.
   *
   * 종이 뭉치는 **아랫변 기준**이라(`translateY(-100% + fed)`), 급지가 끝난 뒤 내용이 길어지면
   * 같은 급지량으로는 윗부분이 슬롯 위로 밀려 올라가 마스크에 잘린다 — 슬립 맨 위에 있는
   * 사진이 가장 먼저 사라진다. 조회가 늦게 도착해 빈 슬립이 제품 슬립으로 바뀔 때 실제로 겪었다. */
  const syncFed = useCallback(() => {
    const m = measure();
    if (!m) return;
    const target = m.fedFor(stepRef.current);
    if (Math.abs(target - fedRef.current) > 0.5) setFed(target);
  }, [measure]);

  const goTo = useCallback(
    (next: number) => {
      const target = Math.max(0, Math.min(items.length, next));
      const m = measure();
      if (!m || target === stepRef.current) return;

      const from = fedRef.current;
      const to = m.fedFor(target);
      const distance = Math.abs(to - from);
      if (distance < 1) return;

      // 모터는 일정한 속도로 돈다 — 상품 한 장을 2초로 잡고 그 속도를 그대로 쓴다.
      const reference = m.heightOf(Math.min(1, items.length - 1)) + GAP;
      const speed = (reference > 0 ? reference : 340) / SLIP_MS;
      const duration = Math.min(4000, Math.max(400, distance / speed));

      cancelAnimationFrame(animationRef.current!);
      stopSoundRef.current?.();
      busyRef.current = true;
      stepRef.current = target;
      setStep(target);
      stopSoundRef.current = playFeedSound(duration);

      const started = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - started) / duration);
        setFed(from + (to - from) * t);
        if (t < 1) {
          animationRef.current = requestAnimationFrame(tick);
        } else {
          busyRef.current = false;
          syncFed(); // 급지 중에 내용이 바뀌었으면 여기서 바로잡는다
        }
      };
      animationRef.current = requestAnimationFrame(tick);
    },
    [items.length, measure, syncFed],
  );

  // 들어오자마자 첫 장을 뽑아 둔다.
  useLayoutEffect(() => {
    // 클립을 미리 받아 둔다. 첫 제스처 때 받으면 소리가 급지보다 늦게 붙는다.
    // (자동재생 정책상 컨텍스트는 첫 제스처에서 깨어난다 — 그때까지는 조용히 넘어간다.)
    void primeFeedSound();
    setFed(0);
    stepRef.current = 0;
    const id = requestAnimationFrame(() => goTo(Math.min(initial, items.length)));
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length, initial]);

  useEffect(
    () => () => {
      cancelAnimationFrame(animationRef.current!);
      stopSoundRef.current?.();
    },
    [],
  );

  // 조회가 늦게 도착하거나 내용이 바뀌어 종이 뭉치 높이가 달라지면 급지량을 다시 맞춘다.
  //
  // 실제 높이 변화(1px 이상)에만 반응한다. syncFed 가 --fed 를 다시 쓰면 fit-content + zoom 이
  // 재측정되면서 높이가 서브픽셀만큼 요동치는데, 그걸 그대로 받아 다시 syncFed 를 부르면
  // ResizeObserver ↔ 레이아웃 되먹임 고리가 생긴다. 브라우저가 이걸 프레임당 한 번으로 조이니
  // 120Hz(ProMotion) 에선 초당 120번 흔들려 "내려왔다 약간씩 위로 올라가며 끊기는" 것으로 보인다
  // (60Hz 아이폰 13 미니에선 대개 안정점에 안착해 안 보인다). 문턱값으로 이 고리를 끊는다.
  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    let lastHeight = strip.getBoundingClientRect().height;
    const observer = new ResizeObserver(() => {
      if (busyRef.current) return;
      const height = strip.getBoundingClientRect().height;
      if (Math.abs(height - lastHeight) < 1) return; // 서브픽셀 요동 무시 — 되먹임 고리 차단
      lastHeight = height;
      syncFed();
    });
    observer.observe(strip);

    // 화면 크기가 바뀌면 슬롯 선(--frame-w 기준)도 같이 움직인다. 종이 높이는 그대로일 수 있어
    // ResizeObserver 가 안 잡는 경우가 있다 — iOS 툴바가 접혔다 펴지는 브라우저에서 실제로 그렇다.
    // syncFed 는 0.5px 불감대가 있는 닫힌 루프라 여러 번 불려도 흔들리지 않는다.
    const onViewportChange = () => {
      if (!busyRef.current) syncFed();
    };
    window.addEventListener('resize', onViewportChange);
    window.addEventListener('orientationchange', onViewportChange);
    window.visualViewport?.addEventListener('resize', onViewportChange);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', onViewportChange);
      window.removeEventListener('orientationchange', onViewportChange);
      window.visualViewport?.removeEventListener('resize', onViewportChange);
    };
  }, [syncFed]);

  // 제스처 — 아래로 스크롤(손가락 위로)이 "한 장 더", 반대가 되감기.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    let wheelAcc = 0;
    let touchStart = 0;
    let touchHandled = false;

    const advance = (direction: number) => {
      primeFeedSound();
      if (busyRef.current) return;
      goTo(stepRef.current + direction);
    };

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      if (wheelAcc !== 0 && Math.sign(event.deltaY) !== Math.sign(wheelAcc)) wheelAcc = 0;
      wheelAcc += event.deltaY;
      if (Math.abs(wheelAcc) > 40) {
        advance(Math.sign(wheelAcc));
        wheelAcc = 0;
      }
    };

    const onTouchStart = (event: TouchEvent) => {
      touchStart = event.touches[0].clientY;
      touchHandled = false;
      primeFeedSound();
    };

    const onTouchMove = (event: TouchEvent) => {
      event.preventDefault();
      if (touchHandled) return;
      const delta = touchStart - event.touches[0].clientY;
      if (Math.abs(delta) > 45) {
        touchHandled = true;
        advance(Math.sign(delta));
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowDown' || event.key === ' ') advance(1);
      else if (event.key === 'ArrowUp') advance(-1);
      else return;
      event.preventDefault();
    };

    stage.addEventListener('wheel', onWheel, { passive: false });
    stage.addEventListener('touchstart', onTouchStart, { passive: true });
    stage.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('keydown', onKeyDown);
    return () => {
      stage.removeEventListener('wheel', onWheel);
      stage.removeEventListener('touchstart', onTouchStart);
      stage.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [goTo]);

  return (
    <div className={`stage feed-stage${photo ? ' photo' : ''}`} ref={stageRef}>
      {!photo && <PrinterHousing label={label} />}
      <div className="feed-viewport">
        <div className="feed-strip" ref={stripRef}>
          {/* 사진 모드에선 종이 내용만 사진 슬롯 폭에 맞춰 축소한다(영수증과 동일). 위치·급지량은
              바깥(feed-strip)이 그대로 잰다 — 슬롯 선은 축소되지 않아야 한다. */}
          <div className="feed-scale">
            {/* 먼저 나올 장을 맨 아래에 둔다 */}
            {items
              .map((item, k) => (
                <div
                  key={k}
                  ref={(el) => {
                    itemRefs.current[items.length - 1 - k] = el;
                  }}
                  // 아직 안 나온 장은 슬롯 위에 가려져 있을 뿐 눌리긴 한다 — 막아둔다
                  style={{ pointerEvents: k < step ? 'auto' : 'none' }}
                >
                  {item}
                </div>
              ))
              .reverse()}
          </div>
        </div>
      </div>
      {!photo && <PrinterLip />}
      {/* 제목은 사진의 핑크 슬롯 위에 검정 글씨로 얹는다 — 종이가 아니라 기계에 붙는다. */}
      {photo && label && <div className="photo-feed-label">{label}</div>}
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
