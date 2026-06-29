import { useEffect, useRef, useState } from "react";

const multipliers: Record<string, number> = {
  k: 1_000,
  m: 1_000_000,
  million: 1_000_000,
  millions: 1_000_000,
  b: 1_000_000_000,
  g: 1_000_000_000,
  md: 1_000_000_000,
  bn: 1_000_000_000,
  t: 1_000_000_000_000
};

export function parseNumericInput(value: string): number | null {
  const normalized = value.trim().toLowerCase().replace(",", ".").replace(/\s+/g, "");
  const match = normalized.match(/^(-?(?:\d+(?:\.\d*)?|\.\d+))([a-z]*)$/);
  if (!match || !(match[2] in multipliers || match[2] === "")) return null;
  const parsed = Number(match[1]) * (multipliers[match[2]] || 1);
  return Number.isFinite(parsed) ? parsed : null;
}

export function NumericInput({
  value,
  min,
  max,
  integer = false,
  disabled,
  ariaLabel,
  onChange
}: {
  value: number;
  min?: number;
  max?: number;
  integer?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  const focused = useRef(false);

  const normalize = (next: number) => {
    const rounded = integer ? Math.round(next) : next;
    return Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min ?? Number.NEGATIVE_INFINITY, rounded));
  };

  useEffect(() => {
    if (!focused.current) setDraft(String(value));
  }, [value]);

  return (
    <input
      type="text"
      inputMode="decimal"
      disabled={disabled}
      aria-label={ariaLabel}
      value={draft}
      onFocus={() => { focused.current = true; }}
      onChange={(event) => {
        const next = event.target.value;
        setDraft(next);
        const parsed = parseNumericInput(next);
        if (parsed !== null) onChange(normalize(parsed));
      }}
      onBlur={() => {
        focused.current = false;
        const parsed = parseNumericInput(draft);
        const next = parsed === null ? value : normalize(parsed);
        setDraft(String(next));
        onChange(next);
      }}
    />
  );
}
