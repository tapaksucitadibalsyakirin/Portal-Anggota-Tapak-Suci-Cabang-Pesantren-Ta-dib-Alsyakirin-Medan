


const LV={
 siswa:['Siswa Dasar','Siswa Satu','Siswa Dua','Siswa Tiga','Siswa Empat'],
 kader:['Kader Dasar / Biru Dasar (K.Da)','Kader Muda / Biru Melati 1 (K.Ma)','Kader Madya / Biru Melati 2 (K.Mdy)','Kader Kepala / Biru Melati 3 (K.Ka)','Kader Utama / Biru Melati 4 (K.Ua)'],
 pendekar:['Pendekar Muda / Hitam Melati 1 (P.Ma)','Pendekar Madya / Hitam Melati 2 (P.Mdy)','Pendekar Kepala / Hitam Melati 3 (P.Ka)','Pendekar Utama / Hitam Melati 4 (P.Ua)','Pendekar Besar / Hitam Melati 5 (P.Br)']
};
const NAMA={siswa:'Siswa',kader:'Kader',pendekar:'Pendekar'};
let db={siswa:[],kader:[],pendekar:[]},admin=false,page='dashboard',cur=null;
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/* ---------- Supabase ---------- */
const SUPABASE_URL='https://PROJECT-REF-ANDA.supabase.co';
const SUPABASE_KEY='ISI_PUBLISHABLE_KEY_PROYEK_PERSITAS';
const ADMIN_EMAIL='ISI_EMAIL_ADMIN_PERSITAS';
const PRIVATE_BUCKET='dokumen-pribadi';
let docsByMember={},legacyKtaByMember={};
let sb=null;
try{if(/^https:\/\/.+\.supabase\.co/.test(SUPABASE_URL)&&!/ISI_|PROJECT-REF/.test(SUPABASE_KEY+SUPABASE_URL)&&typeof supabase!=='undefined')sb=supabase.createClient(SUPABASE_URL,SUPABASE_KEY)}catch(e){console.error(e)}
const fromRow=d=>({id:d.id,nama:d.nama,jk:d.jk||'Laki-laki',tahun:d.tahun??'',tingkat:d.tingkat,kta:d.kta||'',alamat:d.alamat||'',kontak:d.kontak||'',foto:d.foto||'',ktaImg:d.kta_img||'',keg:d.keg||[]});
const toRow=(t,r)=>({jenjang:t,nama:r.nama,jk:r.jk,tahun:parseInt(r.tahun)||null,tingkat:r.tingkat,kta:r.kta,alamat:r.alamat,kontak:r.kontak,foto:r.foto||null,keg:r.keg||[]});
function isAdminSession(session){return (session?.user?.email||'').toLowerCase()===ADMIN_EMAIL.toLowerCase()}
async function loadPrivateDocs(){
 docsByMember={};
 if(!admin)return;
 const {data,error}=await sb.from('dokumen_anggota').select('*');
 if(error){console.error('Dokumen privat tidak dapat dimuat:',error.message);return}
 (data||[]).forEach(d=>{if(!docsByMember[d.anggota_id])docsByMember[d.anggota_id]={};docsByMember[d.anggota_id][d.jenis]=d});
}
async function load(){
 if(!sb)return;
 const {data:sessionData}=await sb.auth.getSession();
 admin=isAdminSession(sessionData?.session);
 const table=admin?'anggota':'anggota_publik';
 const {data,error}=await sb.from(table).select('*').order('nama');
 if(error){console.error(error);return alert('Gagal memuat data: '+error.message)}
 db={siswa:[],kader:[],pendekar:[]};legacyKtaByMember={};(data||[]).forEach(d=>{if(db[d.jenjang])db[d.jenjang].push(fromRow(d));if(admin&&d.kta_img)legacyKtaByMember[d.id]=d.kta_img});
 await loadPrivateDocs();
}
async function uploadPrivateDoc(memberId,kind,file){
 if(!admin)throw new Error('Hanya admin yang dapat mengunggah dokumen.');
 if(!file)return;
 const allowed=['application/pdf','image/jpeg','image/png'];
 if(!allowed.includes(file.type))throw new Error('Format dokumen harus PDF, JPG, atau PNG.');
 if(file.size>10*1024*1024)throw new Error('Ukuran dokumen maksimal 10 MB.');
 const old=docsByMember[memberId]?.[kind];
 const clean=(file.name||kind).replace(/[^a-zA-Z0-9._-]/g,'_').slice(-80);
 const path=`${memberId}/${kind}-${Date.now()}-${clean}`;
 const {error:upErr}=await sb.storage.from(PRIVATE_BUCKET).upload(path,file,{contentType:file.type,upsert:false});
 if(upErr)throw upErr;
 const {error:metaErr}=await sb.from('dokumen_anggota').upsert({anggota_id:memberId,jenis:kind,storage_path:path,file_name:file.name||clean,mime_type:file.type},{onConflict:'anggota_id,jenis'});
 if(metaErr){await sb.storage.from(PRIVATE_BUCKET).remove([path]);throw metaErr}
 if(old?.storage_path)await sb.storage.from(PRIVATE_BUCKET).remove([old.storage_path]);
}
async function viewPrivateDoc(memberId,kind){
 if(!admin)return alert('Dokumen hanya dapat dibuka oleh admin.');
 const doc=docsByMember[memberId]?.[kind];if(!doc)return alert('Dokumen belum diunggah.');
 const win=window.open('about:blank','_blank');
 const {data,error}=await sb.storage.from(PRIVATE_BUCKET).createSignedUrl(doc.storage_path,60);
 if(error){if(win)win.close();return alert('Dokumen tidak dapat dibuka: '+error.message)}
 if(win)win.location.href=data.signedUrl;else alert('Browser memblokir jendela dokumen. Izinkan pop-up lalu coba lagi.');
}
async function removePrivateDoc(memberId,kind){
 if(!admin||!confirm('Hapus dokumen '+kind.toUpperCase()+' ini?'))return;
 const doc=docsByMember[memberId]?.[kind];if(!doc)return;
 const {error:rmErr}=await sb.storage.from(PRIVATE_BUCKET).remove([doc.storage_path]);
 if(rmErr)return alert('Gagal menghapus file: '+rmErr.message);
 const {error}=await sb.from('dokumen_anggota').delete().eq('anggota_id',memberId).eq('jenis',kind);
 if(error)return alert('File sudah dihapus, tetapi metadata gagal dihapus: '+error.message);
 await loadPrivateDocs();render();
}
function privateDocRow(memberId,kind,label){
 const doc=docsByMember[memberId]?.[kind];
 return `<div class="doc-row"><div><b>${label}</b><div class="doc-status">${doc?'Sudah diterima · '+esc(doc.file_name):'Belum ada dokumen'}</div></div><div class="doc-actions">${doc?`<button class="btn sm" onclick="viewPrivateDoc('${memberId}','${kind}')">Lihat privat</button><button class="btn sm red" onclick="removePrivateDoc('${memberId}','${kind}')">Hapus</button>`:''}</div></div>`;
}
async function migrateLegacyKtaDocs(){
 if(!admin)return alert('Login admin diperlukan.');
 const legacy=Object.values(db).flat().filter(x=>legacyKtaByMember[x.id]);
 if(!legacy.length)return alert('Tidak ditemukan berkas KTA lama pada data anggota.');
 if(!confirm(`Ditemukan ${legacy.length} berkas KTA lama di penyimpanan publik. Pindahkan ke bucket privat dan hapus file publik lama? Proses ini berjalan satu per satu.`))return;
 let ok=0,failed=[],cleanupWarnings=[];
 for(const member of legacy){
  try{
   const legacyUrl=legacyKtaByMember[member.id];const response=await fetch(legacyUrl);if(!response.ok)throw new Error('File publik lama tidak dapat diunduh');
   const blob=await response.blob();const ext=(blob.type||'image/jpeg').includes('png')?'png':(blob.type||'').includes('pdf')?'pdf':'jpg';
   const path=`${member.id}/kta-migrasi-${Date.now()}.${ext}`;
   const {error:upErr}=await sb.storage.from(PRIVATE_BUCKET).upload(path,blob,{contentType:blob.type||'image/jpeg'});if(upErr)throw upErr;
   const {error:metaErr}=await sb.from('dokumen_anggota').upsert({anggota_id:member.id,jenis:'kta',storage_path:path,file_name:'KTA lama (migrasi)',mime_type:blob.type||'image/jpeg'},{onConflict:'anggota_id,jenis'});
   if(metaErr){await sb.storage.from(PRIVATE_BUCKET).remove([path]);throw metaErr}
   const {error:clearErr}=await sb.from('anggota').update({kta_img:null}).eq('id',member.id);if(clearErr)throw clearErr;
   try{const marker='/object/public/media/';const idx=legacyUrl.indexOf(marker);if(idx>=0){const oldPath=decodeURIComponent(legacyUrl.slice(idx+marker.length));const {error:removeErr}=await sb.storage.from('media').remove([oldPath]);if(removeErr)cleanupWarnings.push(member.nama+': '+removeErr.message)}else cleanupWarnings.push(member.nama+': lokasi file lama tidak dikenali; hapus manual dari bucket media')}catch(cleanErr){cleanupWarnings.push(member.nama+': '+(cleanErr.message||cleanErr))}
   ok++;
  }catch(e){failed.push(member.nama+': '+(e.message||e))}
 }
 await load();render();
 alert(`Migrasi selesai: ${ok} berhasil, ${failed.length} gagal, ${cleanupWarnings.length} perlu pemeriksaan penghapusan file publik.`+(failed.length?'\n\nGagal:\n'+failed.join('\n'):'')+(cleanupWarnings.length?'\n\nPemeriksaan manual:\n'+cleanupWarnings.join('\n'):''));
}
async function up(s){ // unggah gambar baru ke Storage, kembalikan URL publik
 if(!s||!s.startsWith('data:'))return s;
 const b=await (await fetch(s)).blob(),p=Date.now()+'-'+Math.random().toString(36).slice(2,8)+'.jpg';
 const {error}=await sb.storage.from('media').upload(p,b,{contentType:'image/jpeg'});if(error)throw error;
 return sb.storage.from('media').getPublicUrl(p).data.publicUrl;
}
function img(file,max){return new Promise(r=>{const f=new FileReader();f.onload=()=>{const i=new Image();i.onload=()=>{const s=Math.min(1,max/Math.max(i.width,i.height)),c=document.createElement('canvas');c.width=i.width*s;c.height=i.height*s;c.getContext('2d').drawImage(i,0,0,c.width,c.height);r(c.toDataURL('image/jpeg',.8))};i.src=f.result};f.readAsDataURL(file)})}

/* ---------- Navigasi ---------- */
function nav(){
 const items=[['dashboard','🏠  Beranda'],['siswa','🎓  Data Siswa'],['kader','🛡️  Data Kader'],['pendekar','🥋  Data Pendekar'],['pengaturan','⚙️  Pengaturan']];
 $('nav').innerHTML=items.map(([k,t])=>`<button class="${page===k?'on':''}" onclick="go('${k}')">${t}</button>`).join('');
 $('loginBtn').textContent=admin?'Keluar admin':'Masuk admin';
}
function go(p){page=p;side.classList.remove('open');nav();render();if(location.hash!=='#'+p)location.hash=p;window.scrollTo(0,0)}
$('loginBtn').onclick=async()=>{
 if(!sb)return alert('Aplikasi belum tersambung ke Supabase. Isi SUPABASE_URL dan SUPABASE_KEY di index.html.');
 if(admin){await sb.auth.signOut();return}
 $('dlg').innerHTML=`<div class="dh">Masuk admin</div><div class="db"><div class="f"><label class="w">Email<input id="le" type="email" autocomplete="username"></label><label class="w">Kata sandi<input id="lp" type="password" autocomplete="current-password" onkeydown="if(event.key==='Enter')doLogin()"></label></div></div><div class="df"><button class="btn red" onclick="dlg.close()">Batal</button><button class="btn" onclick="doLogin()">Masuk</button></div>`;
 $('dlg').showModal();
};
async function doLogin(){
 const {data,error}=await sb.auth.signInWithPassword({email:$('le').value.trim(),password:$('lp').value});
 if(error)return alert('Gagal masuk: '+error.message);
 if(!isAdminSession(data.session)){await sb.auth.signOut();return alert('Email ini tidak memiliki hak admin portal. Gunakan '+ADMIN_EMAIL+'.')}
 dlg.close();await load();nav();render();
}
if(sb)sb.auth.onAuthStateChange((_e,ses)=>{admin=isAdminSession(ses);if(!admin)docsByMember={};setTimeout(async()=>{await load();nav();render()},0)});
function render(){
 render0();
 if(!sb)$('view').insertAdjacentHTML('afterbegin','<div class="card" style="border-color:#a32a2a;margin-bottom:14px"><b>Aplikasi belum tersambung ke Supabase.</b> Isi SUPABASE_URL dan SUPABASE_KEY di index.html, lalu upload ulang ke GitHub.</div>');
}
function render0(){
 const a=$('actions');a.innerHTML='';
 if(page==='dashboard')return dash();
 if(page==='pengaturan')return settings();
 listView(page);
}

/* ---------- Beranda ---------- */
function dash(){
 $('title').textContent='Beranda';
 const tot=db.siswa.length+db.kader.length+db.pendekar.length;
 $('view').innerHTML=`
 <section class="portal-hero">
  <div class="hero-copy"><div class="hero-kicker">PESANTREN MODERN TA’DIB ALSYAKIRIN · SIMALUNGUN</div>
   <div class="hero-title">Selamat Datang di Portal<br>Data Anggota Tapak Suci</div>
   <div class="hero-desc">Pusat informasi dan pengelolaan data siswa, kader, serta pendekar Tapak Suci secara terintegrasi. Dokumen KTA dan ijazah disimpan privat dan hanya dapat diakses admin berwenang.</div>
  </div><img class="hero-mark" src="logo-persitas.svg" alt="Logo Tapak Suci">
 </section>
 <div class="section-head"><div><h3>Ringkasan Keanggotaan</h3><p>Ikhtisar jumlah data yang tercatat dalam sistem</p></div><span class="tag">DATA ANGGOTA</span></div>
 <div class="stats">
  <div class="stat"><b>${tot}</b><span>Total anggota terdaftar</span></div>
  ${['siswa','kader','pendekar'].map(t=>`<div class="stat" style="cursor:pointer" onclick="go('${t}')"><b>${db[t].length}</b><span>${NAMA[t]} <small style="display:block;font-size:10px;font-weight:500;color:#96a39c;margin-top:4px">Lihat data →</small></span></div>`).join('')}
 </div>
 <div class="section-head"><div><h3>Akses Cepat</h3><p>Pilih kategori data yang ingin dibuka</p></div></div>
 <div class="quick-grid">
  <button class="quick-card" onclick="go('siswa')"><span class="quick-icon">🎓</span><span><b>Data Siswa</b><small>Informasi siswa dan tingkatan</small></span></button>
  <button class="quick-card" onclick="go('kader')"><span class="quick-icon">🛡️</span><span><b>Data Kader</b><small>Informasi kader dan jenjang</small></span></button>
  <button class="quick-card" onclick="go('pendekar')"><span class="quick-icon">🥋</span><span><b>Data Pendekar</b><small>Informasi pendekar dan KTA</small></span></button>
 </div>
 <div class="card level-card"><h3>Distribusi Tingkatan</h3><div class="tw"><table><tr><th>Jenjang</th><th>Tingkatan</th><th>Jumlah anggota</th></tr>
 ${['siswa','kader','pendekar'].map(t=>LV[t].map(l=>`<tr><td>${NAMA[t]}</td><td>${esc(l)}</td><td>${db[t].filter(x=>x.tingkat===l).length}</td></tr>`).join('')).join('')}</table></div></div>`;
}

/* ---------- Daftar anggota ---------- */
function listView(t){
 $('title').textContent='Data '+NAMA[t];
 if(admin)$('actions').innerHTML=`<button class="btn" onclick="openForm('${t}')">+ Tambah ${NAMA[t]}</button><button class="btn gold" onclick="tpl('${t}')">Template Excel</button><button class="btn gold" onclick="impIn.dataset.t='${t}';impIn.click()">Impor Excel</button><button class="btn gold" onclick="exp('${t}')">Ekspor</button><input type="file" id="impIn" accept=".xlsx,.xls,.csv" hidden onchange="imp(this)">`;
 else $('actions').innerHTML=`<button class="btn gold" onclick="exp('${t}')">Ekspor Excel</button>`;
 $('view').innerHTML=`<div class="card"><div class="bar"><input id="q" placeholder="Cari nama, alamat, atau kode KTA..." oninput="tampilRows('${t}')"><select id="fl" onchange="tampilRows('${t}')"><option value="">Semua tingkatan</option>${LV[t].map(l=>`<option>${esc(l)}</option>`).join('')}</select></div><div class="tw" id="tbl"></div></div>`;
 tampilRows(t);
}
function tampilRows(t){
 const q=($('q').value||'').toLowerCase(),f=$('fl').value;
 const d=db[t].filter(x=>(!f||x.tingkat===f)&&[x.nama,x.alamat,x.kta].join(' ').toLowerCase().includes(q));
 $('tbl').innerHTML=d.length?`<table><tr><th>No</th><th>Foto</th><th>Nama</th><th>L/P</th><th>Masuk</th><th>Tingkatan terakhir</th><th>KTA</th><th>Aksi</th></tr>${d.map((x,i)=>`<tr>
 <td>${i+1}</td><td>${x.foto?`<img class="av" src="${x.foto}" alt="">`:'<div class="av"></div>'}</td><td><b>${esc(x.nama)}</b></td><td>${x.jk==='Laki-laki'?'L':'P'}</td><td>${esc(x.tahun)}</td><td><span class="tag">${esc(x.tingkat)}</span></td>
 <td>${esc(x.kta||'-')}</td>
 <td style="white-space:nowrap"><button class="btn sm" onclick="detail('${t}','${x.id}')">Detail</button>${admin?` <button class="btn sm gold" onclick="openForm('${t}','${x.id}')">Ubah</button> <button class="btn sm red" onclick="del('${t}','${x.id}')">Hapus</button>`:''}</td></tr>`).join('')}</table>`:`<div class="empty">Belum ada data ${NAMA[t].toLowerCase()}.${admin?' Klik "Tambah" atau "Impor Excel".':' Admin dapat menambahkan data setelah masuk.'}</div>`;
}

/* ---------- Detail ---------- */
function detail(t,id){
 const x=db[t].find(a=>a.id===id);
 const docs=(admin&&(t==='kader'||t==='pendekar'))?`<section class="doc-panel"><h4>Dokumen resmi · akses admin</h4><p class="private-note">KTA dan ijazah diterbitkan oleh Pimpinan Pusat. Portal hanya menyimpan salinan unggahan. Dokumen tidak tersedia untuk pengunjung.</p>${privateDocRow(id,'kta','Kartu Tanda Anggota (KTA)')}${privateDocRow(id,'ijazah','Ijazah')}</section>`:'';
 $('dlg').innerHTML=`<div class="dh">${esc(x.nama)}</div><div class="db">
 <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:12px">${x.foto?`<img src="${x.foto}" style="width:120px;height:150px;object-fit:cover;border-radius:10px;border:3px solid var(--gold)" alt="">`:''}
 <div class="dt" style="flex:1;min-width:220px"><span>Jenjang</span><span>${NAMA[t]}</span><span>Jenis kelamin</span><span>${esc(x.jk)}</span><span>Tahun masuk</span><span>${esc(x.tahun)}</span><span>Tingkatan terakhir</span><span>${esc(x.tingkat)}</span><span>Kode/No. KTA</span><span>${esc(x.kta||'-')}</span><span>Alamat</span><span>${esc(x.alamat||'-')}</span><span>No. kontak</span><span>${esc(x.kontak||'-')}</span></div></div>
 ${docs}
 ${(x.keg||[]).length?`<b>Foto kegiatan</b><div class="gal">${x.keg.map(s=>`<div><img src="${s}" onclick="window.open(this.src)" alt="Kegiatan"></div>`).join('')}</div>`:''}
 </div><div class="df"><button class="btn" onclick="dlg.close()">Tutup</button></div>`;
 $('dlg').showModal();
}

/* ---------- Form tambah/ubah ---------- */
function openForm(t,id){
 const x=id?db[t].find(a=>a.id===id):{};
 cur={t,id,foto:x.foto||'',ktaImg:'',keg:[...(x.keg||[])],docFiles:{kta:null,ijazah:null}};
 const sis=t==='siswa',docEnabled=(t==='kader'||t==='pendekar');
 const existing=id&&docsByMember[id]?docsByMember[id]:{};
 const docFields=docEnabled?`<section class="doc-panel"><h4>Dokumen resmi Pimpinan Pusat</h4><p class="private-note">Unggah salinan KTA dan ijazah yang sudah diterbitkan Pimpinan Pusat. File disimpan privat; pengunjung tidak dapat melihat atau mengunduhnya. Format PDF/JPG/PNG, maksimal 10 MB per file.</p>
 <label class="w">Upload KTA resmi<input type="file" accept="application/pdf,image/jpeg,image/png" onchange="cur.docFiles.kta=this.files[0]||null"><span class="doc-status">${existing.kta?'Dokumen sudah tersimpan secara privat: '+esc(existing.kta.file_name):'Belum ada KTA'}</span></label>
 <label class="w">Upload ijazah resmi<input type="file" accept="application/pdf,image/jpeg,image/png" onchange="cur.docFiles.ijazah=this.files[0]||null"><span class="doc-status">${existing.ijazah?'Dokumen sudah tersimpan secara privat: '+esc(existing.ijazah.file_name):'Belum ada ijazah'}</span></label>
 </section>`:'';
 $('dlg').innerHTML=`<div class="dh">${id?'Ubah':'Tambah'} ${NAMA[t]}</div><div class="db"><div class="f">
 <label class="w">Nama lengkap<input id="fn" value="${esc(x.nama)}"></label>
 <label>Jenis kelamin<select id="fj"><option>Laki-laki</option><option ${x.jk==='Perempuan'?'selected':''}>Perempuan</option></select></label>
 <label>Tahun masuk Tapak Suci<input id="ft" type="number" min="1963" max="2100" value="${esc(x.tahun||new Date().getFullYear())}"></label>
 <label class="w">Tingkatan terakhir<select id="fl2">${LV[t].map(l=>`<option ${x.tingkat===l?'selected':''}>${esc(l)}</option>`).join('')}</select></label>
 <label class="w">${sis?'Kode KTA (diisi manual oleh admin)':'No. KTA resmi (diterbitkan Pimpinan Pusat)'}<input id="fk" value="${esc(x.kta)}" placeholder="Nomor KTA bila tersedia"></label>
 <label class="w">Alamat<input id="fa" value="${esc(x.alamat)}"></label>
 <label class="w">No. kontak<input id="fc" value="${esc(x.kontak)}" inputmode="tel"></label>
 <label class="w">Foto anggota<input type="file" accept="image/*" onchange="pick(this,'foto',400)"><img id="pf" class="pv" style="display:${cur.foto?'block':'none'};max-height:120px" src="${cur.foto}" alt=""></label>
 ${docFields}
 <label class="w">Foto kegiatan (boleh banyak)<input type="file" accept="image/*" multiple onchange="addKeg(this)"><div class="gal" id="gk"></div></label>
 </div></div><div class="df"><button class="btn red" onclick="dlg.close()">Batal</button><button class="btn" onclick="saveF()">Simpan</button></div>`;
 gk();$('dlg').showModal();
}
async function pick(el,k,max){if(!el.files[0])return;cur[k]=await img(el.files[0],max);const p=$(k==='foto'?'pf':'pk');p.src=cur[k];p.style.display='block'}
async function addKeg(el){for(const f of el.files)cur.keg.push(await img(f,800));el.value='';gk()}
function gk(){$('gk').innerHTML=cur.keg.map((s,i)=>`<div><img src="${s}" alt=""><button type="button" onclick="cur.keg.splice(${i},1);gk()" title="Hapus">×</button></div>`).join('')}
async function saveF(){
 const nama=$('fn').value.trim();if(!nama)return alert('Nama wajib diisi.');
 const btn=document.querySelector('#dlg .df .btn:last-child');btn.disabled=true;btn.textContent='Menyimpan...';
 try{
  const r={nama,jk:$('fj').value,tahun:$('ft').value,tingkat:$('fl2').value,kta:$('fk').value.trim(),alamat:$('fa').value.trim(),kontak:$('fc').value.trim(),foto:await up(cur.foto),keg:await Promise.all(cur.keg.map(up))};
  let memberId=cur.id;
  if(cur.id){const {error}=await sb.from('anggota').update(toRow(cur.t,r)).eq('id',cur.id);if(error)throw error;}
  else {const {data,error}=await sb.from('anggota').insert(toRow(cur.t,r)).select('id').single();if(error)throw error;memberId=data.id;}
  if(cur.docFiles&&(cur.docFiles.kta||cur.docFiles.ijazah)){
   if(!admin)throw new Error('Login admin diperlukan untuk menyimpan dokumen.');
   if(cur.docFiles.kta)await uploadPrivateDoc(memberId,'kta',cur.docFiles.kta);
   if(cur.docFiles.ijazah)await uploadPrivateDoc(memberId,'ijazah',cur.docFiles.ijazah);
  }
  await load();dlg.close();render();
 }catch(e){alert('Gagal menyimpan: '+(e.message||e));btn.disabled=false;btn.textContent='Simpan'}
}
async function del(t,id){
 if(!confirm('Hapus data ini?'))return;
 const {error}=await sb.from('anggota').delete().eq('id',id);
 if(error)return alert('Gagal menghapus: '+error.message);
 await load();render();
}
/* ---------- Excel ---------- */
const HEAD=['Nama','Jenis Kelamin','Tahun Masuk','Tingkatan Terakhir','Kode/No KTA','Alamat','No Kontak'];
function tpl(t){
 const wb=XLSX.utils.book_new();
 const ws=XLSX.utils.aoa_to_sheet([HEAD,['Contoh Nama','Laki-laki',2024,LV[t][0],'','Simalungun','08123456789']]);
 ws['!cols']=HEAD.map(()=>({wch:24}));
 XLSX.utils.book_append_sheet(wb,ws,'Data');
 XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([['Tingkatan yang berlaku'],...LV[t].map(l=>[l]),[],['Jenis Kelamin: Laki-laki / Perempuan']]),'Petunjuk');
 XLSX.writeFile(wb,`Template_${NAMA[t]}_TapakSuci.xlsx`);
}
function exp(t){
 const ws=XLSX.utils.aoa_to_sheet([HEAD,...db[t].map(x=>[x.nama,x.jk,x.tahun,x.tingkat,x.kta,x.alamat,x.kontak])]);
 const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,NAMA[t]);XLSX.writeFile(wb,`Data_${NAMA[t]}_TapakSuci.xlsx`);
}
function imp(el){
 const t=el.dataset.t,f=el.files[0];if(!f)return;
 const rd=new FileReader();
 rd.onload=async()=>{
  const wb=XLSX.read(rd.result,{type:'array'}),rs=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:''}),arr=[];
  for(const r of rs){
   const nama=String(r['Nama']||'').trim();if(!nama)continue;
   const v=String(r['Tingkatan Terakhir']||'').trim().toLowerCase();
   const tk=LV[t].find(l=>l.toLowerCase()===v)||(v&&LV[t].find(l=>l.toLowerCase().includes(v)))||LV[t][0];
   arr.push(toRow(t,{nama,jk:/^p/i.test(r['Jenis Kelamin'])?'Perempuan':'Laki-laki',tahun:r['Tahun Masuk'],tingkat:tk,kta:String(r['Kode/No KTA']||''),alamat:String(r['Alamat']||''),kontak:String(r['No Kontak']||'')}));
  }
  el.value='';
  if(!arr.length)return alert('Tidak ada baris data yang bisa diimpor.');
  const {error}=await sb.from('anggota').insert(arr);
  if(error)return alert('Gagal impor: '+error.message);
  alert(arr.length+' data berhasil diimpor.');await load();render();
 };
 rd.readAsArrayBuffer(f);
}

/* ---------- Pengaturan ---------- */
async function settings(){
 $('title').textContent='Pengaturan';
 if(!admin){$('view').innerHTML='<div class="card empty">Masuk sebagai admin untuk membuka pengaturan.</div>';return}
 const {data}=await sb.auth.getUser();
 $('view').innerHTML=`<div class="card"><h3 style="margin-top:0">Akun admin</h3><p>Masuk sebagai <b>${esc(data.user?.email)}</b></p><button class="btn" onclick="cp()">Ganti kata sandi</button><section class="doc-panel"><h4>Keamanan dokumen KTA lama</h4><p class="private-note">Jika sebelumnya pernah mengunggah KTA melalui versi lama, file itu mungkin masih berada di bucket publik <b>media</b>. Jalankan migrasi ini setelah SQL dokumen privat dipasang. Sistem akan memindahkan KTA lama ke bucket privat, menghapus rujukan publik, lalu mencoba menghapus file publik aslinya.</p><button class="btn gold" onclick="migrateLegacyKtaDocs()">Pindahkan KTA lama ke penyimpanan privat</button></section></div>`;
}
async function cp(){
 const p=prompt('Kata sandi baru (min. 6 karakter):');if(!p||p.length<6)return;
 const {error}=await sb.auth.updateUser({password:p});alert(error?'Gagal: '+error.message:'Kata sandi diganti.');
}

/* ---------- Tombol kembali & navigasi riwayat ---------- */
const PAGES=['dashboard','siswa','kader','pendekar','pengaturan'];
function backBtn(){if(page!=='dashboard')$('actions').insertAdjacentHTML('afterbegin','<button class="btn gold" onclick="go(\'dashboard\')">&larr; Kembali ke Beranda</button>')}
const _render=render;render=function(){_render();backBtn()};
window.addEventListener('hashchange',()=>{const p=location.hash.slice(1);if(PAGES.includes(p)&&p!==page){page=p;nav();render()}});
{const h=location.hash.slice(1);if(PAGES.includes(h))page=h}

if($('yearNow'))$('yearNow').textContent=new Date().getFullYear();
(async()=>{nav();render();await load();render()})();
