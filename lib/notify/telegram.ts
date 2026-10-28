import 'server-only';
import { env } from '../env';
import type { TgButton } from './templates';

const api = (method: string) => `https://api.telegram.org/bot${env.telegram.token}/${method}`;

async function call<T = unknown>(method: string, body: Record<string, unknown>): Promise<T> {
  const r = await fetch(api(method), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = (await r.json().catch(() => ({}))) as { ok?: boolean; description?: string; result?: T };
  if (!r.ok || !j.ok) throw new Error(`TELEGRAM: ${method} gagal (${j.description ?? r.status})`);
  return j.result as T;
}

const keyboard = (buttons: TgButton[][]) =>
  buttons.length ? { inline_keyboard: buttons.map(row => row.map(b => (b.url ? { text: b.text, url: b.url } : { text: b.text, callback_data: b.data }))) } : undefined;

export function sendMessage(chatId: string, text: string, buttons: TgButton[][] = []) {
  return call('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true, reply_markup: keyboard(buttons) });
}

export function answerCallback(id: string, text: string, alert = false) {
  return call('answerCallbackQuery', { callback_query_id: id, text, show_alert: alert });
}

export function clearButtons(chatId: number | string, messageId: number, keep: TgButton[][] = []) {
  return call('editMessageReplyMarkup', { chat_id: chatId, message_id: messageId, reply_markup: keyboard(keep) ?? { inline_keyboard: [] } });
}
