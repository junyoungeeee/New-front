/** 프린터 소리. 파일 없이도 나야 한다 — 배포본에 음원이 없으면 조용히 무음이 되는 게 아니라
 *  합성음으로 떨어진다. `/feed.m4a` 가 있으면 그걸 먼저 쓰고, 없으면(404) 래칫을 만들어 낸다. */
const CLIP_URL = '/feed.m4a';

let context: AudioContext | null = null;
let clip: AudioBuffer | null = null;
let noise: AudioBuffer | null = null;
let loading: Promise<void> | null = null;
let silentLoop: HTMLAudioElement | null = null;

/** 무음(벨소리) 스위치가 걸려 있어도 소리가 나게 한다.
 *
 * iOS 는 페이지의 오디오 세션이 "환경음"이면 Web Audio 를 통째로 죽인다. 세션을
 * **"미디어 재생"** 으로 올리면 무음 스위치를 무시하는데, iOS 에서 이 둘은 한 덩어리라
 * **다른 앱 소리(음악·팟캐스트)를 끊는 대가**가 함께 따라온다. 분리할 수 없다.
 *
 * 정식 API 가 있으면 그걸 쓰고, 없으면 무음 트랙을 계속 재생해 세션을 붙잡는 예전 우회법으로
 * 떨어진다. 우회법은 WebKit 내부 동작에 기대는 것이라 iOS 판올림으로 깨질 수 있다. */
function claimPlaybackSession() {
  const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
  if (session) {
    try {
      session.type = 'playback';
      return;
    } catch {
      // 아래 우회법으로 간다
    }
  }

  // 우회법은 iOS 에서만 쓴다. 다른 곳에서는 무음 스위치라는 게 없는데다, 무음 트랙이 계속
  // 재생되면 브라우저 탭에 "소리 재생 중" 표시가 내내 붙는다.
  const iOS =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (!iOS || silentLoop || !context) return;

  silentLoop = document.createElement('audio');
  silentLoop.src = silentWavUrl();
  silentLoop.loop = true;
  silentLoop.setAttribute('playsinline', '');
  try {
    // 컨텍스트를 통과시켜야 세션이 Web Audio 출력에까지 걸린다
    context.createMediaElementSource(silentLoop).connect(context.destination);
  } catch {
    // 연결이 안 되면 엘리먼트 재생만으로도 세션은 잡힌다
  }
  void silentLoop.play().catch(() => undefined);
}

/** 내용이 전부 0인 WAV. 들리지 않지만 "재생 중"으로 잡힌다. */
function silentWavUrl() {
  const rate = 8000;
  const frames = rate / 2;
  const buffer = new ArrayBuffer(44 + frames * 2);
  const view = new DataView(buffer);
  const text = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };
  text(0, 'RIFF');
  view.setUint32(4, 36 + frames * 2, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // 모노
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, frames * 2, true);
  // 나머지는 0 = 무음
  return URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }));
}

/** iOS 잠금 해제.
 *
 * iOS Safari 는 `resume()` 만으로는 부족하고 **제스처 안에서 실제로 한 번 재생**해야 열린다.
 * 앱 코드는 소리를 `await` 뒤(`.then`)에 시작하는데 그 시점은 이미 제스처 밖이라, 그대로 두면
 * 아무 소리도 나지 않는다 — 진단 페이지(탭 핸들러 안에서 바로 재생)는 들리는데 앱만
 * 조용했던 이유가 이것이다.
 *
 * 그래서 화면 어디든 첫 조작이 들어오는 순간 무음 버퍼를 한 번 흘려 잠금을 풀어 둔다.
 * 홈에서 카테고리를 누르는 그 탭이 이미 해제 시점이 되므로, S07 에 들어오자마자 도는
 * 자동 급지부터 소리가 난다. */
export function installAudioUnlock() {
  const events = ['pointerdown', 'touchstart', 'click', 'keydown'] as const;

  const unlock = () => {
    context ??= new AudioContext();
    if (context.state === 'suspended') void context.resume();

    // 길이 1프레임짜리 무음. 재생 자체가 목적이다.
    const source = context.createBufferSource();
    source.buffer = context.createBuffer(1, 1, context.sampleRate);
    source.connect(context.destination);
    source.start(0);

    // 무음 스위치가 걸려 있어도 들리게 세션을 올린다 (제스처 안이어야 잡힌다)
    claimPlaybackSession();

    void primeFeedSound(); // 음원도 미리 받아 둔다

    if (context.state === 'running') {
      events.forEach((type) => document.removeEventListener(type, unlock, true));
    }
  };

  events.forEach((type) => document.addEventListener(type, unlock, true));
}

/** 컨텍스트가 깨어나고 음원 준비가 끝나면 이행된다. */
export function primeFeedSound(): Promise<void> {
  context ??= new AudioContext();

  // resume() 은 비동기다. 부르자마자 state 를 보면 아직 'suspended' 라 첫 소리를 놓친다.
  const resumed =
    context.state === 'running' ? Promise.resolve() : context.resume().catch(() => undefined);

  loading ??= fetch(CLIP_URL)
    .then((res) => (res.ok ? res.arrayBuffer() : Promise.reject(new Error('없음'))))
    .then((raw) => context!.decodeAudioData(raw))
    .then((buffer) => {
      clip = buffer;
    })
    .catch(() => {
      // 음원이 없으면 합성으로 간다
    });

  return Promise.all([resumed, loading]).then(() => undefined);
}

/** 급지가 도는 동안만 낸다. 멈추는 함수를 돌려준다.
 *
 * 음원 로딩이 끝나기를 **기다렸다가** 울린다. 예전엔 준비가 안 됐으면 즉시 포기해서
 * 화면에 들어와 처음 도는 급지가 늘 무음이었다 — 클립을 그때 막 받고 있었기 때문이다. */
export function playFeedSound(durationMs: number): () => void {
  const startedAt = performance.now();
  let cancelled = false;
  let stop: (() => void) | undefined;

  void primeFeedSound().then(() => {
    if (cancelled || !context || context.state !== 'running') return;
    const remaining = durationMs - (performance.now() - startedAt);
    if (remaining < 150) return; // 거의 끝났으면 굳이 울리지 않는다
    stop = clip ? playClip(remaining) : playRatchet(remaining);
  });

  return () => {
    cancelled = true;
    stop?.();
  };
}

/** 녹음된 클립을 급지 길이에 맞춰 이어 붙인다. */
function playClip(durationMs: number): () => void {
  const ctx = context!;
  const now = ctx.currentTime;
  const seconds = durationMs / 1000;
  const fade = Math.min(0.06, seconds / 4);

  const source = ctx.createBufferSource();
  source.buffer = clip;
  source.loop = true; // 급지가 클립보다 길면 이어 붙인다

  const gain = ctx.createGain();
  envelope(gain, now, seconds, fade, 0.35);

  source.connect(gain).connect(ctx.destination);
  source.start(now);
  source.stop(now + seconds);
  return () => fadeOut(gain, source);
}

/** 음원이 없을 때 만들어 쓰는 급지음.
 *
 * 감열 프린터 소리는 스테퍼 모터의 저음 험 위에, 종이가 한 칸씩 밀릴 때 나는 짧고 마른
 * 딱딱거림이 규칙적으로 얹힌 것이다. 잡음을 잘게 끊어 그 딱딱거림을 만든다. */
function playRatchet(durationMs: number): () => void {
  const ctx = context!;
  const now = ctx.currentTime;
  const seconds = durationMs / 1000;
  const fade = Math.min(0.06, seconds / 4);

  const out = ctx.createGain();
  envelope(out, now, seconds, fade, 0.5);
  out.connect(ctx.destination);

  // 모터 험
  const hum = ctx.createOscillator();
  hum.type = 'sawtooth';
  hum.frequency.value = 74;
  const humLow = ctx.createBiquadFilter();
  humLow.type = 'lowpass';
  humLow.frequency.value = 300;
  const humGain = ctx.createGain();
  humGain.gain.value = 0.07;
  hum.connect(humLow).connect(humGain).connect(out);
  hum.start(now);
  hum.stop(now + seconds);

  // 종이가 한 칸씩 밀리는 딱딱거림
  noise ??= makeNoise(ctx);
  const grains = ctx.createBufferSource();
  grains.buffer = noise;
  grains.loop = true;
  const band = ctx.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = 2600;
  band.Q.value = 1.1;
  const chop = ctx.createGain();
  chop.gain.setValueAtTime(0.0001, now);

  const rate = 52; // 초당 몇 칸씩 밀리는가
  const ticks = Math.min(260, Math.floor(seconds * rate));
  for (let i = 0; i < ticks; i++) {
    const t = now + i / rate;
    // 세기를 조금씩 흔들어야 기계 소리로 들린다 — 일정하면 그냥 웅웅거린다
    const level = 0.55 + Math.random() * 0.45;
    chop.gain.setValueAtTime(0.0001, t);
    chop.gain.linearRampToValueAtTime(level, t + 0.0012);
    chop.gain.exponentialRampToValueAtTime(0.0001, t + 0.013);
  }

  grains.connect(band).connect(chop).connect(out);
  grains.start(now);
  grains.stop(now + seconds);

  return () => fadeOut(out, grains, hum);
}

/** 등록한 제품이 프린터에서 나올 때 울리는 징.
 *
 * 배음이 정수배가 아니어야 쇳소리가 난다. 같은 배음을 조금 어긋나게 두 개씩 쌓으면
 * 맥놀이가 생겨 징 특유의 일렁임이 된다. */
export function playChime() {
  void primeFeedSound().then(() => {
    if (!context || context.state !== 'running') return;
    const ctx = context;
    const now = ctx.currentTime;

    const out = ctx.createGain();
    out.gain.value = 0.5;
    out.connect(ctx.destination);

    const base = 340;
    [1, 1.48, 2.11, 2.83, 3.76].forEach((ratio, index) => {
      const decay = 1.8 - index * 0.22; // 높은 배음일수록 먼저 사그라든다
      [-1, 1].forEach((detune) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = base * ratio;
        osc.detune.value = detune * 6;
        // 징은 때린 뒤 음이 살짝 처진다
        osc.frequency.exponentialRampToValueAtTime(base * ratio * 0.985, now + decay);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.5 / (index + 1.6), now + 0.006);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + decay);

        osc.connect(gain).connect(out);
        osc.start(now);
        osc.stop(now + decay);
      });
    });
  });
}

// ─── 조각들 ───

function makeNoise(ctx: AudioContext) {
  const length = Math.floor(ctx.sampleRate * 0.5);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

/** 모터가 돌기 시작하고 멈추는 느낌 — 양끝을 짧게 여닫는다. */
function envelope(gain: GainNode, now: number, seconds: number, fade: number, peak: number) {
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(peak, now + fade);
  gain.gain.setValueAtTime(peak, now + seconds - fade);
  gain.gain.linearRampToValueAtTime(0, now + seconds);
}

function fadeOut(gain: GainNode, ...sources: AudioScheduledSourceNode[]) {
  if (!context) return;
  const now = context.currentTime;
  try {
    gain.gain.cancelScheduledValues(now);
    gain.gain.linearRampToValueAtTime(0, now + 0.05);
    sources.forEach((source) => source.stop(now + 0.06));
  } catch {
    // 이미 끝난 소스를 멈추면 던진다 — 무시해도 되는 경우다
  }
}
