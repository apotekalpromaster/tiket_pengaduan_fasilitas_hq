/**
 * Tiket Fasilitas HQ — jembatan Google Drive
 *
 * Skrip ini menyimpan foto laporan ke Google Drive akun yang men-deploy-nya
 * (apotekalpro.master@gmail.com), di folder "Tiket Fasilitas HQ/<YYMM>/".
 * Panduan pemasangan: docs/PANDUAN_GOOGLE.md
 *
 * WAJIB: ganti nilai SECRET di bawah dengan kata sandi acak yang panjang,
 * lalu isi nilai yang SAMA PERSIS ke DRIVE_SCRIPT_SECRET di Vercel.
 */
var SECRET = 'GANTI-DENGAN-KATA-SANDI-ACAK-MINIMAL-32-KARAKTER';

var ROOT_NAME = 'Tiket Fasilitas HQ';
var ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];
var MAX_BYTES = 5 * 1024 * 1024;

/** Cek cepat lewat browser: buka URL Web App, harus tampil teks ini. */
function doGet() {
  return ContentService.createTextOutput('Tiket Fasilitas HQ Drive aktif');
}

function doPost(e) {
  try {
    var req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (SECRET.indexOf('GANTI-DENGAN') === 0) return reply({ ok: false, error: 'SECRET_BELUM_DIGANTI' });
    if (!req.secret || req.secret !== SECRET) return reply({ ok: false, error: 'AUTH' });

    if (req.action === 'ping') {
      return reply({ ok: true, folderUrl: rootFolder().getUrl(), account: Session.getEffectiveUser().getEmail() });
    }

    if (req.action === 'upload') {
      if (ALLOWED_MIME.indexOf(req.mime) < 0) return reply({ ok: false, error: 'MIME' });
      if (!/^\d{4}$/.test(String(req.yymm))) return reply({ ok: false, error: 'YYMM' });
      var bytes = Utilities.base64Decode(String(req.data || ''));
      if (!bytes.length || bytes.length > MAX_BYTES) return reply({ ok: false, error: 'SIZE' });
      var name = String(req.name || 'foto.jpg').replace(/[^\w.\-]/g, '_').slice(0, 120);
      var file = monthFolder(String(req.yymm)).createFile(Utilities.newBlob(bytes, req.mime, name));
      return reply({ ok: true, id: file.getId() });
    }

    if (req.action === 'get') {
      var id = String(req.id || '');
      if (!/^[\w-]{10,200}$/.test(id)) return reply({ ok: false, error: 'ID' });
      var f;
      try { f = DriveApp.getFileById(id); } catch (err) { return reply({ ok: false, error: 'NOT_FOUND' }); }
      if (!insideRoot(f)) return reply({ ok: false, error: 'FORBIDDEN' });
      return reply({ ok: true, mime: f.getMimeType(), data: Utilities.base64Encode(f.getBlob().getBytes()) });
    }

    return reply({ ok: false, error: 'ACTION' });
  } catch (err) {
    return reply({ ok: false, error: 'SCRIPT', message: String(err && err.message || err) });
  }
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** Folder root aplikasi; dibuat otomatis sekali, ID-nya disimpan di Script Properties. */
function rootFolder() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('ROOT_FOLDER_ID');
  if (id) {
    try {
      var existing = DriveApp.getFolderById(id);
      if (!existing.isTrashed()) return existing;
    } catch (err) { /* folder terhapus: buat ulang */ }
  }
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    id = props.getProperty('ROOT_FOLDER_ID');
    if (id) {
      try { var again = DriveApp.getFolderById(id); if (!again.isTrashed()) return again; } catch (err) { /* buat ulang */ }
    }
    var folder = DriveApp.getRootFolder().createFolder(ROOT_NAME);
    props.setProperty('ROOT_FOLDER_ID', folder.getId());
    return folder;
  } finally {
    lock.releaseLock();
  }
}

/** Subfolder per bulan (mis. "2611"), dibuat sekali walau ada unggahan bersamaan. */
function monthFolder(yymm) {
  var root = rootFolder();
  var it = root.getFoldersByName(yymm);
  if (it.hasNext()) return it.next();
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    it = root.getFoldersByName(yymm);
    return it.hasNext() ? it.next() : root.createFolder(yymm);
  } finally {
    lock.releaseLock();
  }
}

/** true bila file berada di folder bulan di bawah folder root aplikasi. */
function insideRoot(file) {
  var rootId = rootFolder().getId();
  var parents = file.getParents();
  while (parents.hasNext()) {
    var p = parents.next();
    if (p.getId() === rootId) return true;
    var grand = p.getParents();
    while (grand.hasNext()) if (grand.next().getId() === rootId) return true;
  }
  return false;
}
