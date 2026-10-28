'use client';
import { useActionState } from 'react';
import { LogIn } from 'lucide-react';
import { Button, Callout, Field, Input } from '@/components/ui';
import { signIn, type LoginState } from './actions';

export function LoginForm({ next, notice }: { next: string; notice?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(signIn, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      {notice && <Callout tone="amber">{notice}</Callout>}
      {state.error && <Callout tone="red">{state.error}</Callout>}
      <input type="hidden" name="ke" value={next} />
      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="username" required defaultValue={state.email} inputMode="email" />
      </Field>
      <Field label="Password" htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      <Button type="submit" block loading={pending}><LogIn className="size-4" aria-hidden />Masuk</Button>
    </form>
  );
}
