"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, ExternalLink, ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { getImageUploadSignature } from "@/server/actions/upload.actions";
import { cn } from "@/lib/utils";
import { controlCls } from "@/components/ui/styles";

/* ──────────────────────────────────────────────────────────────────────────
 * Images live inside ordinary text as markdown: ![name](https://res.cloudinary.com/…)
 * so any text field can carry screenshots without schema changes.
 * Only Cloudinary-hosted images are rendered as pictures; anything else stays text.
 * ────────────────────────────────────────────────────────────────────────── */

const MAX_BYTES = 10 * 1024 * 1024;
const IMAGE_RE = /!\[([^\]\n]{0,120})\]\((https:\/\/res\.cloudinary\.com\/[A-Za-z0-9_-]+\/image\/upload\/[^\s)]+)\)/g;

/** Cloudinary delivery URL with a transformation inserted (thumbnails / auto format). */
function withTransform(url: string, t: string) {
  return url.replace("/image/upload/", `/image/upload/${t}/`);
}
const thumbUrl = (u: string) => withTransform(u, "c_limit,w_720,h_540,q_auto,f_auto");
const fullUrl = (u: string) => withTransform(u, "q_auto,f_auto");

/** Upload one image file straight to Cloudinary; returns its secure URL. */
export async function uploadImage(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Only images can be attached");
  if (file.size > MAX_BYTES) throw new Error("Images must be under 10 MB");
  const sig = await getImageUploadSignature();
  if (!sig.success) throw new Error(sig.error);
  const { cloudName, apiKey, timestamp, signature, folder, allowedFormats } = sig.data;
  const body = new FormData();
  body.append("file", file);
  body.append("api_key", apiKey);
  body.append("timestamp", String(timestamp));
  body.append("signature", signature);
  body.append("folder", folder);
  body.append("allowed_formats", allowedFormats);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: "POST", body });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.secure_url) throw new Error(json?.error?.message ?? "Upload failed — please try again");
  return json.secure_url as string;
}

function imageFiles(list: FileList | DataTransferItemList | null | undefined): File[] {
  if (!list) return [];
  const out: File[] = [];
  for (let i = 0; i < list.length; i++) {
    const it = list[i] as DataTransferItem | File;
    const f = "getAsFile" in it ? (it.kind === "file" ? it.getAsFile() : null) : it;
    if (f && f.type.startsWith("image/")) out.push(f);
  }
  return out;
}

// ── Text box that accepts pasted / dropped / picked images ──────────────────

export function ImageTextarea({
  value,
  onValueChange,
  className,
  placeholder,
  maxLength,
  disabled,
  autoFocus,
  minHeight = 80,
  bare,
  onKeyDown,
  "aria-label": ariaLabel,
}: {
  value: string;
  onValueChange: (v: string) => void;
  className?: string;
  placeholder?: string;
  maxLength?: number;
  disabled?: boolean;
  autoFocus?: boolean;
  minHeight?: number;
  /** Render without the control border (when the parent draws its own frame). */
  bare?: boolean;
  onKeyDown?: React.KeyboardEventHandler<HTMLTextAreaElement>;
  "aria-label"?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const valueRef = useRef(value);
  valueRef.current = value;
  const [uploading, setUploading] = useState(0);
  const [dragOver, setDragOver] = useState(false);

  const insertAtCursor = useCallback(
    (snippet: string) => {
      const el = ref.current;
      const cur = valueRef.current;
      const start = el ? el.selectionStart : cur.length;
      const end = el ? el.selectionEnd : cur.length;
      const before = cur.slice(0, start);
      const after = cur.slice(end);
      const pre = before && !before.endsWith("\n") ? "\n" : "";
      const post = after && !after.startsWith("\n") ? "\n" : "";
      const next = before + pre + snippet + post + after;
      if (maxLength && next.length > maxLength) {
        toast.error("Not enough room left in this field for another image");
        return;
      }
      onValueChange(next);
      requestAnimationFrame(() => {
        const pos = (before + pre + snippet + post).length;
        el?.focus();
        el?.setSelectionRange(pos, pos);
      });
    },
    [maxLength, onValueChange]
  );

  const handleFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      setUploading((n) => n + files.length);
      for (const file of files) {
        try {
          const url = await uploadImage(file);
          const name = (file.name && file.name !== "image.png" ? file.name.replace(/\.[a-z0-9]+$/i, "") : "screenshot").replace(/[[\]]/g, "").slice(0, 60);
          insertAtCursor(`![${name}](${url})`);
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Upload failed");
        } finally {
          setUploading((n) => n - 1);
        }
      }
    },
    [insertAtCursor]
  );

  return (
    <div
      className={cn("relative", dragOver && "ring-2 ring-primary/40 rounded-lg")}
      onDragOver={(e) => {
        if (disabled || !Array.from(e.dataTransfer.items).some((i) => i.kind === "file")) return;
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        const files = imageFiles(e.dataTransfer.files);
        setDragOver(false);
        if (files.length === 0 || disabled) return;
        e.preventDefault();
        handleFiles(files);
      }}
    >
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        onPaste={(e) => {
          const files = imageFiles(e.clipboardData?.items);
          if (files.length === 0) return; // normal text paste
          e.preventDefault();
          handleFiles(files);
        }}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        maxLength={maxLength}
        disabled={disabled}
        autoFocus={autoFocus}
        aria-label={ariaLabel}
        style={{ minHeight }}
        className={cn(bare ? "w-full bg-transparent outline-none resize-y text-[13px] placeholder:text-muted-foreground/60" : controlCls, "leading-relaxed resize-y", className)}
      />
      <div className={cn("flex items-center justify-between gap-2 text-[11.5px] text-muted-foreground", bare ? "mt-1" : "mt-1.5")}>
        <span className="truncate">{uploading > 0 ? null : "Paste or drop a screenshot to attach it"}</span>
        {uploading > 0 ? (
          <span className="inline-flex items-center gap-1.5 text-foreground">
            <Loader2 size={12} className="animate-spin" /> Uploading {uploading > 1 ? `${uploading} images` : "image"}…
          </span>
        ) : (
          <button
            type="button"
            disabled={disabled}
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-1 hover:text-foreground transition-colors disabled:opacity-50 shrink-0"
          >
            <ImagePlus size={13} /> Attach image
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          multiple
          hidden
          onChange={(e) => {
            handleFiles(imageFiles(e.target.files));
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}

// ── Display: text with image thumbnails ─────────────────────────────────────

type Part = { kind: "text"; text: string } | { kind: "image"; url: string; alt: string };

function parse(text: string): Part[] {
  const parts: Part[] = [];
  let last = 0;
  for (const m of text.matchAll(IMAGE_RE)) {
    const i = m.index ?? 0;
    if (i > last) parts.push({ kind: "text", text: text.slice(last, i) });
    parts.push({ kind: "image", alt: m[1] || "image", url: m[2] });
    last = i + m[0].length;
  }
  if (last < text.length) parts.push({ kind: "text", text: text.slice(last) });
  return parts;
}

/** Plain text (whitespace preserved) with attached images shown as clickable thumbnails. */
export function RichText({ text, className }: { text: string | null | undefined; className?: string }) {
  const [open, setOpen] = useState<number | null>(null);
  if (!text) return null;
  const parts = parse(text);
  const images = parts.filter((p): p is Extract<Part, { kind: "image" }> => p.kind === "image");
  if (images.length === 0) return <div className={cn("whitespace-pre-wrap break-words", className)}>{text}</div>;

  // Group consecutive images (ignoring whitespace-only text between them) into one strip.
  const blocks: (Part | Extract<Part, { kind: "image" }>[])[] = [];
  for (const p of parts) {
    if (p.kind === "text" && !p.text.trim() && Array.isArray(blocks[blocks.length - 1])) continue;
    if (p.kind === "image") {
      const prev = blocks[blocks.length - 1];
      if (Array.isArray(prev)) prev.push(p);
      else blocks.push([p]);
    } else blocks.push({ ...p, text: p.text.replace(/^\n+|\n+$/g, "") });
  }

  let imgIndex = 0;
  return (
    <div className={cn("space-y-2.5 break-words", className)}>
      {blocks.map((b, bi) =>
        Array.isArray(b) ? (
          <div key={bi} className="flex flex-wrap gap-2">
            {b.map((img) => {
              const idx = imgIndex++;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setOpen(idx)}
                  className="group relative overflow-hidden rounded-lg border border-surface-border bg-surface-base hover:border-foreground/25 transition-colors focus-visible:outline-none focus-visible:shadow-ring"
                  title={`${img.alt} — click to view full size`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={thumbUrl(img.url)} alt={img.alt} loading="lazy" className="block max-h-56 max-w-full sm:max-w-[360px] object-contain" />
                </button>
              );
            })}
          </div>
        ) : (
          b.kind === "text" && b.text && (
            <Fragment key={bi}>
              <div className="whitespace-pre-wrap">{b.text}</div>
            </Fragment>
          )
        )
      )}
      {open !== null && <Lightbox images={images} index={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

// ── Full-screen viewer ──────────────────────────────────────────────────────

export function Lightbox({ images, index, onClose }: { images: { url: string; alt: string }[]; index: number; onClose: () => void }) {
  const [i, setI] = useState(index);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const count = images.length;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault(); // don't also close a sheet/dialog behind us
        e.stopPropagation();
        closeRef.current();
      } else if (e.key === "ArrowRight") setI((x) => (x + 1) % count);
      else if (e.key === "ArrowLeft") setI((x) => (x - 1 + count) % count);
    };
    // capture phase so we run before dialog/sheet Escape handlers
    window.addEventListener("keydown", onKey, true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = prev;
    };
  }, [count]);

  const img = images[i];
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[100] bg-black/90 flex flex-col animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-label="Image viewer"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="h-14 shrink-0 px-4 flex items-center justify-between text-white/85 text-[13px] pt-[env(safe-area-inset-top)] box-content">
        <span className="truncate">
          {img.alt}
          {count > 1 && <span className="text-white/50"> · {i + 1} of {count}</span>}
        </span>
        <div className="flex items-center gap-1">
          <a href={img.url} target="_blank" rel="noopener noreferrer" className="h-9 px-3 rounded-lg inline-flex items-center gap-1.5 hover:bg-white/10" title="Open original">
            <ExternalLink size={15} /> <span className="hidden sm:inline">Original</span>
          </a>
          <button type="button" onClick={onClose} className="h-9 w-9 rounded-lg inline-flex items-center justify-center hover:bg-white/10" aria-label="Close (Esc)">
            <X size={18} />
          </button>
        </div>
      </div>
      <div className="relative flex-1 min-h-0 flex items-center justify-center px-2 sm:px-14 pb-6" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={fullUrl(img.url)} alt={img.alt} className="max-h-full max-w-full object-contain rounded-md shadow-2xl select-none" draggable={false} />
        {count > 1 && (
          <>
            <button type="button" onClick={() => setI((x) => (x - 1 + count) % count)} className="absolute left-2 sm:left-4 h-11 w-11 rounded-full bg-white/10 hover:bg-white/20 text-white inline-flex items-center justify-center" aria-label="Previous image">
              <ChevronLeft size={20} />
            </button>
            <button type="button" onClick={() => setI((x) => (x + 1) % count)} className="absolute right-2 sm:right-4 h-11 w-11 rounded-full bg-white/10 hover:bg-white/20 text-white inline-flex items-center justify-center" aria-label="Next image">
              <ChevronRight size={20} />
            </button>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
