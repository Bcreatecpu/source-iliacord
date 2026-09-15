const escape = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function installInvites(app,db,io,getUser){
 await db.executeMultiple('CREATE TABLE IF NOT EXISTS server_icons(sid TEXT PRIMARY KEY,image TEXT NOT NULL);');
 const get=async(sql,args)=>(await db.execute(sql,args)).rows;
 async function preview(code){
  if(!/^[a-f0-9]{24}$/.test(code))return null;
  const [s]=await get('SELECT id,name FROM servers WHERE invite=?',[code]);if(!s)return null;
  const members=await get('SELECT uid FROM members WHERE sid=?',[s.id]);
  const onlineIds=new Set([...io.sockets.sockets.values()].map(s=>s.data.user?.id));
  const online=members.filter(m=>onlineIds.has(m.uid)).length;
  const [photo]=await get('SELECT image FROM server_icons WHERE sid=?',[s.id]);
  return {name:s.name,code,online,offline:members.length-online,total:members.length,photo:photo?.image||''};
 }
 app.get('/api/invites/:code',async(req,res)=>{const s=await preview(req.params.code);res.set('Cache-Control','no-store');if(!s)return res.status(404).json({error:'Convite inválido ou indisponível.'});res.json(s);});
 app.patch('/api/server-icons/:sid',async(req,res)=>{
  const u=await getUser(req.headers.authorization?.replace('Bearer ',''));if(!u)return res.sendStatus(401);
  if(!(await get('SELECT id FROM servers WHERE id=? AND owner=?',[req.params.sid,u.id])).length)return res.sendStatus(403);
  const image=String(req.body.image||'');
  if(image.length>700000||!/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(image))return res.status(400).json({error:'Escolha uma imagem PNG, JPG, WebP ou GIF de até 500 KB.'});
  await db.execute('INSERT INTO server_icons(sid,image) VALUES(?,?) ON CONFLICT(sid) DO UPDATE SET image=excluded.image',[req.params.sid,image]);
  res.json({ok:true});
 });
 app.get('/invite/:code/icon',async(req,res)=>{const s=await preview(req.params.code);if(!s?.photo)return res.redirect('/icon-512.png');const [,type,data]=s.photo.match(/^data:(image\/[^;]+);base64,(.+)$/);res.set('Cache-Control','public,max-age=60').type(type).send(Buffer.from(data,'base64'));});
 app.get('/invite/:code',async(req,res)=>{
  const s=await preview(req.params.code);res.set('Cache-Control','no-store');
  if(!s)return res.status(404).type('html').send('<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Convite indisponível</title><body><h1>Convite inválido ou indisponível</h1><a href="/">Abrir IliaCord</a></body></html>');
  const origin=(process.env.PUBLIC_SITE_URL||process.env.RENDER_EXTERNAL_URL||`http://localhost:${process.env.PORT||3000}`).replace(/\/$/,'');
  const counts=`${s.online} online · ${s.offline} offline · ${s.total} membros`;
  res.type('html').send(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(s.name)} · Convite IliaCord</title><meta property="og:type" content="website"><meta property="og:title" content="${escape(s.name)}"><meta property="og:description" content="${escape(counts)} — Entre no servidor pelo IliaCord."><meta property="og:image" content="${escape(origin)}/invite/${s.code}/icon"><meta property="og:url" content="${escape(origin)}/invite/${s.code}"><link rel="stylesheet" href="/style.css"></head><body><main class="invite-page"><article class="invite-card"><small>CONVITE PARA SERVIDOR</small><img class="invite-photo" src="/invite/${s.code}/icon" alt="Foto do servidor"><h1>${escape(s.name)}</h1><p id="invite-counts">${escape(counts)}</p><a class="primary invite-enter" href="/?invite=${s.code}">Entrar no servidor</a><p><small>Faça login ou crie sua conta para participar.</small></p></article></main><script src="/invite-page.js" defer></script></body></html>`);
 });
}
