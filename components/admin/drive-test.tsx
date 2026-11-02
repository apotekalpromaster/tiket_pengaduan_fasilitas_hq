'use client';
import { useActionState } from 'react';
import { Button, Callout } from '../ui';
import { testDrive, type DriveTestState } from '@/app/admin/(panel)/master/actions';

export function DriveTest() {
  const [state, run, pending] = useActionState<DriveTestState>(testDrive, {});
  return (
    <form action={run} className="flex flex-col gap-2">
      <Button type="submit" variant="secondary" size="sm" loading={pending} className="self-start">Tes koneksi Google Drive</Button>
      {state.ok && (
        <Callout tone="emerald">{state.ok}{state.folderUrl && <> Folder foto: <a className="font-semibold text-brand-text underline" href={state.folderUrl} target="_blank" rel="noreferrer">Tiket Fasilitas HQ</a></>}</Callout>
      )}
      {state.error && <Callout tone="red">{state.error}</Callout>}
    </form>
  );
}
