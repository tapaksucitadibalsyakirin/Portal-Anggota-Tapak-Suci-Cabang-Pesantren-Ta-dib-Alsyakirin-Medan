-- SETUP AWAL SUPABASE: TAPAK SUCI PERSITAS
-- Jalankan SATU KALI pada proyek Supabase BARU khusus PERSITAS.
-- Ganti email di bawah sebelum menjalankan SQL.

create extension if not exists pgcrypto;

create table if not exists public.anggota (
  id uuid primary key default gen_random_uuid(),
  jenjang text not null check (jenjang in ('siswa','kader','pendekar')),
  nama text not null,
  jk text default 'Laki-laki',
  tahun integer,
  tingkat text,
  kta text,
  alamat text,
  kontak text,
  foto text,
  kta_img text,
  keg jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.dokumen_anggota (
  id uuid primary key default gen_random_uuid(),
  anggota_id uuid not null references public.anggota(id) on delete cascade,
  jenis text not null check (jenis in ('kta','ijazah')),
  storage_path text not null,
  file_name text,
  mime_type text,
  created_at timestamptz not null default now(),
  unique (anggota_id, jenis)
);

alter table public.anggota enable row level security;
alter table public.dokumen_anggota enable row level security;

-- GANTI alamat email admin utama pada empat policy berikut.
drop policy if exists "persitas_admin_anggota_all" on public.anggota;
create policy "persitas_admin_anggota_all" on public.anggota
for all to authenticated
using (lower(coalesce(auth.jwt()->>'email','')) = lower('tapaksucitadibalsyakirin@gmail.com'))
with check (lower(coalesce(auth.jwt()->>'email','')) = lower('tapaksucitadibalsyakirin@gmail.com'));

drop policy if exists "persitas_admin_dokumen_all" on public.dokumen_anggota;
create policy "persitas_admin_dokumen_all" on public.dokumen_anggota
for all to authenticated
using (lower(coalesce(auth.jwt()->>'email','')) = lower('tapaksucitadibalsyakirin@gmail.com'))
with check (lower(coalesce(auth.jwt()->>'email','')) = lower('tapaksucitadibalsyakirin@gmail.com'));

-- View publik sengaja tidak memuat kolom kta_img maupun metadata dokumen.
drop view if exists public.anggota_publik;
create view public.anggota_publik as
select id, jenjang, nama, jk, tahun, tingkat, alamat, kontak, foto, keg, created_at
from public.anggota;
grant select on public.anggota_publik to anon, authenticated;

-- Foto profil boleh publik; KTA dan ijazah wajib privat.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('media','media',true,10485760,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=true;
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('dokumen-pribadi','dokumen-pribadi',false,10485760,array['application/pdf','image/jpeg','image/png'])
on conflict (id) do update set public=false;

drop policy if exists "persitas_admin_media_upload" on storage.objects;
create policy "persitas_admin_media_upload" on storage.objects for insert to authenticated
with check (bucket_id='media' and lower(coalesce(auth.jwt()->>'email',''))=lower('tapaksucitadibalsyakirin@gmail.com'));
drop policy if exists "persitas_admin_media_update" on storage.objects;
create policy "persitas_admin_media_update" on storage.objects for update to authenticated
using (bucket_id='media' and lower(coalesce(auth.jwt()->>'email',''))=lower('tapaksucitadibalsyakirin@gmail.com'))
with check (bucket_id='media' and lower(coalesce(auth.jwt()->>'email',''))=lower('tapaksucitadibalsyakirin@gmail.com'));
drop policy if exists "persitas_admin_media_delete" on storage.objects;
create policy "persitas_admin_media_delete" on storage.objects for delete to authenticated
using (bucket_id='media' and lower(coalesce(auth.jwt()->>'email',''))=lower('tapaksucitadibalsyakirin@gmail.com'));

drop policy if exists "persitas_admin_private_docs_select" on storage.objects;
create policy "persitas_admin_private_docs_select" on storage.objects for select to authenticated
using (bucket_id='dokumen-pribadi' and lower(coalesce(auth.jwt()->>'email',''))=lower('tapaksucitadibalsyakirin@gmail.com'));
drop policy if exists "persitas_admin_private_docs_insert" on storage.objects;
create policy "persitas_admin_private_docs_insert" on storage.objects for insert to authenticated
with check (bucket_id='dokumen-pribadi' and lower(coalesce(auth.jwt()->>'email',''))=lower('tapaksucitadibalsyakirin@gmail.com'));
drop policy if exists "persitas_admin_private_docs_update" on storage.objects;
create policy "persitas_admin_private_docs_update" on storage.objects for update to authenticated
using (bucket_id='dokumen-pribadi' and lower(coalesce(auth.jwt()->>'email',''))=lower('tapaksucitadibalsyakirin@gmail.com'))
with check (bucket_id='dokumen-pribadi' and lower(coalesce(auth.jwt()->>'email',''))=lower('tapaksucitadibalsyakirin@gmail.com'));
drop policy if exists "persitas_admin_private_docs_delete" on storage.objects;
create policy "persitas_admin_private_docs_delete" on storage.objects for delete to authenticated
using (bucket_id='dokumen-pribadi' and lower(coalesce(auth.jwt()->>'email',''))=lower('tapaksucitadibalsyakirin@gmail.com'));

-- Pastikan signup publik dimatikan di Authentication > Settings.
