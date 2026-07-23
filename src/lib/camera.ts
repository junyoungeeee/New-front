import { useEffect, useRef, useState } from 'react';

export type CameraStatus =
  | { kind: 'idle' }
  | { kind: 'running' }
  | { kind: 'denied' }
  | { kind: 'failed'; message: string };

/** 인앱 브라우저(카카오톡·인스타 등)에서는 getUserMedia 가 막히거나 조용히 실패한다.
 *  링크 공유가 웹의 주 유입 경로인데 그 경로가 정확히 카메라가 안 되는 경로다. */
export function isInAppBrowser() {
  const ua = navigator.userAgent;
  return /KAKAOTALK|Instagram|FBAN|FBAV|Line\/|NAVER|DaumApps/i.test(ua);
}

/** 카메라를 열고 <video> 에 물린다. 화면을 벗어나면 반드시 트랙을 멈춘다 —
 *  iOS 는 스트림을 놓지 않으면 다음 화면에서 카메라를 다시 못 여는 경우가 있다. */
export function useCamera(enabled: boolean) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<CameraStatus>({ kind: 'idle' });

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus({
          kind: 'failed',
          message: isInAppBrowser()
            ? '인앱 브라우저예요. Safari나 Chrome으로 열어주세요.'
            : '이 브라우저에서는 카메라를 쓸 수 없어요.',
        });
        return;
      }
      try {
        // exact 로 주면 후면 카메라가 없는 기기(데스크톱)에서 통째로 실패한다.
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          video.setAttribute('playsinline', ''); // 없으면 iOS 가 전체화면으로 띄운다
          video.muted = true;
          await video.play().catch(() => undefined);
        }
        setStatus({ kind: 'running' });
      } catch (error) {
        const name = (error as DOMException)?.name;
        if (name === 'NotAllowedError' || name === 'SecurityError') {
          setStatus({ kind: 'denied' });
        } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
          setStatus({ kind: 'failed', message: '사용할 수 있는 카메라가 없어요.' });
        } else {
          setStatus({
            kind: 'failed',
            message: isInAppBrowser()
              ? '인앱 브라우저예요. Safari나 Chrome으로 열어주세요.'
              : '카메라를 열지 못했어요.',
          });
        }
      }
    })();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setStatus({ kind: 'idle' });
    };
  }, [enabled]);

  return { videoRef, status, stop: () => streamRef.current?.getTracks().forEach((t) => t.stop()) };
}

/** 가이드 창이 화면에서 차지하는 영역을 원본 픽셀로 옮긴다.
 *  프리뷰가 object-fit: cover 라 짧은 축을 기준으로 맞춰야 실제로 보이던 영역과 같아진다. */
export function centerCropRect(width: number, height: number, windowAspect: number) {
  const imageAspect = width / height;
  let cropWidth = width;
  let cropHeight = height;
  if (imageAspect > windowAspect) {
    cropWidth = height * windowAspect; // 원본이 더 넓다 — 높이를 다 쓰고 폭을 잘라낸다
  } else {
    cropHeight = width / windowAspect;
  }
  return {
    sx: (width - cropWidth) / 2,
    sy: (height - cropHeight) / 2,
    sw: cropWidth,
    sh: cropHeight,
  };
}

/** 현재 프레임을 그대로 뽑는다. 크롭은 누끼 단계에서 한다. */
export async function grabFrame(video: HTMLVideoElement): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d')!.drawImage(video, 0, 0);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('프레임을 만들지 못했습니다'))),
      'image/png',
    );
  });
}
