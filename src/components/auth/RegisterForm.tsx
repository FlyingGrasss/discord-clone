"use client";

import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
} from "@shared/constants";
import { USERNAME_PATTERN } from "@shared/validation";
import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { navigateToNext, register } from "@/lib/auth";
import { describeAuthError } from "./form-error";

type FieldName = "username" | "password" | "email";

export interface RegisterFormProps {
  next?: string | null;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

export function RegisterForm({ next }: RegisterFormProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const usernameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  function focusField(field: FieldName | undefined): void {
    if (field === "username") usernameRef.current?.focus();
    if (field === "password") passwordRef.current?.focus();
    if (field === "email") emailRef.current?.focus();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (pending) return;

    setErrors({});
    setFormError(null);

    const normalizedUsername = username.normalize("NFC").trim();
    const trimmedEmail = email.trim();
    const clientErrors: Partial<Record<FieldName, string>> = {};

    if (
      normalizedUsername.length < USERNAME_MIN_LENGTH ||
      normalizedUsername.length > USERNAME_MAX_LENGTH
    ) {
      clientErrors.username = `Kullanıcı adı ${USERNAME_MIN_LENGTH}–${USERNAME_MAX_LENGTH} karakter olmalı.`;
    } else if (!USERNAME_PATTERN.test(normalizedUsername)) {
      clientErrors.username =
        "Kullanıcı adı yalnızca harf, rakam ve alt çizgi içerebilir.";
    }

    if (password.length < PASSWORD_MIN_LENGTH) {
      clientErrors.password = `Şifre en az ${PASSWORD_MIN_LENGTH} karakter olmalı.`;
    } else if (password.length > PASSWORD_MAX_LENGTH) {
      clientErrors.password = `Şifre en fazla ${PASSWORD_MAX_LENGTH} karakter olabilir.`;
    }

    if (trimmedEmail && !EMAIL_PATTERN.test(trimmedEmail)) {
      clientErrors.email = "Geçerli bir e-posta adresi gir.";
    }

    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors);
      focusField(
        clientErrors.username ? "username" : clientErrors.password ? "password" : "email",
      );
      return;
    }

    setPending(true);
    try {
      await register({
        username: normalizedUsername,
        password,
        email: trimmedEmail || undefined,
      });
      navigateToNext(next);
    } catch (error) {
      const failure = describeAuthError(error);
      if (
        failure.field === "username" ||
        failure.field === "password" ||
        failure.field === "email"
      ) {
        setErrors({ [failure.field]: failure.message });
        focusField(failure.field);
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
        autoComplete="username"
        error={errors.username}
        hint="3–20 karakter; harf, rakam ve alt çizgi."
        id="register-username"
        label="Kullanıcı adı"
        name="username"
        onChange={(event) => setUsername(event.target.value)}
        ref={usernameRef}
        required
        spellCheck={false}
        value={username}
      />

      <Input
        autoComplete="new-password"
        endAdornment={
          <button
            aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
            aria-pressed={showPassword}
            className="rounded-md px-2 py-1 text-xs font-medium text-[color:var(--muted)] hover:bg-[color:var(--elevated)] hover:text-[color:var(--text)]"
            onClick={() => setShowPassword((value) => !value)}
            type="button"
          >
            {showPassword ? "Gizle" : "Göster"}
          </button>
        }
        error={errors.password}
        hint="En az 8 karakter."
        id="register-password"
        label="Şifre"
        name="password"
        onChange={(event) => setPassword(event.target.value)}
        ref={passwordRef}
        required
        type={showPassword ? "text" : "password"}
        value={password}
      />

      <Input
        autoComplete="email"
        error={errors.email}
        hint="İsteğe bağlı. Doğrulama e-postası göndermiyoruz."
        id="register-email"
        inputMode="email"
        label="E-posta (isteğe bağlı)"
        name="email"
        onChange={(event) => setEmail(event.target.value)}
        ref={emailRef}
        type="email"
        value={email}
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
        Hesap oluştur
      </Button>
    </form>
  );
}
