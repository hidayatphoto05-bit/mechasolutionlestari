# CV. Mecha Solution Lestari - Website

Website company profile statis (HTML/CSS/JS murni, tanpa framework atau build step).

## Struktur
- index.html - halaman utama (publik)
- customize.html - Studio Kustomisasi (tersembunyi, dikunci username+password sisi klien)
- assets/ - CSS, JS, dan gambar
- assets/js/config.js - seluruh isi website (teks, warna, gambar) sebagai nilai default

## Menjalankan lokal
Buka index.html di browser, atau jalankan server statis lalu buka URL-nya:

    npx serve .

## Deploy ke Vercel
1. Push folder ini ke sebuah repo GitHub.
2. vercel.com -> New Project -> import repo tersebut.
3. Framework Preset: Other. Build Command: kosong. Output Directory: kosong (root).
4. Deploy. Situs langsung disajikan dari root.

## Deploy ke GitHub Pages
1. Push ke GitHub.
2. Settings -> Pages -> Source: Deploy from a branch -> branch (mis. main), folder / (root).
3. Simpan. Situs tersedia di https://<user>.github.io/<repo>/.

## Studio Kustomisasi
- Buka lewat index.html#studio (muncul tombol gerigi) atau langsung ke customize.html.
- Login default: username `pemilik`, password `mecha2024`.
- Ganti di customize.html pada skrip gate (konstanta USER dan PASS).
- Warna/gradasi kartu Layanan: menu Layanan -> "Gradasi Kartu Layanan" atau "Warna Kotak".
- Perubahan di Studio tersimpan di localStorage browser pengunjung, bukan di server.
  Agar permanen untuk semua pengunjung: edit assets/js/config.js lalu deploy ulang.
- Kunci ini hanya sisi klien (kredensial ada di kode sumber), bukan proteksi yang kuat.
