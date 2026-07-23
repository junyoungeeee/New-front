/** 프린터 급지음. `스크롤 소리 복사본.m4a` 의 7.0~9.0초 구간을 잘라낸 것으로,
 *  가장 고르게 래칫이 도는 대목이고 길이가 마침 상품 한 장이 나오는 시간(2초)과 같다.
 *
 *  <audio> 대신 Web Audio 를 쓰는 이유: 급지 길이가 매번 달라서 재생을 정확히 끊어야 하고,
 *  연속으로 밀 때 이전 소리와 겹쳐도 끊기지 않아야 한다. */
const CLIP_URL = '/feed.m4a';

let context: AudioContext | null = null;
let clip: AudioBuffer | null = null;
let loading: Promise<void> | null = null;

/** 사용자 제스처 안에서 불러야 한다 — 브라우저 자동재생 정책상 그 밖에서는 컨텍스트가 잠긴다. */
export function primeFeedSound() {
  context ??= new AudioContext();
  if (context.state === 'suspended') void context.resume();

  loading ??= fetch(CLIP_URL)
    .then((res) => res.arrayBuffer())
    .then((raw) => context!.decodeAudioData(raw))
    .then((buffer) => {
      clip = buffer;
    })
    .catch(() => {
      // 소리는 곁들이 요소다. 못 받아도 급지 자체는 굴러가야 한다.
    });

  return loading;
}

/** 등록한 제품이 프린터에서 나올 때 울리는 징.
 *
 * 파일을 두지 않고 합성한다 — 배음이 정수배가 아니어야 쇳소리가 나는데, 그 비율을
 * 코드로 적어 두는 편이 짧고 손대기도 쉽다. 같은 배음을 조금 어긋나게 두 개씩 쌓으면
 * 맥놀이가 생겨 징 특유의 일렁임이 된다. */
export function playChime() {
  if (!context || context.state !== 'running') return;

  const now = context.currentTime;
  const out = context.createGain();
  out.gain.value = 0.5;
  out.connect(context.destination);

  const base = 340;
  const partials = [1, 1.48, 2.11, 2.83, 3.76];

  partials.forEach((ratio, index) => {
    const decay = 1.8 - index * 0.22; // 높은 배음일수록 먼저 사그라든다
    [-0.6, 0.6].forEach((detune) => {
      const osc = context!.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = base * ratio;
      osc.detune.value = detune * 6;
      // 징은 때린 뒤 음이 살짝 처진다
      osc.frequency.exponentialRampToValueAtTime(base * ratio * 0.985, now + decay);

      const gain = context!.createGain();
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.5 / (index + 1.6), now + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + decay);

      osc.connect(gain).connect(out);
      osc.start(now);
      osc.stop(now + decay);
    });
  });
}

/** 급지가 도는 동안만 낸다. 멈추는 함수를 돌려준다. */
export function playFeedSound(durationMs: number): () => void {
  if (!context || !clip || context.state !== 'running') return () => {};

  const source = context.createBufferSource();
  source.buffer = clip;
  source.loop = true; // 급지가 클립보다 길면 이어 붙인다

  const gain = context.createGain();
  const now = context.currentTime;
  const seconds = durationMs / 1000;
  const fade = Math.min(0.06, seconds / 4);

  // 모터가 돌기 시작하고 멈추는 느낌 — 양끝을 짧게 여닫는다
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.35, now + fade);
  gain.gain.setValueAtTime(0.35, now + seconds - fade);
  gain.gain.linearRampToValueAtTime(0, now + seconds);

  source.connect(gain).connect(context.destination);
  source.start(now);
  source.stop(now + seconds);

  return () => {
    try {
      gain.gain.cancelScheduledValues(context!.currentTime);
      gain.gain.linearRampToValueAtTime(0, context!.currentTime + 0.05);
      source.stop(context!.currentTime + 0.06);
    } catch {
      // 이미 끝난 소스를 멈추면 던진다 — 무시해도 되는 경우다
    }
  };
}
