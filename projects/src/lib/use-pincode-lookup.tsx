"use client";

import { useEffect, useMemo, useState } from "react";
import { lookupPincode, PincodeLookupResult } from "./pincode";

type HookState = {
  loading: boolean;
  error?: string | null;
  result?: PincodeLookupResult | null;
  apiAvailable: boolean;
};

export function usePincodeLookup(pin: unknown, options?: { debounceMs?: number }) {
  const debounceMs = options?.debounceMs ?? 350;
  const [state, setState] = useState<HookState>({ loading: false, error: null, result: null, apiAvailable: true });

  const stablePin = useMemo(() => (typeof pin === "string" ? pin.trim() : ""), [pin]);

  useEffect(() => {
    let mounted = true;
    if (!/^[0-9]{6}$/.test(stablePin)) {
      setState({ loading: false, error: stablePin.length === 0 ? null : "Enter a valid 6-digit pincode.", result: null, apiAvailable: state.apiAvailable });
      return;
    }

    setState((s) => ({ ...s, loading: true, error: null }));
    const timer = setTimeout(async () => {
      try {
        const res = await lookupPincode(stablePin);
        if (!mounted) return;
        if (res) {
          setState({ loading: false, error: null, result: res, apiAvailable: true });
        } else {
          setState({ loading: false, error: null, result: null, apiAvailable: false });
        }
      } catch (err) {
        if (!mounted) return;
        setState({ loading: false, error: null, result: null, apiAvailable: false });
      }
    }, debounceMs);

    return () => { mounted = false; clearTimeout(timer); };
  }, [stablePin, debounceMs]);

  return state;
}
