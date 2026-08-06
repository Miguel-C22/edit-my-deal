import { useEffect, useState, type FormEvent, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const APP_PIN = "8068";
const STORAGE_KEY = "pin_gate_unlocked";

export function PinGate({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(false);
  const [checkedStorage, setCheckedStorage] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    if (window.localStorage.getItem(STORAGE_KEY) === "true") {
      setUnlocked(true);
    }
    setCheckedStorage(true);
  }, []);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (pin === APP_PIN) {
      window.localStorage.setItem(STORAGE_KEY, "true");
      setUnlocked(true);
      setError(false);
    } else {
      setError(true);
      setPin("");
    }
  };

  if (unlocked) return <>{children}</>;

  if (!checkedStorage) return null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-xl border border-border bg-card p-6 text-center shadow-sm"
      >
        <h1 className="text-lg font-semibold text-foreground">Enter PIN</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          This app is locked. Enter the PIN to continue.
        </p>
        <Input
          type="password"
          inputMode="numeric"
          autoFocus
          value={pin}
          onChange={(e) => {
            setPin(e.target.value);
            setError(false);
          }}
          className="mt-4 text-center tracking-[0.5em]"
          maxLength={4}
          placeholder="••••"
        />
        {error && <p className="mt-2 text-sm text-destructive">Incorrect PIN. Try again.</p>}
        <Button type="submit" className="mt-4 w-full">
          Unlock
        </Button>
      </form>
    </div>
  );
}
