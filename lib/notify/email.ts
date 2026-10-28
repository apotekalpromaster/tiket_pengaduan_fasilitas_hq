import 'server-only';
import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../env';
import type { EmailMsg } from './templates';

let transport: Transporter | null = null;

export async function sendEmail(m: EmailMsg) {
  if (!transport) {
    transport = nodemailer.createTransport({
      host: env.smtp.host, port: env.smtp.port, secure: env.smtp.port === 465,
      auth: { user: env.smtp.user, pass: env.smtp.pass },
    });
  }
  await transport.sendMail({ from: env.smtp.from, to: m.to.join(', '), subject: m.subject, html: m.html, text: m.text });
}
