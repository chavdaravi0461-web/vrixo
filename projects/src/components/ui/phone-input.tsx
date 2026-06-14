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
          "relative flex h-12 w-full items-center rounded-none border border-[var(--dc-border)] bg-[var(--dc-surface)] text-sm shadow-sm transition focus-within:border-white focus-within:ring-4 focus-within:ring-white/20",
          error && "border-red-500/50 focus-within:border-red-500 focus-within:ring-red-500/20",
          className
        )}
      >
        <span
          className={cn(
            "pointer-events-none select-none pl-4 text-sm font-medium",
            focused || value.length > 0 ? "text-[var(--dc-text)]" : "text-[var(--dc-muted)]"
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
          className="h-full min-w-0 flex-1 bg-transparent px-2 text-sm text-[var(--dc-text)] outline-none placeholder:text-[var(--dc-muted)]"
          {...props}
        />
      </div>
    );
  }
);

PhoneInput.displayName = "PhoneInput";
