/* Studio Kustomisasi Mecha — editor konfigurasi website.
   Setiap perubahan langsung dikirim ke iframe pratinjau (postMessage)
   dan disimpan otomatis ke localStorage browser ini. */
(function () {
  'use strict';

  var draft = window.MSL.deepMerge(window.MSL_DEFAULT, loadSaved());
  var activeGroup = 'theme';
  var saveTimer = null;
  var pushTimer = null;

  function loadSaved() {
    try {
      var raw = localStorage.getItem(window.MSL.STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function getPath(obj, path) {
    return path.split('.').reduce(function (o, k) { return o == null ? o : o[k]; }, obj);
  }
  function setPath(obj, path, val) {
    var keys = path.split('.');
    var cur = obj;
    for (var i = 0; i < keys.length - 1; i++) cur = cur[keys[i]];
    cur[keys[keys.length - 1]] = val;
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---------- persist & preview ---------- */
  function setStatus(text, busy) {
    var el = document.getElementById('status-text');
    var dot = document.getElementById('status-dot');
    if (el) el.textContent = text;
    if (dot) dot.className = 'status-dot' + (busy ? ' busy' : '');
  }
  function scheduleSave() {
    setStatus('Menyimpan…', true);
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      try {
        localStorage.setItem(window.MSL.STORAGE_KEY, JSON.stringify(draft));
        var t = new Date();
        setStatus('Tersimpan otomatis · ' + String(t.getHours()).padStart(2, '0') + ':' + String(t.getMinutes()).padStart(2, '0'), false);
      } catch (e) {
        setStatus('Gagal menyimpan (kuota penyimpanan penuh?)', true);
      }
    }, 500);
  }
  function pushPreview() {
    clearTimeout(pushTimer);
    pushTimer = setTimeout(function () {
      var frame = document.getElementById('preview-frame');
      if (frame && frame.contentWindow) {
        frame.contentWindow.postMessage({ type: 'msl-config', config: clone(draft) }, '*');
      }
    }, 120);
  }
  function commit() { scheduleSave(); pushPreview(); }

  /* ---------- field builders ---------- */
  function fieldWrap(label, inner) {
    return '<div class="field"><label>' + esc(label) + '</label>' + inner + '</div>';
  }

  function buildField(f) {
    var val = getPath(draft, f.path);
    switch (f.type) {
      case 'text':
        return fieldWrap(f.label, '<input class="input" type="text" data-path="' + f.path + '" data-kind="text" value="' + esc(val) + '" />');
      case 'textarea':
        return fieldWrap(f.label, '<textarea data-path="' + f.path + '" data-kind="text" rows="' + (f.rows || 3) + '">' + esc(val) + '</textarea>');
      case 'number':
        return fieldWrap(f.label, '<input class="input" type="number" min="' + (f.min || 0) + '" max="' + (f.max || 99) + '" data-path="' + f.path + '" data-kind="number" value="' + esc(val) + '" />');
      case 'select':
        var opts = (f.options || []).map(function (o) {
          return '<option value="' + esc(o) + '"' + (o === val ? ' selected' : '') + '>' + esc(o) + '</option>';
        }).join('');
        return fieldWrap(f.label, '<select data-path="' + f.path + '" data-kind="text">' + opts + '</select>');
      case 'color':
        return fieldWrap(f.label,
          '<div class="color-row"><input type="color" data-path="' + f.path + '" data-kind="color" value="' + esc(val) + '" />' +
          '<input class="input" type="text" data-path="' + f.path + '" data-kind="colortext" value="' + esc(val) + '" /></div>');
      case 'coloropt':
        var on = !!val;
        return fieldWrap(f.label,
          '<div class="opt-row"><label class="switch"><input type="checkbox" data-path="' + f.path + '" data-kind="opttoggle"' + (on ? ' checked' : '') + ' /><i></i></label><span>' + esc(f.hint || 'Gunakan warna kustom (atau langsung pilih warna di bawah)') + '</span></div>' +
          '<div class="color-row" data-optfor="' + f.path + '" style="' + (on ? '' : 'opacity:.65;') + '">' +
          '<input type="color" data-path="' + f.path + '" data-kind="color" value="' + esc(on ? val : '#101828') + '" />' +
          '<input class="input" type="text" data-path="' + f.path + '" data-kind="colortext" value="' + esc(on ? val : '') + '" placeholder="Pilih warna / ketik #hex" /></div>');
      case 'toggle':
        return '<div class="field"><div class="toggle-row"><span>' + esc(f.label) + '</span>' +
          '<label class="switch"><input type="checkbox" data-path="' + f.path + '" data-kind="toggle"' + (val === false ? '' : ' checked') + ' /><i></i></label></div></div>';
      case 'image':
        return fieldWrap(f.label,
          '<div class="img-field">' +
          (val ? '<img class="img-thumb" data-thumb="' + f.path + '" src="' + esc(val) + '" alt="" />' : '<div class="img-thumb empty" data-thumb="' + f.path + '">kosong</div>') +
          '<div style="flex:1;min-width:0"><input class="input" type="text" data-path="' + f.path + '" data-kind="text" data-refresh="1" value="' + esc(val) + '" placeholder="URL gambar atau unggah file" />' +
          '<div class="img-actions"><button class="mini" data-upload="' + f.path + '">Unggah Gambar</button>' +
          '<button class="mini danger" data-clearimg="' + f.path + '">Hapus</button></div></div></div>' +
          '<input type="file" accept="image/*" hidden data-filefor="' + f.path + '" />');
      case 'stringlist':
        return fieldWrap(f.label, '<div class="list-wrap" data-list="' + f.path + '" data-itemtype="string"></div>');
      case 'list':
        return fieldWrap(f.label, '<div class="list-wrap" data-list="' + f.path + '" data-itemtype="object"></div>');
      default:
        return '';
    }
  }

  function renderList(container) {
    var path = container.getAttribute('data-list');
    var itemType = container.getAttribute('data-itemtype');
    var spec = findListSpec(path);
    var arr = getPath(draft, path) || [];
    container.innerHTML = arr.map(function (item, i) {
      var title = itemType === 'string' ? item : (item[spec.titleKey] || ('Item ' + (i + 1)));
      var body = itemType === 'string'
        ? '<div class="field"><input class="input" type="text" data-path="' + path + '.' + i + '" data-kind="text" data-refresh="1" value="' + esc(item) + '" /></div>'
        : spec.fields.map(function (sf) {
            var sub = { path: path + '.' + i + '.' + sf.name, label: sf.label, type: sf.type, options: sf.options, rows: sf.rows, hint: sf.hint };
            return buildField(sub);
          }).join('');
      return '<div class="list-item"><div class="list-item-head"><span class="list-item-title">' + (i + 1) + '. ' + esc(title) + '</span>' +
        '<span class="list-ctrl">' +
        '<button class="iconbtn" data-move="' + path + '|' + i + '|-1" title="Naik">↑</button>' +
        '<button class="iconbtn" data-move="' + path + '|' + i + '|1" title="Turun">↓</button>' +
        '<button class="iconbtn danger" data-remove="' + path + '|' + i + '" title="Hapus">✕</button>' +
        '</span></div>' + body + '</div>';
    }).join('') + '<button class="add-btn" data-add="' + path + '">+ Tambah ' + esc(spec.addLabel || 'item') + '</button>';
  }

  function findListSpec(path) {
    var found = null;
    SCHEMA.forEach(function (g) {
      g.fields.forEach(function (f) {
        if (f.path === path) found = f;
      });
    });
    return found || { fields: [], titleKey: 'title' };
  }

  /* ---------- schema ---------- */
  var iconOptions = Object.keys(window.MSL_ICONS);
  var SCHEMA = [
    { id: 'theme', label: 'Tema & Warna', icon: 'bolt', desc: 'Palet warna, font, dan bentuk seluruh website.', fields: [
      { type: 'color', path: 'theme.primary', label: 'Warna Utama' },
      { type: 'color', path: 'theme.primaryDark', label: 'Warna Utama Gelap' },
      { type: 'color', path: 'theme.accent', label: 'Warna Aksen' },
      { type: 'color', path: 'theme.dark', label: 'Warna Gelap (Hero / Footer)' },
      { type: 'color', path: 'theme.bg', label: 'Latar Halaman' },
      { type: 'color', path: 'theme.surface', label: 'Latar Sekunder' },
      { type: 'color', path: 'theme.text', label: 'Warna Teks' },
      { type: 'color', path: 'theme.muted', label: 'Warna Teks Sekunder' },
      { type: 'color', path: 'theme.border', label: 'Warna Garis (Border)' },
      { type: 'number', path: 'theme.radius', label: 'Radius Sudut (px)', min: 0, max: 32 },
      { type: 'toggle', path: 'theme.boxOutline.enabled', label: 'Garis Outline Semua Kotak (on/off)' },
      { type: 'color', path: 'theme.boxOutline.color', label: 'Warna Outline Kotak' },
      { type: 'number', path: 'theme.boxOutline.width', label: 'Tebal Outline Kotak (px)', min: 0, max: 8 },
      { type: 'number', path: 'theme.boxRadius', label: 'Lekukan Sudut Kotak (px — kosong ikuti Radius)', min: 0, max: 40 },
      { type: 'select', path: 'theme.fontHeading', label: 'Font Judul', options: window.MSL_FONTS },
      { type: 'select', path: 'theme.fontBody', label: 'Font Isi', options: window.MSL_FONTS },
      { type: 'toggle', path: 'theme.btnGradient.enabled', label: 'Gradasi Tombol Utama' },
      { type: 'color', path: 'theme.btnGradient.from', label: 'Warna Gradasi Tombol (awal)' },
      { type: 'color', path: 'theme.btnGradient.to', label: 'Warna Gradasi Tombol (akhir)' },
      { type: 'number', path: 'theme.btnGradient.angle', label: 'Sudut Gradasi Tombol (°)', min: 0, max: 360 },
      { type: 'toggle', path: 'theme.cardGradient.enabled', label: 'Gradasi Kartu' },
      { type: 'color', path: 'theme.cardGradient.from', label: 'Warna Gradasi Kartu (awal)' },
      { type: 'color', path: 'theme.cardGradient.to', label: 'Warna Gradasi Kartu (akhir)' },
      { type: 'number', path: 'theme.cardGradient.angle', label: 'Sudut Gradasi Kartu (°)', min: 0, max: 360 },
      { type: 'color', path: 'theme.shadowColor', label: 'Warna Bayangan (Shadow)' },
      { type: 'number', path: 'theme.shadowOpacity', label: 'Intensitas Bayangan (%)', min: 0, max: 100 },
      { type: 'number', path: 'theme.shadowBlur', label: 'Kekaburan Bayangan (px)', min: 0, max: 90 }
    ] },
    { id: 'brand', label: 'Brand & Logo', icon: 'shield', desc: 'Nama perusahaan dan tanda logo.', fields: [
      { type: 'text', path: 'brand.name', label: 'Nama Perusahaan' },
      { type: 'text', path: 'brand.short', label: 'Nama Singkat (di navbar & footer)' },
      { type: 'text', path: 'brand.logoMark', label: 'Inisial Logo (maks. 3 karakter)' },
      { type: 'image', path: 'brand.logoImage', label: 'Gambar Logo (opsional — menggantikan inisial)' },
      { type: 'color', path: 'brand.logoBg', label: 'Warna Latar Logo (awal gradasi)' },
      { type: 'color', path: 'brand.logoBg2', label: 'Warna Latar Logo (akhir gradasi)' }
    ] },
    { id: 'hero', label: 'Hero (Beranda)', icon: 'building', desc: 'Bagian pembuka: judul, tagline, dan daftar layanan.', fields: [
      { type: 'toggle', path: 'hero.visible', label: 'Tampilkan bagian Hero' },
      { type: 'coloropt', path: 'hero.bg', label: 'Latar Hero' },
      { type: 'toggle', path: 'hero.gradient.enabled', label: 'Aktifkan Gradasi Latar Hero' },
      { type: 'color', path: 'hero.gradient.from', label: 'Warna Gradasi Awal' },
      { type: 'color', path: 'hero.gradient.to', label: 'Warna Gradasi Akhir' },
      { type: 'number', path: 'hero.gradient.angle', label: 'Sudut Gradasi (°)', min: 0, max: 360 },
      { type: 'text', path: 'hero.badge', label: 'Badge Kecil' },
      { type: 'text', path: 'hero.title', label: 'Judul Besar' },
      { type: 'textarea', path: 'hero.tagline', label: 'Tagline Utama' },
      { type: 'textarea', path: 'hero.desc', label: 'Deskripsi Singkat' },
      { type: 'text', path: 'hero.ctaPrimary', label: 'Tombol Utama' },
      { type: 'text', path: 'hero.ctaSecondary', label: 'Tombol Kedua' },
      { type: 'image', path: 'hero.image', label: 'Gambar Latar Hero (background — tidak mengubah kartu/foto kanan)' },
      { type: 'number', path: 'hero.imageOpacity', label: 'Intensitas Gambar Latar Hero (%)', min: 0, max: 100 },
      { type: 'toggle', path: 'hero.showPhoto', label: 'Tampilkan Foto Visual Hero (sisi kanan)' },
      { type: 'image', path: 'hero.photo', label: 'Foto Visual Hero (khusus sisi kanan — terpisah dari latar)' },
      { type: 'toggle', path: 'hero.cardVisible', label: 'Tampilkan Kartu Mengambang (Instalasi Bergaransi)' },
      { type: 'text', path: 'hero.cardTitle', label: 'Judul Kartu Mengambang' },
      { type: 'text', path: 'hero.cardSub', label: 'Subjudul Kartu Mengambang' },
      { type: 'select', path: 'hero.cardIcon', label: 'Ikon Kartu (dipakai bila tanpa foto)', options: iconOptions },
      { type: 'image', path: 'hero.cardImage', label: 'Foto Kartu (menambah foto sendiri, menggantikan ikon)' },
      { type: 'color', path: 'hero.cardBg', label: 'Warna Latar Kartu Mengambang' },
      { type: 'color', path: 'hero.cardFg', label: 'Warna Teks Kartu Mengambang' },
      { type: 'toggle', path: 'hero.showServiceList', label: 'Tampilkan daftar layanan di Hero' },
      { type: 'stringlist', path: 'hero.services', label: 'Daftar Layanan di Hero', addLabel: 'layanan' }
    ] },
    { id: 'stats', label: 'Statistik', icon: 'clock', desc: 'Angka ringkas di bawah hero.', fields: [
      { type: 'toggle', path: 'stats.visible', label: 'Tampilkan bagian Statistik' },
      { type: 'coloropt', path: 'stats.bg', label: 'Latar Statistik' },
      { type: 'toggle', path: 'stats.gradient.enabled', label: 'Aktifkan Gradasi Latar' },
      { type: 'color', path: 'stats.gradient.from', label: 'Warna Gradasi Awal' },
      { type: 'color', path: 'stats.gradient.to', label: 'Warna Gradasi Akhir' },
      { type: 'number', path: 'stats.gradient.angle', label: 'Sudut Gradasi (°)', min: 0, max: 360 },
      { type: 'image', path: 'stats.image', label: 'Gambar Latar Bagian' },
      { type: 'number', path: 'stats.imageOpacity', label: 'Intensitas Gambar Latar (%)', min: 0, max: 100 },
      { type: 'list', path: 'stats.items', label: 'Butir Statistik', titleKey: 'label', addLabel: 'statistik', fields: [
        { name: 'icon', label: 'Ikon (opsional)', type: 'select', options: iconOptions },
        { name: 'value', label: 'Angka', type: 'text' },
        { name: 'label', label: 'Keterangan', type: 'text' }
      ] }
    ] },
    { id: 'about', label: 'Tentang Kami', icon: 'users', desc: 'Profil singkat perusahaan.', fields: [
      { type: 'toggle', path: 'about.visible', label: 'Tampilkan bagian Tentang' },
      { type: 'coloropt', path: 'about.bg', label: 'Latar Tentang' },
      { type: 'toggle', path: 'about.gradient.enabled', label: 'Aktifkan Gradasi Latar' },
      { type: 'color', path: 'about.gradient.from', label: 'Warna Gradasi Awal' },
      { type: 'color', path: 'about.gradient.to', label: 'Warna Gradasi Akhir' },
      { type: 'number', path: 'about.gradient.angle', label: 'Sudut Gradasi (°)', min: 0, max: 360 },
      { type: 'text', path: 'about.kicker', label: 'Label Kecil' },
      { type: 'text', path: 'about.title', label: 'Judul' },
      { type: 'textarea', path: 'about.body', label: 'Paragraf', rows: 5 },
      { type: 'select', path: 'about.pointsIcon', label: 'Ikon Poin Unggulan', options: iconOptions },
      { type: 'stringlist', path: 'about.points', label: 'Poin Unggulan', addLabel: 'poin' },
      { type: 'image', path: 'about.image', label: 'Gambar Tentang (dipakai bila slider kosong)' },
      { type: 'list', path: 'about.images', label: 'Gambar Slider Tentang (bisa beberapa)', titleKey: 'alt', addLabel: 'gambar', fields: [
        { name: 'url', label: 'Gambar', type: 'image' },
        { name: 'alt', label: 'Keterangan Gambar (opsional)', type: 'text' }
      ] },
      { type: 'toggle', path: 'about.sliderAuto', label: 'Geser Otomatis (auto-play)' },
      { type: 'number', path: 'about.sliderInterval', label: 'Jeda Geser Otomatis (detik)', min: 2, max: 12 }
    ] },
    { id: 'services', label: 'Layanan', icon: 'wrench', desc: 'Kartu layanan beserta ikon dan deskripsinya.', fields: [
      { type: 'toggle', path: 'services.visible', label: 'Tampilkan bagian Layanan' },
      { type: 'coloropt', path: 'services.bg', label: 'Latar Layanan' },
      { type: 'toggle', path: 'services.gradient.enabled', label: 'Aktifkan Gradasi Latar' },
      { type: 'color', path: 'services.gradient.from', label: 'Warna Gradasi Awal' },
      { type: 'color', path: 'services.gradient.to', label: 'Warna Gradasi Akhir' },
      { type: 'number', path: 'services.gradient.angle', label: 'Sudut Gradasi (°)', min: 0, max: 360 },
      { type: 'image', path: 'services.image', label: 'Gambar Latar Bagian' },
      { type: 'number', path: 'services.imageOpacity', label: 'Intensitas Gambar Latar (%)', min: 0, max: 100 },
      { type: 'text', path: 'services.kicker', label: 'Label Kecil' },
      { type: 'text', path: 'services.title', label: 'Judul' },
      { type: 'textarea', path: 'services.subtitle', label: 'Subjudul' },
      { type: 'toggle', path: 'services.cardGradient.enabled', label: 'Gradasi Kartu Layanan (menimpa gradasi kartu dari Tema)' },
      { type: 'color', path: 'services.cardGradient.from', label: 'Warna Gradasi Kartu (awal / atas)' },
      { type: 'color', path: 'services.cardGradient.to', label: 'Warna Gradasi Kartu (akhir / bawah)' },
      { type: 'number', path: 'services.cardGradient.angle', label: 'Sudut Gradasi Kartu (°)', min: 0, max: 360 },
      { type: 'list', path: 'services.items', label: 'Kartu Layanan', titleKey: 'title', addLabel: 'layanan', fields: [
        { name: 'icon', label: 'Ikon', type: 'select', options: iconOptions },
        { name: 'title', label: 'Nama Layanan', type: 'text' },
        { name: 'desc', label: 'Deskripsi', type: 'textarea', rows: 3 },
        { name: 'cardBg', label: 'Warna Kotak Kartu Ini', type: 'coloropt', hint: 'Aktifkan untuk memberi warna kotak khusus pada kartu layanan ini' },
        { name: 'iconBg', label: 'Warna Latar Ikon Kartu Ini', type: 'coloropt', hint: 'Aktifkan untuk memberi warna latar ikon khusus pada kartu ini' }
      ] }
    ] },
    { id: 'why', label: 'Keunggulan', icon: 'shield', desc: 'Alasan klien memilih perusahaan Anda.', fields: [
      { type: 'toggle', path: 'why.visible', label: 'Tampilkan bagian Keunggulan' },
      { type: 'coloropt', path: 'why.bg', label: 'Latar Keunggulan' },
      { type: 'toggle', path: 'why.gradient.enabled', label: 'Aktifkan Gradasi Latar' },
      { type: 'color', path: 'why.gradient.from', label: 'Warna Gradasi Awal' },
      { type: 'color', path: 'why.gradient.to', label: 'Warna Gradasi Akhir' },
      { type: 'number', path: 'why.gradient.angle', label: 'Sudut Gradasi (°)', min: 0, max: 360 },
      { type: 'image', path: 'why.image', label: 'Gambar Latar Bagian' },
      { type: 'number', path: 'why.imageOpacity', label: 'Intensitas Gambar Latar (%)', min: 0, max: 100 },
      { type: 'text', path: 'why.kicker', label: 'Label Kecil' },
      { type: 'text', path: 'why.title', label: 'Judul' },
      { type: 'textarea', path: 'why.subtitle', label: 'Subjudul' },
      { type: 'list', path: 'why.items', label: 'Kartu Keunggulan', titleKey: 'title', addLabel: 'keunggulan', fields: [
        { name: 'icon', label: 'Ikon', type: 'select', options: iconOptions },
        { name: 'title', label: 'Judul', type: 'text' },
        { name: 'desc', label: 'Deskripsi', type: 'textarea', rows: 3 }
      ] }
    ] },
    { id: 'process', label: 'Alur Kerja', icon: 'check', desc: 'Langkah kerja dari survei hingga perawatan.', fields: [
      { type: 'toggle', path: 'process.visible', label: 'Tampilkan bagian Alur Kerja' },
      { type: 'coloropt', path: 'process.bg', label: 'Latar Alur Kerja' },
      { type: 'toggle', path: 'process.gradient.enabled', label: 'Aktifkan Gradasi Latar' },
      { type: 'color', path: 'process.gradient.from', label: 'Warna Gradasi Awal' },
      { type: 'color', path: 'process.gradient.to', label: 'Warna Gradasi Akhir' },
      { type: 'number', path: 'process.gradient.angle', label: 'Sudut Gradasi (°)', min: 0, max: 360 },
      { type: 'image', path: 'process.image', label: 'Gambar Latar Bagian' },
      { type: 'number', path: 'process.imageOpacity', label: 'Intensitas Gambar Latar (%)', min: 0, max: 100 },
      { type: 'text', path: 'process.kicker', label: 'Label Kecil' },
      { type: 'text', path: 'process.title', label: 'Judul' },
      { type: 'textarea', path: 'process.subtitle', label: 'Subjudul' },
      { type: 'list', path: 'process.items', label: 'Langkah', titleKey: 'title', addLabel: 'langkah', fields: [
        { name: 'icon', label: 'Ikon Langkah (opsional — mengganti nomor)', type: 'select', options: iconOptions },
        { name: 'title', label: 'Judul Langkah', type: 'text' },
        { name: 'desc', label: 'Deskripsi', type: 'textarea', rows: 3 }
      ] }
    ] },
    { id: 'projects', label: 'Portofolio', icon: 'server', desc: 'Proyek-proyek yang telah dikerjakan.', fields: [
      { type: 'toggle', path: 'projects.visible', label: 'Tampilkan bagian Portofolio' },
      { type: 'coloropt', path: 'projects.bg', label: 'Latar Portofolio' },
      { type: 'toggle', path: 'projects.gradient.enabled', label: 'Aktifkan Gradasi Latar' },
      { type: 'color', path: 'projects.gradient.from', label: 'Warna Gradasi Awal' },
      { type: 'color', path: 'projects.gradient.to', label: 'Warna Gradasi Akhir' },
      { type: 'number', path: 'projects.gradient.angle', label: 'Sudut Gradasi (°)', min: 0, max: 360 },
      { type: 'image', path: 'projects.image', label: 'Gambar Latar Bagian' },
      { type: 'number', path: 'projects.imageOpacity', label: 'Intensitas Gambar Latar (%)', min: 0, max: 100 },
      { type: 'text', path: 'projects.kicker', label: 'Label Kecil' },
      { type: 'text', path: 'projects.title', label: 'Judul' },
      { type: 'textarea', path: 'projects.subtitle', label: 'Subjudul' },
      { type: 'list', path: 'projects.items', label: 'Kartu Proyek', titleKey: 'title', addLabel: 'proyek', fields: [
        { name: 'icon', label: 'Ikon', type: 'select', options: iconOptions },
        { name: 'category', label: 'Kategori', type: 'text' },
        { name: 'title', label: 'Judul Proyek', type: 'text' },
        { name: 'desc', label: 'Deskripsi', type: 'textarea', rows: 3 }
      ] }
    ] },
    { id: 'support', label: 'Support', icon: 'camera', desc: 'Brand CCTV & perangkat yang didukung (logo/gambar + nama + keterangan).', fields: [
      { type: 'toggle', path: 'support.visible', label: 'Tampilkan bagian Support' },
      { type: 'coloropt', path: 'support.bg', label: 'Latar Support' },
      { type: 'toggle', path: 'support.gradient.enabled', label: 'Aktifkan Gradasi Latar' },
      { type: 'color', path: 'support.gradient.from', label: 'Warna Gradasi Awal' },
      { type: 'color', path: 'support.gradient.to', label: 'Warna Gradasi Akhir' },
      { type: 'number', path: 'support.gradient.angle', label: 'Sudut Gradasi (°)', min: 0, max: 360 },
      { type: 'image', path: 'support.image', label: 'Gambar Latar Bagian' },
      { type: 'number', path: 'support.imageOpacity', label: 'Intensitas Gambar Latar (%)', min: 0, max: 100 },
      { type: 'text', path: 'support.kicker', label: 'Label Kecil' },
      { type: 'text', path: 'support.title', label: 'Judul' },
      { type: 'textarea', path: 'support.subtitle', label: 'Subjudul' },
      { type: 'coloropt', path: 'support.cardBg', label: 'Warna Kotak Brand', hint: 'Aktifkan warna kotak/kartu brand kustom' },
      { type: 'toggle', path: 'support.boxOutline.enabled', label: 'Garis Outline Kotak Gambar' },
      { type: 'color', path: 'support.boxOutline.color', label: 'Warna Outline Kotak Gambar' },
      { type: 'number', path: 'support.boxOutline.width', label: 'Tebal Outline (px)', min: 0, max: 8 },
      { type: 'toggle', path: 'support.imageCover', label: 'Gambar Memenuhi Kotak Penuh (potong tepi)' },
      { type: 'list', path: 'support.items', label: 'Brand yang Didukung', titleKey: 'name', addLabel: 'brand', fields: [
        { name: 'image', label: 'Gambar / Logo Brand', type: 'image' },
        { name: 'name', label: 'Nama Brand', type: 'text' },
        { name: 'desc', label: 'Keterangan (opsional)', type: 'textarea', rows: 2 }
      ] }
    ] },
    { id: 'testimonials', label: 'Testimoni', icon: 'headset', desc: 'Ulasan klien (ganti dengan testimoni asli Anda).', fields: [
      { type: 'toggle', path: 'testimonials.visible', label: 'Tampilkan bagian Testimoni' },
      { type: 'coloropt', path: 'testimonials.bg', label: 'Latar Testimoni' },
      { type: 'toggle', path: 'testimonials.gradient.enabled', label: 'Aktifkan Gradasi Latar' },
      { type: 'color', path: 'testimonials.gradient.from', label: 'Warna Gradasi Awal' },
      { type: 'color', path: 'testimonials.gradient.to', label: 'Warna Gradasi Akhir' },
      { type: 'number', path: 'testimonials.gradient.angle', label: 'Sudut Gradasi (°)', min: 0, max: 360 },
      { type: 'image', path: 'testimonials.image', label: 'Gambar Latar Bagian' },
      { type: 'number', path: 'testimonials.imageOpacity', label: 'Intensitas Gambar Latar (%)', min: 0, max: 100 },
      { type: 'text', path: 'testimonials.kicker', label: 'Label Kecil' },
      { type: 'text', path: 'testimonials.title', label: 'Judul' },
      { type: 'textarea', path: 'testimonials.subtitle', label: 'Subjudul' },
      { type: 'list', path: 'testimonials.items', label: 'Testimoni', titleKey: 'name', addLabel: 'testimoni', fields: [
        { name: 'photo', label: 'Foto Client (opsional — otomatis inisial bila kosong)', type: 'image' },
        { name: 'quote', label: 'Kutipan', type: 'textarea', rows: 3 },
        { name: 'name', label: 'Nama', type: 'text' },
        { name: 'role', label: 'Jabatan / Instansi', type: 'text' }
      ] }
    ] },
    { id: 'cta', label: 'Ajakan (CTA)', icon: 'bolt', desc: 'Banner ajakan menghubungi Anda.', fields: [
      { type: 'toggle', path: 'cta.visible', label: 'Tampilkan banner CTA' },
      { type: 'coloropt', path: 'cta.bg', label: 'Latar CTA' },
      { type: 'toggle', path: 'cta.gradient.enabled', label: 'Aktifkan Gradasi Latar' },
      { type: 'color', path: 'cta.gradient.from', label: 'Warna Gradasi Awal' },
      { type: 'color', path: 'cta.gradient.to', label: 'Warna Gradasi Akhir' },
      { type: 'number', path: 'cta.gradient.angle', label: 'Sudut Gradasi (°)', min: 0, max: 360 },
      { type: 'image', path: 'cta.image', label: 'Gambar Latar Bagian' },
      { type: 'number', path: 'cta.imageOpacity', label: 'Intensitas Gambar Latar (%)', min: 0, max: 100 },
      { type: 'text', path: 'cta.title', label: 'Judul' },
      { type: 'textarea', path: 'cta.text', label: 'Teks Pendukung' },
      { type: 'text', path: 'cta.button', label: 'Teks Tombol' }
    ] },
    { id: 'contact', label: 'Kontak', icon: 'pabx', desc: 'Informasi kontak dan formulir pesan.', fields: [
      { type: 'toggle', path: 'contact.visible', label: 'Tampilkan bagian Kontak' },
      { type: 'coloropt', path: 'contact.bg', label: 'Latar Kontak' },
      { type: 'toggle', path: 'contact.gradient.enabled', label: 'Aktifkan Gradasi Latar' },
      { type: 'color', path: 'contact.gradient.from', label: 'Warna Gradasi Awal' },
      { type: 'color', path: 'contact.gradient.to', label: 'Warna Gradasi Akhir' },
      { type: 'number', path: 'contact.gradient.angle', label: 'Sudut Gradasi (°)', min: 0, max: 360 },
      { type: 'image', path: 'contact.image', label: 'Gambar Latar Bagian' },
      { type: 'number', path: 'contact.imageOpacity', label: 'Intensitas Gambar Latar (%)', min: 0, max: 100 },
      { type: 'text', path: 'contact.kicker', label: 'Label Kecil' },
      { type: 'text', path: 'contact.title', label: 'Judul' },
      { type: 'textarea', path: 'contact.subtitle', label: 'Subjudul' },
      { type: 'select', path: 'contact.iconAddress', label: 'Ikon Alamat', options: iconOptions },
      { type: 'text', path: 'contact.address', label: 'Alamat' },
      { type: 'select', path: 'contact.iconPhone', label: 'Ikon Telepon', options: iconOptions },
      { type: 'text', path: 'contact.phone', label: 'Telepon' },
      { type: 'text', path: 'contact.whatsapp', label: 'WhatsApp (dengan kode negara)' },
      { type: 'select', path: 'contact.iconEmail', label: 'Ikon Email', options: iconOptions },
      { type: 'text', path: 'contact.email', label: 'Email' },
      { type: 'select', path: 'contact.iconHours', label: 'Ikon Jam Operasional', options: iconOptions },
      { type: 'text', path: 'contact.hours', label: 'Jam Operasional' },
      { type: 'toggle', path: 'contact.mapVisible', label: 'Tampilkan Peta Google Maps' },
      { type: 'text', path: 'contact.mapAddress', label: 'Alamat pada Peta (Google Maps)' },
      { type: 'number', path: 'contact.mapHeight', label: 'Tinggi Peta (px)', min: 180, max: 700 },
      { type: 'number', path: 'contact.mapWidth', label: 'Lebar Peta (%)', min: 30, max: 100 },
      { type: 'select', path: 'contact.mapAlign', label: 'Posisi Peta', options: ['kiri', 'tengah', 'kanan'] }
    ] },
    { id: 'footer', label: 'Footer', icon: 'box', desc: 'Catatan penutup halaman.', fields: [
      { type: 'toggle', path: 'footer.gradient.enabled', label: 'Aktifkan Gradasi Latar' },
      { type: 'color', path: 'footer.gradient.from', label: 'Warna Gradasi Awal' },
      { type: 'color', path: 'footer.gradient.to', label: 'Warna Gradasi Akhir' },
      { type: 'number', path: 'footer.gradient.angle', label: 'Sudut Gradasi (°)', min: 0, max: 360 },
      { type: 'image', path: 'footer.image', label: 'Gambar Latar Footer' },
      { type: 'number', path: 'footer.imageOpacity', label: 'Intensitas Gambar Latar (%)', min: 0, max: 100 },
      { type: 'textarea', path: 'footer.text', label: 'Deskripsi Singkat di Footer' },
      { type: 'text', path: 'footer.copyright', label: 'Baris Hak Cipta' },
      { type: 'text', path: 'footer.servicesTitle', label: 'Judul Kolom Bidang Layanan' },
      { type: 'textarea', path: 'footer.servicesNote', label: 'Isi Teks Bidang Layanan (kosongkan = pakai daftar layanan Hero)', rows: 3 }
    ] }
  ];

  /* Sisipkan kontrol warna teks (judul & isi) serta warna kotak/ikon untuk tiap bagian
     secara terpusat, tepat setelah pengaturan gradasi latar bagian tersebut. */
  (function augmentColorControls() {
    function textFields(p, noun) {
      return [
        { type: 'coloropt', path: p + '.titleColor', label: 'Warna Judul ' + noun, hint: 'Aktifkan warna judul kustom' },
        { type: 'coloropt', path: p + '.textColor', label: 'Warna Teks ' + noun, hint: 'Aktifkan warna teks/isi kustom' }
      ];
    }
    function boxFields(p, noun) {
      return [
        { type: 'coloropt', path: p + '.cardBg', label: 'Warna Kotak ' + noun, hint: 'Aktifkan warna kotak/kartu kustom' },
        { type: 'coloropt', path: p + '.iconBg', label: 'Warna Latar Ikon ' + noun, hint: 'Aktifkan warna latar ikon kustom' },
        { type: 'coloropt', path: p + '.iconColor', label: 'Warna Ikon ' + noun, hint: 'Aktifkan warna ikon kustom' }
      ];
    }
    var kinds = {
      hero: ['t'], stats: ['t', 'b'], about: ['t'], services: ['t', 'b'],
      why: ['t', 'b'], process: ['t', 'b'], projects: ['t', 'b'], support: ['t'],
      testimonials: ['t', 'b'], cta: ['t'], contact: ['t', 'b'], footer: ['t']
    };
    var nouns = {
      hero: 'Hero', stats: 'Statistik', about: 'Tentang', services: 'Layanan',
      why: 'Keunggulan', process: 'Langkah', projects: 'Proyek', support: 'Support',
      testimonials: 'Testimoni', cta: 'CTA', contact: 'Kontak', footer: 'Footer'
    };
    SCHEMA.forEach(function (g) {
      var k = kinds[g.id];
      if (!k) return;
      var extra = [];
      if (k.indexOf('t') >= 0) extra = extra.concat(textFields(g.id, nouns[g.id]));
      if (k.indexOf('b') >= 0) extra = extra.concat(boxFields(g.id, nouns[g.id]));
      var anchor = -1;
      for (var i = 0; i < g.fields.length; i++) {
        if (g.fields[i].path === g.id + '.gradient.angle') { anchor = i; break; }
      }
      if (anchor >= 0) g.fields.splice.apply(g.fields, [anchor + 1, 0].concat(extra));
      else g.fields = g.fields.concat(extra);
    });

    var brand = SCHEMA.filter(function (g) { return g.id === 'brand'; })[0];
    if (brand) brand.fields.push({ type: 'coloropt', path: 'brand.textColor', label: 'Warna Teks Brand di Navbar', hint: 'Aktifkan warna teks brand kustom' });

    var projList = null;
    SCHEMA.forEach(function (g) { g.fields.forEach(function (f) { if (f.path === 'projects.items') projList = f; }); });
    if (projList && projList.fields) projList.fields.push({ name: 'image', label: 'Gambar Proyek (opsional)', type: 'image' });
  })();

  /* ---------- render panel ---------- */
  function renderSidebar() {
    var el = document.getElementById('sidebar');
    el.innerHTML = '<div class="side-title">Bagian Website</div>' + SCHEMA.map(function (g) {
      return '<button class="side-btn' + (g.id === activeGroup ? ' active' : '') + '" data-group="' + g.id + '">' +
        '<svg viewBox="0 0 24 24">' + (window.MSL_ICONS[g.icon] || window.MSL_ICONS.check) + '</svg>' + esc(g.label) + '</button>';
    }).join('') +
    '<div class="side-note">Perubahan tersimpan otomatis di browser ini dan langsung terlihat oleh pengunjung situs pada perangkat yang sama. Gunakan <a href="#" data-action="export">Export</a> untuk memindahkan konfigurasi ke perangkat lain.</div>';
  }

  function renderPanel() {
    var g = SCHEMA.filter(function (x) { return x.id === activeGroup; })[0];
    var panel = document.getElementById('panel');
    panel.innerHTML = '<div class="panel-head"><h2>' + esc(g.label) + '</h2><p>' + esc(g.desc) + '</p></div>' +
      g.fields.map(buildField).join('');
    panel.querySelectorAll('[data-list]').forEach(renderList);
    panel.scrollTop = 0;
  }

  function refreshThumbs() {
    document.querySelectorAll('[data-thumb]').forEach(function (img) {
      var val = getPath(draft, img.getAttribute('data-thumb'));
      if (val) {
        if (img.tagName !== 'IMG') {
          var n = document.createElement('img');
          n.className = 'img-thumb';
          n.setAttribute('data-thumb', img.getAttribute('data-thumb'));
          img.replaceWith(n);
          img = n;
        }
        img.src = val;
      }
    });
  }

  /* ---------- events ---------- */
  document.addEventListener('input', function (ev) {
    var el = ev.target;
    var path = el.getAttribute && el.getAttribute('data-path');
    if (!path) return;
    var kind = el.getAttribute('data-kind');
    if (kind === 'text') setPath(draft, path, el.value);
    else if (kind === 'number') setPath(draft, path, parseFloat(el.value) || 0);
    else if (kind === 'color') {
      setPath(draft, path, el.value);
      var twin = el.parentElement.querySelector('[data-kind="colortext"]');
      if (twin) twin.value = el.value;
      syncOptToggle(path, el);
    } else if (kind === 'colortext') {
      if (/^#[0-9a-fA-F]{6}$/.test(el.value)) {
        setPath(draft, path, el.value);
        var sw = el.parentElement.querySelector('[data-kind="color"]');
        if (sw) sw.value = el.value;
        syncOptToggle(path, el);
      } else if (el.value === '') {
        setPath(draft, path, '');
        syncOptToggle(path, el);
      } else { return; }
    } else { return; }
    if (el.getAttribute('data-refresh')) {
      refreshThumbs();
      var listWrap = el.closest('[data-list]');
      if (listWrap && el.value !== undefined) { /* judul item diperbarui saat render berikut */ }
    }
    commit();
  });

  document.addEventListener('change', function (ev) {
    var el = ev.target;
    var path = el.getAttribute && el.getAttribute('data-path');
    if (path) {
      var kind = el.getAttribute('data-kind');
      if (kind === 'toggle') { setPath(draft, path, el.checked); commit(); return; }
      if (kind === 'opttoggle') {
        var row = document.querySelector('[data-optfor="' + path + '"]');
        var colorInput = row && row.querySelector('[data-kind="color"]');
        setPath(draft, path, el.checked ? ((colorInput && colorInput.value) || '#101828') : '');
        if (row) { row.style.opacity = el.checked ? '' : '.65'; row.style.pointerEvents = ''; }
        commit();
        return;
      }
      if (el.tagName === 'SELECT') { setPath(draft, path, el.value); commit(); return; }
    }
    if (el.getAttribute && el.getAttribute('data-filefor')) {
      var target = el.getAttribute('data-filefor');
      var file = el.files && el.files[0];
      if (!file) return;
      setStatus('Memproses gambar…', true);
      var reader = new FileReader();
      reader.onload = function () {
        var img = new Image();
        img.onload = function () {
          var max = 1400;
          var scale = Math.min(1, max / Math.max(img.width, img.height));
          var canvas = document.createElement('canvas');
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
          var dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          setPath(draft, target, dataUrl);
          syncFieldValues(target);
          refreshThumbs();
          commit();
        };
        img.onerror = function () { setStatus('Gambar tidak valid', true); };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
      el.value = '';
    }
  });

  function syncFieldValues(path) {
    document.querySelectorAll('[data-path="' + path + '"]').forEach(function (inp) {
      var kind = inp.getAttribute('data-kind');
      var val = getPath(draft, path);
      if (kind === 'color' || kind === 'colortext') inp.value = val || '';
      else if (kind === 'text') inp.value = val == null ? '' : val;
    });
  }

  /* Saat pengguna memilih warna pada kontrol coloropt, otomatis aktifkan toggle-nya
     agar perubahan langsung terlihat; mengosongkan teks akan menonaktifkannya. */
  function syncOptToggle(path, el) {
    var field = el.closest ? el.closest('.field') : null;
    if (!field) return;
    var tog = field.querySelector('[data-kind="opttoggle"][data-path="' + path + '"]');
    if (!tog) return;
    var hasVal = !!getPath(draft, path);
    tog.checked = hasVal;
    var row = field.querySelector('[data-optfor="' + path + '"]');
    if (row) { row.style.opacity = hasVal ? '' : '.65'; row.style.pointerEvents = ''; }
  }

  document.addEventListener('click', function (ev) {
    var el = ev.target.closest('[data-group],[data-action],[data-move],[data-remove],[data-add],[data-upload],[data-clearimg]');
    if (!el) return;

    if (el.hasAttribute('data-group')) {
      activeGroup = el.getAttribute('data-group');
      renderSidebar(); renderPanel();
      return;
    }
    var action = el.getAttribute('data-action');
    if (action === 'export') { ev.preventDefault(); exportJson(); return; }
    if (action === 'import') { document.getElementById('import-file').click(); return; }
    if (action === 'reset') { resetAll(); return; }
    if (action === 'open') { window.open('index.html', '_blank'); return; }
    if (action === 'device') {
      document.querySelectorAll('[data-action="device"]').forEach(function (b) { b.classList.remove('active'); });
      el.classList.add('active');
      var frame = document.getElementById('preview-frame');
      frame.style.width = el.getAttribute('data-width');
      return;
    }

    var move = el.getAttribute('data-move');
    if (move) {
      var p = move.split('|');
      var arr = getPath(draft, p[0]);
      var idx = parseInt(p[1], 10);
      var to = idx + parseInt(p[2], 10);
      if (to < 0 || to >= arr.length) return;
      var tmp = arr[idx]; arr[idx] = arr[to]; arr[to] = tmp;
      renderPanel(); commit();
      return;
    }
    var remove = el.getAttribute('data-remove');
    if (remove) {
      var q = remove.split('|');
      var list = getPath(draft, q[0]);
      if (list.length <= 1 && q[0] !== 'about.images') { setStatus('Minimal satu item harus tersisa', true); return; }
      list.splice(parseInt(q[1], 10), 1);
      renderPanel(); commit();
      return;
    }
    var add = el.getAttribute('data-add');
    if (add) {
      var spec = findListSpec(add);
      var target = getPath(draft, add);
      if (!Array.isArray(target)) { target = []; setPath(draft, add, target); }
      var template;
      if (spec.type === 'stringlist') {
        template = 'Item baru';
      } else {
        var last = target[target.length - 1];
        if (last && typeof last === 'object') {
          template = clone(last);
          Object.keys(template).forEach(function (k) {
            if (typeof template[k] === 'string') template[k] = '';
          });
        } else {
          template = {};
          (spec.fields || []).forEach(function (sf) { template[sf.name] = ''; });
        }
        if (spec.titleKey && template[spec.titleKey] !== undefined) template[spec.titleKey] = 'Item baru';
      }
      target.push(template);
      renderPanel(); commit();
      return;
    }
    var upload = el.getAttribute('data-upload');
    if (upload) {
      document.querySelector('[data-filefor="' + upload + '"]').click();
      return;
    }
    var clearimg = el.getAttribute('data-clearimg');
    if (clearimg) {
      setPath(draft, clearimg, '');
      syncFieldValues(clearimg);
      var thumb = document.querySelector('[data-thumb="' + clearimg + '"]');
      if (thumb && thumb.tagName === 'IMG') {
        var d = document.createElement('div');
        d.className = 'img-thumb empty';
        d.setAttribute('data-thumb', clearimg);
        d.textContent = 'kosong';
        thumb.replaceWith(d);
      }
      commit();
      return;
    }
  });

  /* ---------- export / import / reset ---------- */
  function exportJson() {
    var blob = new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'mecha-site-config.json';
    a.click();
    URL.revokeObjectURL(a.href);
    setStatus('Konfigurasi di-export', false);
  }

  document.getElementById('import-file').addEventListener('change', function (ev) {
    var file = ev.target.files && ev.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var parsed = JSON.parse(reader.result);
        draft = window.MSL.deepMerge(window.MSL_DEFAULT, parsed);
        renderPanel(); commit();
        setStatus('Konfigurasi berhasil di-import', false);
      } catch (e) {
        setStatus('File konfigurasi tidak valid', true);
      }
    };
    reader.readAsText(file);
    ev.target.value = '';
  });

  function resetAll() {
    if (!confirm('Kembalikan seluruh website ke konfigurasi bawaan? Perubahan tersimpan akan dihapus.')) return;
    draft = clone(window.MSL_DEFAULT);
    try { localStorage.removeItem(window.MSL.STORAGE_KEY); } catch (e) {}
    renderPanel(); commit();
    setStatus('Dikembalikan ke bawaan', false);
  }

  /* ---------- init ---------- */
  renderSidebar();
  renderPanel();
  setStatus('Siap — perubahan tersimpan otomatis', false);

  var frame = document.getElementById('preview-frame');
  frame.addEventListener('load', function () {
    frame.contentWindow.postMessage({ type: 'msl-config', config: clone(draft) }, '*');
  });
})();
