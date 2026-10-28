import ExcelJS from 'exceljs';
import { currentAdmin } from '@/lib/auth';
import { getRefData, workConfig } from '@/lib/data';
import { monthRange, stats } from '@/lib/queries';
import { workHoursBetween } from '@/lib/workhours';
import { STATUS_LABEL } from '@/lib/labels';
import { fail, handleError } from '@/lib/http';

export const runtime = 'nodejs';

const wib = (s: string | null) => (s ? new Date(Date.parse(s) + 7 * 3600_000) : null);

export async function GET(req: Request) {
  try {
    const admin = await currentAdmin();
    if (!admin || !admin.aktif) return fail(401, 'AUTH', 'Silakan masuk sebagai admin.');
    const u = new URL(req.url);
    const ref = await getRefData();
    const { from, to, key } = monthRange(u.searchParams.get('bulan') ?? '');
    const team = ref.teams.find(t => t.kode === u.searchParams.get('tim'));
    const { tickets } = await stats(from, to, team?.id ?? (admin.role === 'admin' ? admin.team_id : null));
    const work = await workConfig();

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Tiket Fasilitas HQ';
    const ws = wb.addWorksheet(`Tiket ${key}`);
    ws.columns = [
      { header: 'Kode', key: 'code', width: 16 }, { header: 'Dibuat (WIB)', key: 'created', width: 18, style: { numFmt: 'dd/mm/yyyy hh:mm' } },
      { header: 'Lantai', key: 'lantai', width: 8 }, { header: 'Lokasi', key: 'lokasi', width: 24 }, { header: 'Kategori', key: 'kategori', width: 18 },
      { header: 'Jenis', key: 'jenis', width: 12 }, { header: 'Masalah', key: 'issue', width: 26 }, { header: 'Deskripsi', key: 'desc', width: 40 },
      { header: 'Tim', key: 'tim', width: 14 }, { header: 'Status', key: 'status', width: 13 }, { header: 'Pelapor', key: 'pelapor', width: 20 },
      { header: 'Divisi', key: 'divisi', width: 16 }, { header: 'Pelaksana', key: 'pelaksana', width: 22 }, { header: 'Internal/Vendor', key: 'exec', width: 14 },
      { header: 'Jadwal (WIB)', key: 'jadwal', width: 18, style: { numFmt: 'dd/mm/yyyy hh:mm' } }, { header: 'Selesai (WIB)', key: 'selesai', width: 18, style: { numFmt: 'dd/mm/yyyy hh:mm' } },
      { header: 'Respon (jam kerja)', key: 'respon', width: 12, style: { numFmt: '0.0' } }, { header: 'Penyelesaian (jam kerja)', key: 'resolve', width: 14, style: { numFmt: '0.0' } },
      { header: 'Estimasi biaya', key: 'est', width: 14, style: { numFmt: '#,##0' } }, { header: 'Biaya aktual', key: 'act', width: 14, style: { numFmt: '#,##0' } },
      { header: 'Approval', key: 'approval', width: 12 }, { header: 'Rating', key: 'rating', width: 8 }, { header: 'Laporan serupa', key: 'metoo', width: 10 },
    ];
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEDD5' } };
    ws.views = [{ state: 'frozen', ySplit: 1 }];
    for (const t of tickets) {
      ws.addRow({
        code: t.code, created: wib(t.created_at), lantai: t.location.lantai, lokasi: t.location.nama, kategori: t.category.nama, jenis: t.jenis,
        issue: t.issue ?? '', desc: t.description ?? '', tim: t.team.nama, status: STATUS_LABEL[t.status], pelapor: t.reporter_name, divisi: t.reporter_division ?? '',
        pelaksana: t.exec_type === 'vendor' ? t.vendor_name : t.assignee_name, exec: t.exec_type === 'vendor' ? 'Vendor' : 'Internal',
        jadwal: wib(t.schedule_at), selesai: wib(t.done_at),
        respon: t.accepted_at ? workHoursBetween(Date.parse(t.created_at), Date.parse(t.accepted_at), work) : null,
        resolve: t.done_at ? workHoursBetween(Date.parse(t.created_at), Date.parse(t.done_at), work) : null,
        est: t.cost_estimate || null, act: t.cost_actual, approval: t.approval_status ?? '', rating: t.rating, metoo: t.me_too_count || null,
      });
    }
    ws.autoFilter = { from: 'A1', to: 'W1' };
    const buf = await wb.xlsx.writeBuffer();
    return new Response(buf as ArrayBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="tiket-fasilitas-${key}${team ? '-' + team.kode : ''}.xlsx"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    return handleError(e);
  }
}
