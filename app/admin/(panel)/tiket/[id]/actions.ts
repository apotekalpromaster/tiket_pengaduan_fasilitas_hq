'use server';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/supabase/admin';
import { getRefData } from '@/lib/data';
import { runAction, savePhotos, type UploadFile } from '@/lib/tickets';
import { resend } from '@/lib/notify';
import { FlowError, type Action } from '@/lib/flow';
import { fromWibInput } from '@/lib/format';
import { MAX_PHOTO_BYTES, PHOTO_TYPES } from '@/lib/validation';

export type ActionState = { ok?: string; error?: string; at?: number };

const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim();

export async function ticketAction(ticketId: string, _: ActionState, form: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const op = str(form, 'op');
  try {
    let action: Action;
    switch (op) {
      case 'accept': {
        const who = str(form, 'assignee');
        const tech = who.startsWith('admin:') ? who.slice(6) : null;
        const name = tech ? (await db().from('admins').select('nama').eq('id', tech).maybeSingle()).data?.nama ?? null : who || null;
        action = { type: 'accept', assigneeName: name, assigneeAdminId: tech };
        break;
      }
      case 'reassign': {
        const ref = await getRefData();
        const team = ref.teams.find(t => t.id === str(form, 'team'));
        if (!team) return { error: 'Pilih tim tujuan.' };
        action = { type: 'reassign', teamId: team.id, teamName: team.nama };
        break;
      }
      case 'reject': action = { type: 'reject', reason: str(form, 'reason') }; break;
      case 'duplicate': {
        const pid = str(form, 'parent');
        const { data: p } = await db().from('tickets').select('id, code').eq('id', pid).maybeSingle();
        if (!p) return { error: 'Pilih tiket induk.' };
        action = { type: 'duplicate', parentId: p.id, parentCode: p.code };
        break;
      }
      case 'schedule': {
        const at = fromWibInput(str(form, 'when'));
        if (!at) return { error: 'Isi waktu jadwal.' };
        const exec = str(form, 'exec') === 'vendor' ? 'vendor' : 'internal';
        const who = str(form, 'assignee');
        const tech = who.startsWith('admin:') ? who.slice(6) : null;
        const name = tech ? (await db().from('admins').select('nama').eq('id', tech).maybeSingle()).data?.nama ?? '' : who === '__lain' ? str(form, 'assignee_other') : who;
        action = { type: 'schedule', at: at.toISOString(), exec, assigneeName: name, assigneeAdminId: tech, vendor: str(form, 'vendor'), cost: Number(str(form, 'cost').replace(/\D/g, '') || 0) };
        break;
      }
      case 'approve': action = { type: 'approve' }; break;
      case 'deny': action = { type: 'deny', note: str(form, 'note') }; break;
      case 'start': action = { type: 'start' }; break;
      case 'hold': action = { type: 'hold', note: str(form, 'note') }; break;
      case 'resume': action = { type: 'resume' }; break;
      case 'finish': {
        const files: UploadFile[] = [];
        for (const f of form.getAll('foto').slice(0, 3)) {
          if (!(f instanceof File) || !f.size) continue;
          if (!PHOTO_TYPES.includes(f.type) || f.size > MAX_PHOTO_BYTES) return { error: 'Foto harus JPG/PNG/WEBP maksimal 1 MB.' };
          files.push({ data: Buffer.from(await f.arrayBuffer()), mime: f.type, size: f.size });
        }
        const { count } = await db().from('ticket_photos').select('id', { count: 'exact', head: true }).eq('ticket_id', ticketId).eq('fase', 'after');
        const { data: t } = await db().from('tickets').select('id, code, status').eq('id', ticketId).maybeSingle();
        if (!t) return { error: 'Tiket tidak ditemukan.' };
        if (t.status !== 'DIKERJAKAN') return { error: 'Tiket tidak sedang dikerjakan.' };
        if (files.length) await savePhotos(t, files, 'after');
        const cost = str(form, 'cost');
        action = { type: 'finish', note: str(form, 'note'), hasAfterPhoto: (count ?? 0) > 0 || files.length > 0, costActual: cost ? Number(cost.replace(/\D/g, '')) : null };
        break;
      }
      default: return { error: 'Aksi tidak dikenali.' };
    }
    const r = await runAction(ticketId, action, { type: 'admin', admin, via: 'panel' });
    revalidatePath(`/admin/tiket/${ticketId}`);
    return { ok: r.label ? `Status: ${r.label}` : 'Tersimpan', at: Date.now() };
  } catch (e) {
    if (e instanceof FlowError) return { error: e.message, at: Date.now() };
    console.error(e);
    return { error: 'Gagal menyimpan. Coba lagi.', at: Date.now() };
  }
}

export async function resendAction(notificationId: string, ticketId: string): Promise<ActionState> {
  const admin = await requireAdmin();
  if (admin.role === 'teknisi') return { error: 'Tidak punya akses.' };
  try { await resend(notificationId); } catch (e) { return { error: (e as Error).message }; }
  revalidatePath(`/admin/tiket/${ticketId}`);
  return { ok: 'Dikirim ulang' };
}
