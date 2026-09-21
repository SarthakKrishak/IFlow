"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import type { User } from "@prisma/client";
import { splitBodyByMentions } from "@/lib/mentions";

type Member = Pick<User, "id" | "displayName" | "avatarColor"> & {
  username?: string;
  isActive?: boolean;
};

interface MentionInputProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  members: Member[];
  placeholder?: string;
  autoFocus?: boolean;
  submitting?: boolean;
}

function initialsOf(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

/** Textarea with @mention autocomplete (member list + search filter). */
export function MentionInput({
  value,
  onChange,
  onSubmit,
  members,
  placeholder,
  autoFocus,
  submitting,
}: MentionInputProps) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [token, setToken] = useState("");
  const [tokenStart, setTokenStart] = useState<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLButtonElement>(null);

  const activeMembers = useMemo(
    () => members.filter((m) => m.isActive !== false),
    [members]
  );

  const suggestions = useMemo(() => {
    const q = token.toLowerCase();
    return activeMembers
      .filter(
        (m) =>
          (m.username ?? "").toLowerCase().includes(q) ||
          m.displayName.toLowerCase().includes(q)
      )
      .slice(0, 7);
  }, [activeMembers, token]);

  useEffect(() => {
    if (autoFocus) textareaRef.current?.focus();
  }, [autoFocus]);

  useEffect(() => setHighlight(0), [token]);

  // Keep the keyboard-highlighted member visible while arrowing
  useEffect(() => {
    highlightRef.current?.scrollIntoView({ block: "nearest" });
  }, [highlight, open]);

  const updateToken = (text: string, cursor: number) => {
    const before = text.slice(0, cursor);
    const match = before.match(/(^|[\s(>"'])@([a-z0-9_]{0,20})$/i);
    if (match) {
      setToken(match[2]);
      setTokenStart(cursor - match[0].length + match[1].length);
      setOpen(true);
    } else {
      setOpen(false);
      setToken("");
      setTokenStart(null);
    }
  };

  const pick = (m: Member) => {
    if (tokenStart === null) return;
    const username = m.username ?? m.displayName.toLowerCase().replace(/\s+/g, "_");
    const before = value.slice(0, tokenStart);
    const after = value.slice(textareaRef.current?.selectionStart ?? value.length);
    const next = `${before}@${username} ${after}`;
    onChange(next);
    setOpen(false);
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (el) {
        const pos = before.length + username.length + 2;
        el.focus();
        el.setSelectionRange(pos, pos);
      }
    });
  };

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          updateToken(e.target.value, e.target.selectionStart ?? e.target.value.length);
        }}
        onKeyDown={(e) => {
          if (open && suggestions.length > 0) {
            if (e.key === "ArrowDown") { e.preventDefault(); setHighlight((h) => (h + 1) % suggestions.length); return; }
            if (e.key === "ArrowUp") { e.preventDefault(); setHighlight((h) => (h - 1 + suggestions.length) % suggestions.length); return; }
            // Enter/Tab always confirms the highlighted person while the
            // menu is open (even on a bare "@"); Escape dismisses instead.
            if (e.key === "Tab" || e.key === "Enter") {
              e.preventDefault();
              pick(suggestions[highlight] ?? suggestions[0]);
              return;
            }
            if (e.key === "Escape") { setOpen(false); return; }
          }
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            onSubmit();
          }
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        rows={3}
        placeholder={placeholder ?? "Leave a comment… (type @ to mention)"}
        className="w-full px-3 py-2.5 pr-10 rounded-xl text-[13px] text-foreground bg-surface-base border border-surface-border outline-none resize-none placeholder:text-muted-foreground/60 focus:border-primary/60 transition-colors"
        aria-label="Comment body"
        aria-expanded={open}
        aria-autocomplete="list"
      />

      {open && suggestions.length > 0 && (
        <div
          className="absolute left-0 right-0 bottom-full mb-1.5 bg-surface-elevated border border-surface-border rounded-xl shadow-xl overflow-hidden z-30 max-h-56 overflow-y-auto"
          role="listbox"
          aria-label="Mention someone"
        >
          <p className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground sticky top-0 bg-surface-elevated">
            {token ? `Matching “${token}”` : "Team members"}
          </p>
          {suggestions.map((m, i) => (
            <button
              key={m.id}
              ref={i === highlight ? highlightRef : undefined}
              onMouseDown={(e) => { e.preventDefault(); pick(m); }}
              onMouseEnter={() => setHighlight(i)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors border-l-2 ${
                i === highlight ? "bg-primary/15 border-primary" : "border-transparent"
              }`}
              role="option"
              aria-selected={i === highlight}
            >
              <span
                className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                style={{ background: m.avatarColor }}
              >
                {initialsOf(m.displayName)}
              </span>
              <span className="min-w-0">
                <span className="block text-[12.5px] font-semibold text-foreground truncate">{m.displayName}</span>
                <span className="block text-[11px] text-muted-foreground font-mono truncate">@{m.username ?? m.displayName}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      <p className="text-[10.5px] text-muted-foreground/70 mt-1.5 px-0.5">
        Type <span className="font-mono font-bold text-primary">@</span> to tag a teammate — they get a notification.{" "}
        <span className="font-mono">Enter</span> selects, <span className="font-mono">Esc</span> closes, <span className="font-mono">Ctrl+Enter</span> sends.
      </p>
    </div>
  );
}

/** Render a comment body with @mentions highlighted. */
export function MentionBody({ body }: { body: string }) {
  const parts = splitBodyByMentions(body);
  return (
    <p className="text-[13px] text-foreground/90 whitespace-pre-wrap leading-relaxed">
      {parts.map((p, i) =>
        p.isMention ? (
          <span key={i} className="font-semibold text-primary bg-primary/10 px-1 py-px rounded">
            {p.text}
          </span>
        ) : (
          <span key={i}>{p.text}</span>
        )
      )}
    </p>
  );
}
