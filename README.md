# Portal Database Tapak Suci PERSITAS

Cabang Pesantren Modern Ta'dib Alsyakirin.

Template portal keanggotaan dengan dashboard, data siswa/kader/pendekar, autentikasi admin Supabase, dan penyimpanan privat KTA/ijazah.

## File
- `index.html` — aplikasi web.
- `logo-persitas.png` — logo resmi Tapak Suci yang diberikan pengguna; dipakai pada identitas portal, favicon, dan watermark.
- `setup-persitas-supabase.sql` — skema, RLS, view publik, dan bucket storage untuk proyek Supabase baru.
- `PANDUAN-PERSITAS.txt` — panduan konfigurasi dan deployment.

**Penting:** proyek Supabase PERSITAS harus terpisah dari proyek Baitussalam. Isi URL, publishable key, dan email admin sendiri. Jangan pernah menaruh service role/secret key di browser.


Konfigurasi Supabase PERSITAS telah diisi untuk project https://aogeibkmyobqnqcpjhzn.supabase.co dan admin utama tapaksucitadibalsyakirin@gmail.com. Jalankan setup-persitas-supabase.sql satu kali pada proyek baru sebelum login.
