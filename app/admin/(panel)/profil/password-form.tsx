'use client';
import { useActionState } from 'react';
import { Button, Callout, Field, Input } from '@/components/ui';
import { changePassword, type PwState } from './actions';

export function PasswordForm() {
  const [state, action, pending] = useActionState<PwState, FormData>(changePassword, {});
  return (
    <form action={action} className="flex max-w-sm flex-col gap-3">
      {state.error && <Callout tone="red">{state.error}</Callout>}
      {state.ok && <Callout tone="emerald">{state.ok}</Callout>}
      <Field label="Password baru" htmlFor="pw" hint="Minimal 10 karakter."><Input id="pw" name="password" type="password" autoComplete="new-password" required minLength={10} /></Field>
      <Field label="Ulangi password" htmlFor="pw2"><Input id="pw2" name="password2" type="password" autoComplete="new-password" required minLength={10} /></Field>
      <Button type="submit" loading={pending} className="self-start">Ganti password</Button>
    </form>
  );
}
