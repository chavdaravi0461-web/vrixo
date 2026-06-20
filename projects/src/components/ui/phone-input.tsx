"use client";

import { cn } from "@/lib/utils";
import { forwardRef, useState, useCallback } from "react";
import type { InputHTMLAttributes } from "react";

type PhoneInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> & {
  value?: string;
  onChange?: (value: string) => void;
  error?: string;
};

export const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ className, value = "", onChange, onBlur, error, ...props }, ref) => {
    const [focused, setFocused] = useState(false);

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        let raw = e.target.value;

        const digitsOnly = raw.replace(/\D/g, "");

        const cleaned = digitsOnly.replace(/^(?:\+?91|0)/, "").slice(0, 10);

        onChange?.(cleaned);
      },
      [onChange]
    );

    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Backspace" && value.length === 0) {
        e.preventDefault();
      }
    }, [value]);

    return (
      <div
        className={cn(
          "relative flex h-12 w-full items-center rounded-[var(--radius-sm)] border border-[var(--border)] bg-[rgba(255,255,255,.035)] text-sm shadow-[inset_0_1px_0_rgba(255,255,255,.04)] transition-[border-color,background,box-shadow,color] duration-300 ease-[cubic-bezier(.2,.8,.2,1)] hover:border-[var(--border-strong)] focus-within:border-[var(--accent)] focus-within:bg-[rgba(255,255,255,.055)] focus-within:ring-4 focus-within:ring-[var(--accent-ring)]",
          error && "border-[var(--danger)] focus-within:border-[var(--danger)] focus-within:ring-[rgba(251,113,133,.2)]",
          className
        )}
      >
        <span
          className={cn(
            "pointer-events-none select-none pl-4 text-sm font-medium",
            focused || value.length > 0 ? "text-[var(--text)]" : "text-[var(--text-muted)]"
          )}
        >
          +91
        </span>
        <input
          ref={ref}
          type="tel"
          inputMode="numeric"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={(e) => { setFocused(true); onBlur?.(e); }}
          onBlur={(e) => { setFocused(false); onBlur?.(e); }}
          maxLength={10}
          placeholder="Enter 10-digit number"
          className="h-full min-w-0 flex-1 bg-transparent px-2 text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-muted)]"
          {...props}
        />
      </div>
    );
  }
);

PhoneInput.displayName = "PhoneInput";
