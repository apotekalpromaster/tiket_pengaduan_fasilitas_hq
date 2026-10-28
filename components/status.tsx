import { Chip } from './ui';
import { STATUS_TONE, statusText } from '@/lib/labels';
import type { Status } from '@/lib/types';

export function StatusChip({ t }: { t: { status: Status; wait_reason: 'approval' | 'part' | null } }) {
  return <Chip tone={STATUS_TONE[t.status]}>{statusText(t)}</Chip>;
}
