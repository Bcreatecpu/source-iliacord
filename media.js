import express from 'express';
import {randomBytes} from 'node:crypto';
export const MAX_MEDIA=12*1024*1024;
const MAX_TOTAL=200*1024*1024;
const types=new Set(['image/png','image/jpeg','image/webp','image/gif','video/mp4','video/webm','video/quicktime','audio/webm','audio/ogg','audio/mp4','audio/mpeg','audio/wav']);
export async function installMedia(app,db,validRoom){
 await db.executeMultiple(`CREATE TABLE IF NOT EXISTS media(id TEXT PRIMARY KEY,uid TEXT,room TEXT,name TEXT,mime TEXT,size INTEGER,ready INTEGER DEFAULT 0,created INTEGER);
 CREATE TABLE IF NOT EXISTS media_chunks(mid TEXT,part INTEGER,data TEXT,PRIMARY KEY(mid,part));`);
 // Stale unfinished uploads were never visible to recipients.
 await db.execute('DELETE FROM media_chunks WHERE mid IN (SELECT id FROM media WHERE ready=0 AND created<?)',[Date.now()-86400000]);
 await db.execute('DELETE FROM media WHERE ready=0 AND created<?',[Date.now()-86400000]);
 let uploadTail=Promise.resolve();
 app.post('/api/media',express.raw({type:'application/octet-stream',limit:MAX_MEDIA}),async(req,res)=>{
  const room=String(req.query.room||''),mime=String(req.query.mime||'').split(';')[0].toLowerCase(),name=String(req.query.name||'arquivo').slice(0,120);
  if(!await validRoom(req.user.id,room))return res.sendStatus(403);
  if(!types.has(mime)||!Buffer.isBuffer(req.body)||!req.body.length)return res.status(400).json({error:'Formato não suportado. Envie imagem, vídeo ou áudio.'});
  const bytes=req.body;
  const perform=async()=>{
   const total=Number((await db.execute('SELECT COALESCE(SUM(size),0) AS size FROM media')).rows[0].size);
   if(total+bytes.length>MAX_TOTAL)return res.status(413).json({error:'O armazenamento de anexos está cheio (200 MB). Apague anexos antigos para liberar espaço.'});
   const id=randomBytes(12).toString('hex');
   await db.execute('INSERT INTO media VALUES(?,?,?,?,?,?,0,?)',[id,req.user.id,room,name,mime,bytes.length,Date.now()]);
   try{
    let batch=[];
    for(let offset=0,part=0;offset<bytes.length;offset+=192*1024,part++){
     batch.push({sql:'INSERT INTO media_chunks VALUES(?,?,?)',args:[id,part,bytes.subarray(offset,offset+192*1024).toString('base64')]});
     if(batch.length===4){await db.batch(batch);batch=[];}
    }
    if(batch.length)await db.batch(batch);
    await db.execute('UPDATE media SET ready=1 WHERE id=?',[id]);
    res.json({id,name,mime,size:bytes.length});
   }catch(e){await db.execute('DELETE FROM media_chunks WHERE mid=?',[id]);await db.execute('DELETE FROM media WHERE id=?',[id]);throw e;}
  };
  const task=uploadTail.then(perform);uploadTail=task.catch(()=>{});await task;
 });
 app.get('/api/media/:id',async(req,res)=>{
  const m=(await db.execute('SELECT * FROM media WHERE id=? AND ready=1',[req.params.id])).rows[0];
  if(!m||!await validRoom(req.user.id,m.room))return res.sendStatus(404);
  const rows=(await db.execute('SELECT data FROM media_chunks WHERE mid=? ORDER BY part',[m.id])).rows;
  res.set({'Cache-Control':'private,no-store','X-Content-Type-Options':'nosniff','Content-Disposition':`inline; filename*=UTF-8''${encodeURIComponent(m.name)}`}).type(m.mime).send(Buffer.concat(rows.map(r=>Buffer.from(r.data,'base64'))));
 });
 app.delete('/api/media/:id',async(req,res)=>{
  const m=(await db.execute('SELECT id FROM media WHERE id=? AND uid=?',[req.params.id,req.user.id])).rows[0];
  if(!m)return res.sendStatus(404);
  await db.batch([{sql:'DELETE FROM media_chunks WHERE mid=?',args:[m.id]},{sql:'DELETE FROM media WHERE id=?',args:[m.id]}]);res.json({ok:true});
 });
}
