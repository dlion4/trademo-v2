"use client";
import { useEffect, useRef, useState } from "react";
export function AvatarCrop({
  onApply,
}: {
  onApply: (dataUrl: string) => void;
}) {
  const [image, setImage] = useState<HTMLImageElement | null>(null),
    [zoom, setZoom] = useState(1),
    [x, setX] = useState(0),
    [y, setY] = useState(0),
    [error, setError] = useState("");
  const canvas = useRef<HTMLCanvasElement>(null),
    objectUrl = useRef<string | null>(null),
    selection = useRef(0);
  useEffect(
    () => () => {
      selection.current++;
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    },
    [],
  );
  useEffect(() => {
    const target = canvas.current,
      ctx = target?.getContext("2d");
    if (!target || !ctx) return;
    ctx.clearRect(0, 0, 256, 256);
    ctx.fillStyle = "#eff5f4";
    ctx.fillRect(0, 0, 256, 256);
    if (!image) {
      ctx.fillStyle = "#0f766e";
      ctx.font = "32px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("JO", 128, 140);
      return;
    }
    const size = Math.min(image.naturalWidth, image.naturalHeight) / zoom,
      sx = ((image.naturalWidth - size) * (x + 100)) / 200,
      sy = ((image.naturalHeight - size) * (y + 100)) / 200;
    ctx.drawImage(image, sx, sy, size, size, 0, 0, 256, 256);
  }, [image, zoom, x, y]);
  return (
    <div className="st-crop">
      <label className="st-field">
        Choose a profile image
        <input
          type="file"
          aria-label="Avatar image file"
          className="form-control"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const ticket = ++selection.current;
            setError("");
            setImage(null);
            if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
            if (
              !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
              file.size > 5 * 1024 * 1024
            ) {
              setError("Use a JPEG, PNG or WebP image up to 5 MB");
              return;
            }
            const img = new Image(),
              url = URL.createObjectURL(file);
            objectUrl.current = url;
            img.onload = () => {
              if (ticket !== selection.current) return;
              if (
                img.naturalWidth * img.naturalHeight > 32000000 ||
                Math.min(img.naturalWidth, img.naturalHeight) < 64
              ) {
                setError(
                  "Choose an image at least 64 × 64 pixels and no larger than 32 megapixels",
                );
                return;
              }
              setImage(img);
              setZoom(1);
              setX(0);
              setY(0);
            };
            img.onerror = () => {
              if (ticket === selection.current)
                setError("Image could not be decoded. Choose another file.");
            };
            img.src = url;
          }}
        />
      </label>
      <div className="st-crop-grid">
        <canvas
          ref={canvas}
          width={256}
          height={256}
          aria-label="Avatar square crop preview"
        />
        <div>
          {[
            ["Zoom", zoom, setZoom, 1, 3, 0.01],
            ["Horizontal crop", x, setX, -100, 100, 1],
            ["Vertical crop", y, setY, -100, 100, 1],
          ].map(([label, value, setter, min, max, step]) => (
            <label key={String(label)} className="st-field">
              {String(label)}
              <input
                className="form-range"
                aria-label={String(label)}
                type="range"
                min={Number(min)}
                max={Number(max)}
                step={Number(step)}
                value={Number(value)}
                disabled={!image}
                onChange={(e) =>
                  (setter as (v: number) => void)(Number(e.target.value))
                }
              />
            </label>
          ))}
          <p className="st-muted">
            Square 256 × 256 JPEG output. Only the cropped preview is kept in
            local workspace state; the original image is not uploaded.
          </p>
        </div>
      </div>
      {error && (
        <p className="text-loss" role="alert">
          {error}
        </p>
      )}
      <button
        className="st-btn st-primary"
        disabled={!image || !!error}
        onClick={() => {
          const url = canvas.current?.toDataURL("image/jpeg", 0.85);
          if (url) onApply(url);
        }}
      >
        Apply cropped avatar locally
      </button>
    </div>
  );
}
