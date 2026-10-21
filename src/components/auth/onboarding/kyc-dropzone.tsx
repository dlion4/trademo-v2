"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";

import { Icon, type IconName } from "@/components/icons";
import { cn } from "@/lib/cn";
import { useKycUpload } from "@/lib/queries/use-auth";

interface KycDropzoneProps {
  slot: string;
  label: string;
  hint: string;
  icon?: IconName;
  accept?: string;
  capture?: "user" | "environment";
  value: string;
  invalid?: boolean;
  onUploaded: (url: string) => void;
}

/**
 * Drag & drop / click / camera-capture uploader.
 * Uses POST /api/kyc/upload (mock presign). Progress is simulated while the
 * request is in-flight — swap for XHR upload progress against S3 later.
 */
export function KycDropzone({ slot, label, hint, icon = "upload", accept = "image/*,application/pdf", capture, value, invalid, onUploaded }: KycDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useKycUpload();
  const [drag, setDrag] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!upload.isPending) return;
    const t = window.setInterval(() => setProgress((p) => Math.min(92, p + Math.random() * 18)), 120);
    return () => window.clearInterval(t);
  }, [upload.isPending]);

  const handle = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) return setError("Max file size is 10 MB.");
    setError(null);
    setFileName(file.name);
    setProgress(6);
    try {
      const res = await upload.mutateAsync({ file, slot });
      setProgress(100);
      onUploaded(res.url);
    } catch (e) {
      setProgress(0);
      setError(e instanceof Error ? e.message : "Upload failed.");
    }
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDrag(false);
    void handle(e.dataTransfer.files?.[0]);
  };

  const uploaded = Boolean(value) && !upload.isPending;

  return (
    <div
      className={cn("kyc-drop", drag && "is-drag", uploaded && "is-done", (invalid || error) && "is-invalid")}
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={onDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        capture={capture}
        className="visually-hidden"
        aria-label={label}
        onChange={(e) => void handle(e.target.files?.[0])}
      />
      <span className="kyc-drop__icon">
        <Icon name={uploaded ? "check" : icon} size={18} />
      </span>
      <div className="kyc-drop__body">
        <strong>{label}</strong>
        {upload.isPending || (fileName && progress > 0 && progress < 100) ? (
          <>
            <span className="kyc-drop__file mono">{fileName}</span>
            <span className="kyc-drop__progress">
              <span style={{ width: `${progress}%` }} />
            </span>
          </>
        ) : uploaded ? (
          <span className="kyc-drop__file mono">{fileName ?? value.split("/").pop()}</span>
        ) : (
          <span className="kyc-drop__hint">{error ?? hint}</span>
        )}
      </div>
      <button type="button" className="btn-ghost btn-ghost--sm" onClick={() => inputRef.current?.click()} disabled={upload.isPending}>
        {uploaded ? "Replace" : capture ? "Capture" : "Browse"}
      </button>
    </div>
  );
}
