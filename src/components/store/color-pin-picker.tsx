import { Check, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const L = {
  title: "اختر اللون من الصورة",
  hint: "اضغط على المكان الذي تريد أخذ لونه، ويمكنك سحب الدبوس لضبطه.",
  use: "اعتماد هذا اللون",
  close: "إغلاق",
  noImage: "أضف صورة للمنتج أولاً.",
  unreadable: "تعذّرت قراءة ألوان هذه الصورة من الرابط. ارفعها من جهازك بدلاً من ذلك.",
};

type Props = {
  /** The product images (URLs or data URLs) the colour can be picked from. */
  images: string[];
  /** Which image to open first (the colour's own picture). */
  initialIndex?: number;
  /** Colour shown before the first tap (e.g. the colour's current hex). */
  initialHex?: string;
  /** Called with a `#rrggbb` value when the admin confirms the pin. */
  onConfirm: (hex: string) => void;
  onClose: () => void;
};

const toHex = (r: number, g: number, b: number) =>
  "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");

/**
 * Full-screen picker: shows the product image, the admin taps (or drags the pin to) the spot
 * whose colour the swatch should take. The colour is the average of a small patch around the pin,
 * so a single noisy pixel does not decide the result.
 */
export function ColorPinPicker({ images, initialIndex = 0, initialHex, onConfirm, onClose }: Props) {
  const dir = "rtl";
  const [index, setIndex] = useState(() => Math.max(0, Math.min(images.length - 1, initialIndex)));
  const [pin, setPin] = useState<{ x: number; y: number } | null>(null); // 0..1 inside the image
  const [hex, setHex] = useState<string | null>(initialHex ?? null);
  const [unreadable, setUnreadable] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragging = useRef(false);

  const src = images[index];
  // Cross-origin images need CORS to be readable; data:/blob: URLs never do.
  const needsCors = Boolean(src) && !/^(data:|blob:)/.test(src) && !src.startsWith("/");

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Switching image resets the pin.
  useEffect(() => {
    setPin(null);
    setUnreadable(false);
    canvasRef.current = null;
  }, [index]);

  const paintCanvas = useCallback(() => {
    const img = imgRef.current;
    if (!img || !img.naturalWidth) return false;
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return false;
    ctx.drawImage(img, 0, 0);
    canvasRef.current = canvas;
    return true;
  }, []);

  const sample = useCallback(
    (px: number, py: number) => {
      if (!canvasRef.current && !paintCanvas()) return;
      const canvas = canvasRef.current!;
      const radius = Math.max(2, Math.round(canvas.width / 300));
      const x = Math.max(0, Math.min(canvas.width - 1, Math.round(px * canvas.width)));
      const y = Math.max(0, Math.min(canvas.height - 1, Math.round(py * canvas.height)));
      const x0 = Math.max(0, x - radius);
      const y0 = Math.max(0, y - radius);
      const w = Math.min(canvas.width - x0, radius * 2 + 1);
      const h = Math.min(canvas.height - y0, radius * 2 + 1);
      try {
        const data = canvas.getContext("2d")!.getImageData(x0, y0, w, h).data;
        let r = 0, g = 0, b = 0, n = 0;
        for (let i = 0; i < data.length; i += 4) {
          const a = data[i + 3] / 255;
          if (a < 0.1) continue; // skip transparent pixels
          r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
        }
        if (n) setHex(toHex(r / n, g / n, b / n));
        setUnreadable(false);
      } catch {
        // Tainted canvas: the image host does not allow reading its pixels.
        setUnreadable(true);
      }
    },
    [paintCanvas],
  );

  const place = (e: React.PointerEvent<HTMLDivElement>) => {
    const img = imgRef.current;
    if (!img) return;
    const rect = img.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    setPin({ x, y });
    sample(x, y);
  };

  if (!src) {
    return (
      <div className="fixed inset-0 z-[70] grid place-items-center bg-black/70 p-4" dir={dir} onClick={onClose}>
        <div className="rounded-lg bg-bg p-6 text-sm text-fg" onClick={(e) => e.stopPropagation()}>
          {L.noImage}
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col bg-black/80 p-3 sm:p-6"
      dir={dir}
      role="dialog"
      aria-modal="true"
      aria-label={L.title}
    >
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 pb-3 text-white">
        <div>
          <p className="text-sm font-semibold">{L.title}</p>
          <p className="text-xs text-white/70">{L.hint}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={L.close}
          className="grid size-9 shrink-0 place-items-center rounded-full bg-white/10 hover:bg-white/20"
        >
          <X className="size-5" />
        </button>
      </div>

      <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 items-center justify-center overflow-auto">
        {/* The wrapper hugs the image so the pin's percentage position matches the picture. */}
        <div
          className="relative inline-block max-h-full max-w-full cursor-crosshair select-none"
          style={{ touchAction: "none" }}
          onPointerDown={(e) => {
            dragging.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            place(e);
          }}
          onPointerMove={(e) => dragging.current && place(e)}
          onPointerUp={() => (dragging.current = false)}
          onPointerCancel={() => (dragging.current = false)}
        >
          <img
            key={src}
            ref={imgRef}
            src={src}
            alt=""
            draggable={false}
            crossOrigin={needsCors ? "anonymous" : undefined}
            onLoad={paintCanvas}
            onError={() => setUnreadable(true)}
            className="block max-h-[65vh] max-w-full rounded-md object-contain"
          />
          {pin ? (
            <svg
              viewBox="0 0 24 32"
              className="pointer-events-none absolute size-8 drop-shadow-lg"
              style={{ left: `${pin.x * 100}%`, top: `${pin.y * 100}%`, transform: "translate(-50%, -100%)" }}
              aria-hidden
            >
              <path
                d="M12 31C12 31 2 19.5 2 12a10 10 0 0 1 20 0c0 7.5-10 19-10 19Z"
                fill={hex ?? "#fff"}
                stroke="#fff"
                strokeWidth="2"
              />
              <circle cx="12" cy="12" r="3.5" fill="none" stroke="#fff" strokeWidth="2" />
            </svg>
          ) : null}
        </div>
      </div>

      {images.length > 1 ? (
        <div className="mx-auto flex w-full max-w-3xl justify-center gap-2 pt-3">
          {images.map((image, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`#${i + 1}`}
              className={cn(
                "size-12 overflow-hidden rounded-md border-2",
                i === index ? "border-white" : "border-transparent opacity-60",
              )}
            >
              <img src={image} alt="" className="size-full object-cover" draggable={false} />
            </button>
          ))}
        </div>
      ) : null}

      <div className="mx-auto flex w-full max-w-3xl flex-col gap-2 pt-3">
        {unreadable ? <p className="text-xs text-amber-300">{L.unreadable}</p> : null}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-white">
            <span
              className="size-9 rounded-full border-2 border-white/80"
              style={{ background: hex ?? "transparent" }}
              aria-hidden
            />
            <span className="font-mono text-sm" dir="ltr">
              {hex ?? "—"}
            </span>
          </div>
          <button
            type="button"
            disabled={!hex || !pin}
            onClick={() => hex && onConfirm(hex)}
            className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-semibold text-black disabled:opacity-40"
          >
            <Check className="size-4" />
            {L.use}
          </button>
        </div>
      </div>
    </div>
  );
}
