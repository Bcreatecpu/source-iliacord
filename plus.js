import {randomUUID} from 'node:crypto';
import {PLUS_ITEMS,PLUS_COMBOS} from './public/plus-catalog.js';
export async function migratePlus(db){
 await db.executeMultiple('CREATE TABLE IF NOT EXISTS profile_banners(id TEXT,part INTEGER,data TEXT,mime TEXT,PRIMARY KEY(id,part));');
 const cols=(await db.execute('PRAGMA table_info(users)')).rows.map(c=>c.name);
 for(const [name,def] of [['banner',"''"],['color2',"'#232528'"],['gradientAngle','135'],['profileEffect',"'none'"],['nameEffect',"'none'"]]){
  if(!cols.includes(name))await db.execute(`ALTER TABLE users ADD COLUMN ${name} ${name==='gradientAngle'?'INTEGER':'TEXT'} DEFAULT ${def}`);
 }
 await db.executeMultiple('CREATE TABLE IF NOT EXISTS plus_inventory(uid TEXT,combo TEXT,acquired INTEGER,PRIMARY KEY(uid,combo));');
}
export function installPlus(app,db,io){
 app.get('/profile-banners/:id',async(req,res)=>{const rows=(await db.execute('SELECT data,mime FROM profile_banners WHERE id=? ORDER BY part',[req.params.id])).rows;if(!rows.length)return res.sendStatus(404);res.set('Cache-Control','public,max-age=31536000,immutable').type(rows[0].mime).send(Buffer.from(rows.map(r=>r.data).join(''),'base64'));});
 const owned=async uid=>(await db.execute('SELECT combo FROM plus_inventory WHERE uid=?',[uid])).rows.map(r=>r.combo);
 app.get('/api/plus',async(req,res)=>res.json({owned:await owned(req.user.id)}));
 app.post('/api/plus/acquire',async(req,res)=>{
  const combo=PLUS_COMBOS.find(c=>c.id===req.body.combo);if(!combo)return res.status(400).json({error:'Combo não encontrado.'});
  await db.execute('INSERT OR IGNORE INTO plus_inventory VALUES(?,?,?)',[req.user.id,combo.id,Date.now()]);
  res.json({owned:await owned(req.user.id)});
 });
 app.patch('/api/appearance',async(req,res)=>{
  const b=req.body, inventory=await owned(req.user.id);
  const items=new Set(PLUS_COMBOS.filter(c=>inventory.includes(c.id)).flatMap(c=>c.items));
  const fields={};
  for(const slot of ['decoration','profileEffect','nameEffect']){
   const value=String(b[slot]??req.user[slot]??'none');
   if(!['none',...(slot==='decoration'?['orbit','glow']:[])].includes(value)&&(!items.has(value)||PLUS_ITEMS[value]?.slot!==slot))return res.status(403).json({error:'Adquira esse item gratuito no Ilia Plus antes de equipar.'});
   fields[slot]=value;
  }
  let banner=String(b.banner??req.user.banner??'');
  if(banner.length>11200000||(banner&&banner!==req.user.banner&&!/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(banner)))return res.status(400).json({error:'Banner inválido. Use uma imagem ou GIF de até 8 MB.'});
  for(const field of ['color','color2']){fields[field]=String(b[field]??req.user[field]??'#232528');if(!/^#[0-9a-f]{6}$/i.test(fields[field]))return res.status(400).json({error:'Cor inválida.'});}
  const angle=Number(b.gradientAngle??req.user.gradientAngle??135);if(!Number.isFinite(angle)||angle<0||angle>360)return res.status(400).json({error:'Ângulo inválido.'});
  if(banner.startsWith('data:')){const [header,data]=banner.split(',');const id=randomUUID(),mime=header.slice(5).split(';')[0];try{for(let offset=0;offset<data.length;offset+=800000){const batch=[];for(let sub=offset;sub<Math.min(offset+800000,data.length);sub+=200000)batch.push({sql:'INSERT INTO profile_banners VALUES(?,?,?,?)',args:[id,sub/200000,data.slice(sub,sub+200000),mime]});await db.batch(batch);}}catch(e){await db.execute('DELETE FROM profile_banners WHERE id=?',[id]);throw e;}banner='/profile-banners/'+id;}
  await db.execute('UPDATE users SET decoration=?,profileEffect=?,nameEffect=?,banner=?,color=?,color2=?,gradientAngle=? WHERE id=?',[fields.decoration,fields.profileEffect,fields.nameEffect,banner,fields.color,fields.color2,Math.round(angle),req.user.id]);
  io.emit('refresh');res.json({ok:true});
 });
}
