import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, RefreshCw, ScanFace } from 'lucide-react';
import { Button } from '@/components/common/Button';
import type { FaceCapture } from '@/api/self';
import { cn } from '@/lib/cn';

/*
 * Camera nhận diện khuôn mặt (face-api chạy ngay trên trình duyệt, mô hình ở /models/face — tải lần đầu ~7 MB).
 *
 * Các bước: 1 khuôn mặt, đủ gần, nhìn thẳng → quay đầu sang một bên → nhìn thẳng lại (người thật, không phải ảnh in)
 * → lấy mã khuôn mặt (trung bình 3 khung hình) + chụp ảnh JPEG. Máy chủ so mã với khuôn mặt đã đăng ký.
 * Camera trên điện thoại chỉ mở được khi trang chạy HTTPS (hoặc localhost).
 */

type FaceApi = typeof import('@vladmandic/face-api');
let apiPromise: Promise<FaceApi> | null = null;

/** Tải thư viện + 3 mô hình một lần cho cả phiên. */
function loadFaceApi(): Promise<FaceApi> {
  apiPromise ??= (async () => {
    const faceapi = await import('@vladmandic/face-api');
    const url = '/models/face';
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(url),
      faceapi.nets.faceLandmark68Net.loadFromUri(url),
      faceapi.nets.faceRecognitionNet.loadFromUri(url),
    ]);
    return faceapi;
  })().catch((e) => {
    apiPromise = null;
    throw e;
  });
  return apiPromise;
}

type Step = 'loading' | 'center' | 'turn' | 'back' | 'capturing' | 'done' | 'error';

const STEP_TEXT: Record<Step, string> = {
  loading: 'Đang mở camera và tải mô hình nhận diện…',
  center: 'Đưa khuôn mặt vào khung, nhìn thẳng camera',
  turn: 'Quay đầu chậm sang trái hoặc phải',
  back: 'Tốt! Giờ nhìn thẳng lại camera',
  capturing: 'Giữ yên… đang nhận diện',
  done: 'Đã nhận diện xong',
  error: '',
};

/** Tỉ lệ vị trí mũi giữa hai mắt: ~0,5 = nhìn thẳng; < 0,32 hoặc > 0,68 = đã quay đầu. */
function yawOf(landmarks: { getNose: () => { x: number }[]; getLeftEye: () => { x: number }[]; getRightEye: () => { x: number }[] }) {
  const nose = landmarks.getNose()[3].x;
  const l = landmarks.getLeftEye()[0].x;
  const r = landmarks.getRightEye()[3].x;
  return (nose - l) / Math.max(1, r - l);
}

export function FaceCamera({ onCapture, onCancel, title }: { onCapture: (c: FaceCapture) => void; onCancel: () => void; title: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [step, setStep] = useState<Step>('loading');
  const [hint, setHint] = useState('');
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const stepRef = useRef<Step>('loading');
  // Giữ hàm mới nhất mà không khởi động lại camera khi trang cha vẽ lại.
  const onCaptureRef = useRef(onCapture);
  onCaptureRef.current = onCapture;
  const go = (s: Step) => { stepRef.current = s; setStep(s); };

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer = 0;
    let stable = 0;
    go('loading');
    setError('');
    setHint('');

    const fail = (msg: string) => {
      if (cancelled) return;
      setError(msg);
      go('error');
      stop();
    };

    (async () => {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        return fail('Trình duyệt chỉ cho mở camera khi trang chạy HTTPS (hoặc localhost). Hãy mở trang bằng địa chỉ https:// của nhà hàng.');
      }
      let faceapi: FaceApi;
      try {
        const [api, stream] = await Promise.all([
          loadFaceApi(),
          navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false }),
        ]);
        faceapi = api;
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        const v = videoRef.current!;
        v.srcObject = stream;
        await v.play();
      } catch (e) {
        const name = (e as { name?: string })?.name;
        return fail(name === 'NotAllowedError' ? 'Bạn chưa cho phép dùng camera. Bấm biểu tượng ổ khóa trên thanh địa chỉ → cho phép Camera, rồi thử lại.'
          : name === 'NotFoundError' ? 'Không tìm thấy camera trên thiết bị.'
          : 'Không mở được camera hoặc tải mô hình nhận diện. Kiểm tra kết nối rồi thử lại.');
      }
      go('center');
      const opts = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 });
      // Lúc lấy mã khuôn mặt: ảnh vào mạng to hơn (khung mặt chính xác hơn → mã ổn định hơn), ngưỡng phát hiện cao hơn.
      const captureOpts = new faceapi.TinyFaceDetectorOptions({ inputSize: 512, scoreThreshold: 0.6 });
      const dist = (a: Float32Array, b: Float32Array) => Math.sqrt(a.reduce((s, x, k) => s + (x - b[k]) ** 2, 0));

      const capture = async () => {
        const v = videoRef.current!;
        const descs: Float32Array[] = [];
        for (let i = 0; i < 10 && descs.length < 5; i++) {
          const r = await faceapi.detectSingleFace(v, captureOpts).withFaceLandmarks().withFaceDescriptor();
          if (r && Math.abs(yawOf(r.landmarks) - 0.5) < 0.12) descs.push(r.descriptor);
          await new Promise((res) => setTimeout(res, 100));
        }
        if (cancelled) return;
        // Các khung hình phải giống nhau (cùng một người, giữ yên): lệch nhau quá 0,3 → làm lại.
        const spread = descs.length < 2 ? 1 : Math.max(...descs.flatMap((a, i) => descs.slice(i + 1).map((b) => dist(a, b))));
        if (descs.length < 3 || spread > 0.3) { setHint('Không nhận rõ khuôn mặt — đứng nơi đủ sáng, nhìn thẳng và giữ yên'); stable = 0; go('center'); timer = window.setTimeout(loop, 200); return; }
        const avg = Array.from({ length: 128 }, (_, k) => descs.reduce((s, d) => s + d[k], 0) / descs.length);
        const canvas = document.createElement('canvas');
        const scale = Math.min(1, 640 / v.videoWidth);
        canvas.width = Math.round(v.videoWidth * scale);
        canvas.height = Math.round(v.videoHeight * scale);
        canvas.getContext('2d')!.drawImage(v, 0, 0, canvas.width, canvas.height);
        go('done');
        stop();
        onCaptureRef.current({ descriptor: avg.map((x) => Math.round(x * 1e6) / 1e6), photo: canvas.toDataURL('image/jpeg', 0.85), liveness: true });
      };

      const loop = async () => {
        if (cancelled || !videoRef.current) return;
        const v = videoRef.current;
        const faces = await faceapi.detectAllFaces(v, opts).withFaceLandmarks();
        if (cancelled) return;
        const s = stepRef.current;
        if (faces.length !== 1) {
          setHint(faces.length === 0 ? 'Chưa thấy khuôn mặt' : 'Chỉ một người trong khung hình');
          stable = 0;
        } else {
          const f = faces[0];
          const wide = f.detection.box.width / v.videoWidth;
          const yaw = yawOf(f.landmarks);
          const front = Math.abs(yaw - 0.5) < 0.12;
          if (wide < 0.22) { setHint('Lại gần camera hơn'); stable = 0; }
          else if (s === 'center') {
            setHint('');
            stable = front ? stable + 1 : 0;
            if (stable >= 4) { stable = 0; go('turn'); }
          } else if (s === 'turn') {
            if (yaw < 0.32 || yaw > 0.68) { stable = 0; go('back'); }
          } else if (s === 'back') {
            stable = front ? stable + 1 : 0;
            if (stable >= 3) { go('capturing'); await capture(); return; }
          }
        }
        timer = window.setTimeout(loop, 120);
      };
      void loop();
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      stop();
    };
  }, [attempt, stop]);

  const progress = { loading: 0, center: 1, turn: 2, back: 3, capturing: 4, done: 4, error: 0 }[step];

  return (
    <div className="space-y-3">
      <p className="text-[15px] font-bold">{title}</p>
      <div className="relative mx-auto aspect-[3/4] w-full max-w-[340px] overflow-hidden rounded-[20px] bg-black">
        <video ref={videoRef} playsInline muted className="h-full w-full -scale-x-100 object-cover" />
        {/* Khung hình bầu dục hướng dẫn */}
        <div className={cn('pointer-events-none absolute left-1/2 top-[44%] h-[62%] w-[70%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border-[3px] transition-colors', step === 'back' || step === 'capturing' || step === 'done' ? 'border-[#22c55e]' : step === 'turn' ? 'border-[#f59e0b]' : 'border-white/80')} />
        {step === 'loading' ? <div className="absolute inset-0 grid place-items-center text-white/80"><ScanFace size={48} className="animate-pulse" /></div> : null}
        {step === 'error' ? <div className="absolute inset-0 grid place-items-center p-6 text-center text-[13.5px] text-white">{error}</div> : null}
        {step !== 'error' ? (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 pt-10 text-center text-white">
            <p className="text-[15px] font-bold">{STEP_TEXT[step]}</p>
            {hint ? <p className="text-[12.5px] text-[#fde68a]">{hint}</p> : null}
          </div>
        ) : null}
      </div>
      <div className="mx-auto flex max-w-[340px] gap-1">
        {[1, 2, 3, 4].map((n) => <span key={n} className={cn('h-1.5 flex-1 rounded-full', progress >= n ? 'bg-[var(--accent)]' : 'bg-[var(--border)]')} />)}
      </div>
      <div className="mx-auto flex max-w-[340px] gap-2">
        <Button variant="ghost" className="flex-1" onClick={() => { stop(); onCancel(); }}>Hủy</Button>
        {step === 'error' ? <Button className="flex-1" leadingIcon={<RefreshCw size={15} />} onClick={() => setAttempt((a) => a + 1)}>Thử lại</Button> : null}
        {step === 'loading' ? <Button className="flex-1" disabled leadingIcon={<Camera size={15} />}>Đang mở…</Button> : null}
      </div>
    </div>
  );
}
