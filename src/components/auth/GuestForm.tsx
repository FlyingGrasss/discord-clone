"use client";

import {
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
} from "@shared/constants";
import { USERNAME_PATTERN } from "@shared/validation";
import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { guest, navigateToNext } from "@/lib/auth";
import { describeAuthError } from "./form-error";

export interface GuestFormProps {
  next?: string | null;
}

export function GuestForm({ next }: GuestFormProps) {
  const [username, setUsername] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const usernameRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (pending) return;

    setErrors({});
    setFormError(null);

    const normalizedUsername = username.normalize("NFC").trim();
    if (
      normalizedUsername.length < USERNAME_MIN_LENGTH ||
      normalizedUsername.length > USERNAME_MAX_LENGTH
    ) {
      setErrors({
        username: `Takma ad ${USERNAME_MIN_LENGTH}–${USERNAME_MAX_LENGTH} karakter olmalı.`,
      });
      usernameRef.current?.focus();
      return;
    }
    if (!USERNAME_PATTERN.test(normalizedUsername)) {
      setErrors({
        username: "Takma ad yalnızca harf, rakam ve alt çizgi içerebilir.",
      });
      usernameRef.current?.focus();
      return;
    }

    setPending(true);
    try {
      await guest({ username: normalizedUsername });
      navigateToNext(next);
    } catch (error) {
      const failure = describeAuthError(error);
      if (failure.field === "username") {
        setErrors({ username: failure.message });
        usernameRef.current?.focus();
      } else {
        setFormError(failure.message);
      }
      setPending(false);
    }
  }

  return (
    <form className="space-y-4" noValidate onSubmit={handleSubmit}>
      <Input
        autoCapitalize="none"
        autoComplete="nickname"
        error={errors.username}
        hint="3–20 karakter; harf, rakam ve alt çizgi."
        id="guest-username"
        label="Takma ad"
        name="username"
        onChange={(event) => setUsername(event.target.value)}
        ref={usernameRef}
        required
        spellCheck={false}
        value={username}
      />

      {formError ? (
        <p
          className="rounded-lg border border-[color:var(--danger)] bg-[color:var(--danger-soft)] px-3 py-2 text-sm leading-5 text-[color:var(--danger-text)]"
          role="alert"
        >
          {formError}
        </p>
      ) : null}

      <Button className="w-full" loading={pending} type="submit">
        Misafir olarak gir
      </Button>
    </form>
  );
}
