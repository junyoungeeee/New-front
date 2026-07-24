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
   * getBoundingClientRect 로 재는 이유: 사진 모드에선 슬립을 `zoom` 으로 축소하는데,
   * offsetTop/offsetHeight 는 zoom 을 일관되게 반영하지 않아(브라우저·버전별로 다르다) 급지량이
   * 어긋난다 — 첫 화면에서 바코드 꼬리만 나오던 원인. rect 는 항상 실제 렌더 픽셀이라, strip 기준
   * 상대 위치(slip.top − strip.top)는 strip 의 transform 과 무관하게 zoom 까지 반영해 일관된다. */
  const measure = useCallback(() => {
    const strip = stripRef.current;
    if (!strip) return null;
    const stripRect = strip.getBoundingClientRect();
    const at = (k: number) => itemRefs.current[items.length - 1 - k];
    return {
      stripHeight: stripRect.height,
      topOf: (k: number) => {
        const el = at(k);
        return el ? el.getBoundingClientRect().top - stripRect.top : 0;
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
    const target = stepRef.current <= 0 ? 0 : m.stripHeight - m.topOf(stepRef.current - 1);
    if (Math.abs(target - fedRef.current) > 0.5) setFed(target);
  }, [measure]);

  const goTo = useCallback(
    (next: number) => {
      const target = Math.max(0, Math.min(items.length, next));
      const m = measure();
      if (!m || target === stepRef.current) return;

      // n 장이 나왔을 때의 급지량 = 종이 뭉치 아랫변에서 n-1 번째 장의 윗변까지
      const fedFor = (n: number) => (n <= 0 ? 0 : m.stripHeight - m.topOf(n - 1));
      const from = fedRef.current;
      const to = fedFor(target);
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
  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const observer = new ResizeObserver(() => {
      if (!busyRef.current) syncFed();
    });
    observer.observe(strip);
    return () => observer.disconnect();
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
