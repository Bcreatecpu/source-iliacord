import {migratePlus,installPlus} from './plus.js';
import {installMedia} from './media.js';
import {installInvites} from './invites.js';
import express from 'express';
import { createServer } from 'node:http';
import { openDatabase } from './database.js';
import { randomBytes, scrypt as scryptCb, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { Server } from 'socket.io';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
const scrypt = promisify(scryptCb),
  app = express(),
  http = createServer(app);
if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);
const origins = [process.env.RENDER_EXTERNAL_URL, ...(process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(',')].filter(Boolean).map(o => o.trim().replace(/\/$/, ''));
const io = new Server(http, {
  cors: {
    origin: origins
  },
  maxHttpBufferSize: 1200000
});
const db = openDatabase();
app.get('/health', async (req, res) => {
  try {
    await db.execute('SELECT 1');
    res.json({
      status: 'ok'
    });
  } catch {
    res.status(503).json({
      status: 'unavailable'
    });
  }
});
await db.executeMultiple(`
CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,name TEXT UNIQUE COLLATE NOCASE,salt TEXT,hash TEXT,display TEXT,pronouns TEXT DEFAULT '',bio TEXT DEFAULT '',avatar TEXT DEFAULT '',color TEXT DEFAULT '#8da9ff',decoration TEXT DEFAULT 'orbit',status TEXT DEFAULT 'Disponível');
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,uid TEXT,expires INTEGER);
CREATE TABLE IF NOT EXISTS friends(sender TEXT,receiver TEXT,status TEXT,PRIMARY KEY(sender,receiver));
CREATE TABLE IF NOT EXISTS servers(id TEXT PRIMARY KEY,name TEXT,owner TEXT,invite TEXT UNIQUE);
CREATE TABLE IF NOT EXISTS members(sid TEXT,uid TEXT,PRIMARY KEY(sid,uid));
CREATE TABLE IF NOT EXISTS channels(id TEXT PRIMARY KEY,sid TEXT,name TEXT,type TEXT);
CREATE TABLE IF NOT EXISTS messages(id TEXT PRIMARY KEY,room TEXT,uid TEXT,body TEXT,created INTEGER);
CREATE INDEX IF NOT EXISTS room_messages ON messages(room,created);
CREATE TABLE IF NOT EXISTS reactions(mid TEXT,uid TEXT,emoji TEXT,PRIMARY KEY(mid,uid,emoji));`);
await migratePlus(db);
if(!(await db.execute('PRAGMA table_info(messages)')).rows.some(c=>c.name==='attachments'))await db.execute("ALTER TABLE messages ADD COLUMN attachments TEXT DEFAULT '[]'");
const one = async (q, ...p) => (await db.execute(q, p)).rows[0],
  all = async (q, ...p) => (await db.execute(q, p)).rows,
  run = async (q, ...p) => db.execute(q, p),
  id = () => randomBytes(12).toString('hex');
const publicUser = u => u && Object.fromEntries(Object.entries(u).filter(([k]) => !['salt', 'hash'].includes(k)));
const digest = t => createHash('sha256').update(t).digest('hex');
const getUser = async t => publicUser(await one('SELECT users.* FROM sessions JOIN users ON users.id=sessions.uid WHERE token=? AND expires>?', digest(t || ''), Date.now()));
const validRoom = async (uid, r) => {
  const c = await one('SELECT * FROM channels WHERE id=?', r);
  if (c) return !!(await one('SELECT 1 FROM members WHERE sid=? AND uid=?', c.sid, uid));
  const parts = r.split(':');
  return parts.length === 3 && parts[0] === 'dm' && parts.slice(1).includes(uid) && !!(await one("SELECT 1 FROM friends WHERE status='accepted' AND ((sender=? AND receiver=?) OR (receiver=? AND sender=?))", parts[1], parts[2], parts[1], parts[2]));
};
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: {
    policy: 'cross-origin'
  }
}));
app.use((req, res, next) => {
  const o = req.headers.origin;
  if (o && origins.includes(o)) {
    res.setHeader('Access-Control-Allow-Origin', o);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use(express.json({
  limit: '2mb'
}));
app.use('/api', rateLimit({
  windowMs: 60000,
  limit: 180
}));
await installInvites(app,db,io,getUser);
app.post('/api/auth', rateLimit({
  windowMs: 900000,
  limit: 30
}), async (req, res, next) => {
  try {
    const {
      name,
      password,
      register
    } = req.body;
    if (!/^[a-zA-Z0-9_]{3,24}$/.test(name || '') || typeof password !== 'string' || password.length < 8 || password.length > 128) return res.status(400).json({
      error: 'Use nome com 3–24 letras, números ou _ e senha de 8–128 caracteres.'
    });
    let u = await one('SELECT * FROM users WHERE name=?', name);
    if (register) {
      if (u) return res.status(409).json({
        error: 'Esse nome já está em uso.'
      });
      const salt = id(),
        hash = (await scrypt(password, salt, 64)).toString('hex');
      await run('INSERT INTO users(id,name,salt,hash,display) VALUES(?,?,?,?,?)', id(), name, salt, hash, name);
      u = await one('SELECT * FROM users WHERE name=?', name);
    } else {
      const hash = await scrypt(password, u?.salt || 'unknown', 64);
      if (!u || !timingSafeEqual(hash, Buffer.from(u.hash, 'hex'))) return res.status(401).json({
        error: 'Nome ou senha incorretos.'
      });
    }
    const token = randomBytes(32).toString('hex');
    await run('DELETE FROM sessions WHERE expires<?', Date.now());
    await run('INSERT INTO sessions VALUES(?,?,?)', digest(token), u.id, Date.now() + 7 * 86400000);
    res.json({
      token,
      user: publicUser(u)
    });
  } catch (e) {
    next(e);
  }
});
app.use('/api', async (req, res, next) => {
  req.user = await getUser(req.headers.authorization?.replace('Bearer ', ''));
  if (!req.user) return res.status(401).json({
    error: 'Entre na sua conta.'
  });
  next();
});
installPlus(app,db,io);
await installMedia(app,db,validRoom);
app.post('/api/logout', async (req, res) => {
  await run('DELETE FROM sessions WHERE token=?', digest(req.headers.authorization.replace('Bearer ', '')));
  for (const s of io.sockets.sockets.values()) if (s.data.token === req.headers.authorization.replace('Bearer ', '')) s.disconnect();
  res.json({
    ok: true
  });
});
app.get('/api/state', async (req, res) => {
  const uid = req.user.id;
  res.json({
    user: req.user,
    servers: await all('SELECT servers.*, server_icons.image AS photo FROM servers JOIN members ON servers.id=members.sid LEFT JOIN server_icons ON server_icons.sid=servers.id WHERE uid=?', uid),
    channels: await all('SELECT channels.* FROM channels JOIN members ON channels.sid=members.sid WHERE uid=?', uid),
    friends: await Promise.all((await all('SELECT * FROM friends WHERE sender=? OR receiver=?', uid, uid)).map(async f => ({
      ...f,
      user: publicUser(await one('SELECT * FROM users WHERE id=?', f.sender === uid ? f.receiver : f.sender))
    }))),
    online: [...new Set([...io.sockets.sockets.values()].map(s => s.data.user.id))]
  });
});
app.patch('/api/profile', async (req, res) => {
  const b = req.body;
  const avatar = String(b.avatar || '');
  if (avatar && !/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(avatar)) return res.status(400).json({
    error: 'Imagem inválida.'
  });
  if (avatar.length > 700000) return res.status(400).json({
    error: 'Escolha uma imagem de até 500 KB.'
  });
  await run('UPDATE users SET display=?,pronouns=?,bio=?,avatar=?,color=?,decoration=?,status=? WHERE id=?', String(b.display || req.user.name).slice(0, 40), String(b.pronouns || '').slice(0, 30), String(b.bio || '').slice(0, 240), avatar, /^#[0-9a-f]{6}$/i.test(b.color) ? b.color : '#8da9ff', req.user.decoration || 'none', String(b.status || 'Disponível').slice(0, 60), req.user.id);
  io.emit('refresh');
  res.json({
    ok: true
  });
});
app.post('/api/friends', async (req, res) => {
  const target = await one('SELECT id FROM users WHERE name=?', String(req.body.name || ''));
  if (!target || target.id === req.user.id) return res.status(400).json({
    error: 'Conta não encontrada ou é a sua própria conta.'
  });
  if (await one('SELECT 1 FROM friends WHERE (sender=? AND receiver=?) OR (sender=? AND receiver=?)', req.user.id, target.id, target.id, req.user.id)) return res.status(409).json({
    error: 'Vocês já têm amizade ou um pedido pendente.'
  });
  await run('INSERT INTO friends VALUES(?,?,?)', req.user.id, target.id, 'pending');
  io.emit('refresh');
  res.json({
    ok: true
  });
});
app.post('/api/friends/respond', async (req, res) => {
  if (req.body.accept) await run("UPDATE friends SET status='accepted' WHERE sender=? AND receiver=?", req.body.uid, req.user.id);else await run('DELETE FROM friends WHERE (sender=? AND receiver=?) OR (sender=? AND receiver=?)', req.body.uid, req.user.id, req.user.id, req.body.uid);
  io.emit('refresh');
  res.json({
    ok: true
  });
});
app.post('/api/servers', async (req, res) => {
  const name = String(req.body.name || '').trim().slice(0, 48);
  if (!name) return res.status(400).json({
    error: 'Dê um nome ao servidor.'
  });
  const sid = id();
  await run('INSERT INTO servers VALUES(?,?,?,?)', sid, name, req.user.id, id());
  await run('INSERT INTO members VALUES(?,?)', sid, req.user.id);
  for (const [n, t] of [['geral', 'text'], ['clips-e-memes', 'text'], ['Sala de voz', 'voice']]) await run('INSERT INTO channels VALUES(?,?,?,?)', id(), sid, n, t);
  res.json({
    id: sid
  });
});
app.post('/api/join', async (req, res) => {
  const s = await one('SELECT * FROM servers WHERE invite=?', req.body.code);
  if (!s) return res.status(404).json({
    error: 'Convite não encontrado.'
  });
  await run('INSERT OR IGNORE INTO members VALUES(?,?)', s.id, req.user.id);
  io.emit('refresh');
  res.json({
    id: s.id
  });
});
app.post('/api/channels', async (req, res) => {
  if (!(await one('SELECT 1 FROM servers WHERE id=? AND owner=?', req.body.sid, req.user.id))) return res.status(403).json({
    error: 'Somente o dono pode criar canais.'
  });
  const name = String(req.body.name || '').trim().slice(0, 40);
  if (!name) return res.status(400).json({
    error: 'Informe o nome.'
  });
  await run('INSERT INTO channels VALUES(?,?,?,?)', id(), req.body.sid, name, req.body.type === 'voice' ? 'voice' : 'text');
  io.emit('refresh');
  res.json({
    ok: true
  });
});
app.get('/api/members/:sid', async (req, res) => {
  if (!(await one('SELECT 1 FROM members WHERE sid=? AND uid=?', req.params.sid, req.user.id))) return res.sendStatus(403);
  res.json((await all('SELECT users.* FROM users JOIN members ON users.id=members.uid WHERE sid=?', req.params.sid)).map(publicUser));
});
app.get('/api/messages/:room', async (req, res) => {
  if (!(await validRoom(req.user.id, req.params.room))) return res.sendStatus(403);
  const messages=await all('SELECT * FROM (SELECT * FROM messages WHERE room=? ORDER BY created DESC LIMIT 100) ORDER BY created',req.params.room);
  if(!messages.length)return res.json([]);
  const users=[...new Set(messages.map(m=>m.uid))];
  const authors=new Map((await all('SELECT * FROM users WHERE id IN ('+users.map(()=>'?').join(',')+')',...users)).map(u=>[u.id,publicUser(u)]));
  const reactions=await all('SELECT mid,emoji,COUNT(*) count FROM reactions WHERE mid IN ('+messages.map(()=>'?').join(',')+') GROUP BY mid,emoji',...messages.map(m=>m.id));
  res.json(messages.map(m=>({...m,attachments:JSON.parse(m.attachments||'[]'),user:authors.get(m.uid),reactions:reactions.filter(r=>r.mid===m.id)})));
});
app.delete('/api/messages/:id', async (req, res) => {
  const m = await one('SELECT * FROM messages WHERE id=? AND uid=?', req.params.id, req.user.id);
  if (m) {
    await run('DELETE FROM messages WHERE id=?', m.id);
    for(const media of JSON.parse(m.attachments||'[]')){await run('DELETE FROM media_chunks WHERE mid=?',media.id);await run('DELETE FROM media WHERE id=? AND uid=?',media.id,req.user.id);}
    await run('DELETE FROM reactions WHERE mid=?', m.id);
    io.to(m.room).emit('message');
  }
  res.json({
    ok: true
  });
});
app.post('/api/reactions', async (req, res) => {
  const m = await one('SELECT * FROM messages WHERE id=?', req.body.id);
  if (!m || !(await validRoom(req.user.id, m.room))) return res.sendStatus(403);
  if (!['❤️', '🔥', '😂', '👍'].includes(req.body.emoji)) return res.sendStatus(400);
  if (await one('SELECT 1 FROM reactions WHERE mid=? AND uid=? AND emoji=?', m.id, req.user.id, req.body.emoji)) await run('DELETE FROM reactions WHERE mid=? AND uid=? AND emoji=?', m.id, req.user.id, req.body.emoji);else await run('INSERT INTO reactions VALUES(?,?,?)', m.id, req.user.id, req.body.emoji);
  io.to(m.room).emit('message');
  res.json({
    ok: true
  });
});
app.get('/api/ice', (req, res) => res.json({
  iceServers: process.env.TURN_URL ? [{
    urls: 'stun:stun.l.google.com:19302'
  }, {
    urls: process.env.TURN_URL,
    username: process.env.TURN_USERNAME,
    credential: process.env.TURN_PASSWORD
  }] : [{
    urls: 'stun:stun.l.google.com:19302'
  }]
}));
const safeSocket = fn => (...args) => Promise.resolve(fn(...args)).catch(() => { const ack = args.at(-1); if (typeof ack === 'function') ack({error:'Banco temporariamente indisponível. Tente novamente.'}); });
io.use(async (socket, next) => {
  try {
    const u = await getUser(socket.handshake.auth.token);
    if (!u) return next(new Error('Sessão inválida'));
    socket.data.user = u;
    socket.data.token = socket.handshake.auth.token;
    next();
  } catch (error) {
    next(new Error("Banco temporariamente indisponível"));
  }
});
io.on('connection', s => {
  s.join('user:'+s.data.user.id);
  io.emit('refresh');
  let burst = [];
  const leave = () => {
    if (s.data.voice) {
      s.to(s.data.voice).emit('peer-left', s.id);
      s.leave(s.data.voice);
      s.data.voice = null;
    }
  };
  s.on('room', safeSocket(async (r, ack) => {
    if (!(await getUser(s.data.token)) || typeof r !== 'string' || !(await validRoom(s.data.user.id, r))) return ack?.({
      error: 'Acesso negado'
    });
    if (s.data.text) s.leave(s.data.text);
    s.data.text = r;
    s.join(r);
    ack?.({
      ok: true
    });
  }));
  s.on('send', safeSocket(async (b, ack) => {
    if (!(await getUser(s.data.token)) || !b || typeof b.room !== 'string' || !(await validRoom(s.data.user.id, b.room))) return ack?.({
      error: 'Acesso negado'
    });
    const body = String(b.body || '').trim();
    const ids=Array.isArray(b.attachments)?b.attachments:[];
    if((!body&&!ids.length)||body.length>4000||ids.length>4)return ack?.({error:'Envie texto ou até 4 anexos.'});
    burst=burst.filter(t=>Date.now()-t<10000);if(burst.length>=30)return ack?.({error:'Muitas mensagens seguidas. Aguarde alguns segundos.'});burst.push(Date.now());
    const attachments=[];
    for(const mediaId of [...new Set(ids)]){const media=await one('SELECT id,name,mime,size FROM media WHERE id=? AND uid=? AND room=? AND ready=1',String(mediaId),s.data.user.id,b.room);if(!media)return ack?.({error:'Anexo inválido para esta conversa.'});attachments.push(media);}
    const mid=id(),created=Date.now();
    await run('INSERT INTO messages(id,room,uid,body,created,attachments) VALUES(?,?,?,?,?,?)',mid,b.room,s.data.user.id,body,created,JSON.stringify(attachments));
    io.to(b.room).emit('message');
    ack?.({ok:true,id:mid,created});
    const recipients=b.room.startsWith('dm:')?b.room.slice(3).split(':'):(await all('SELECT uid FROM members WHERE sid=(SELECT sid FROM channels WHERE id=?)',b.room)).map(m=>m.uid);
    const sender=publicUser(await one('SELECT * FROM users WHERE id=?',s.data.user.id));
    for(const uid of recipients)if(uid!==sender.id)io.to('user:'+uid).emit('notification',{room:b.room,user:sender,body:body.slice(0,180),id:mid});
  }));
  s.on('typing', () => {
    if (s.data.text) s.to(s.data.text).emit('typing', s.data.user.display);
  });
  s.on('voice-join', safeSocket(async (room, ack) => {
    if (!(await getUser(s.data.token)) || typeof room !== 'string' || !(await validRoom(s.data.user.id, room))) return ack?.({
      error: 'Acesso negado'
    });
    const c = await one('SELECT type FROM channels WHERE id=?', room);
    if (c && c.type !== 'voice') return ack?.({
      error: 'Escolha um canal de voz'
    });
    const key = 'voice:' + room;
    const peers = [...io.sockets.sockets.values()].filter(p => p.data.voice === key && p.id !== s.id);
    if (peers.length >= 8) return ack?.({
      error: 'Sala cheia (8 pessoas).'
    });
    leave();
    s.data.voice = key;
    s.join(key);
    ack?.({
      peers: await Promise.all(peers.map(async p => ({
        id: p.id,
        user: publicUser(await one('SELECT * FROM users WHERE id=?', p.data.user.id))
      })))
    });
  }));
  s.on('signal', safeSocket(async b => {
    const target = io.sockets.sockets.get(b?.to);
    if ((await getUser(s.data.token)) && target && s.data.voice && target.data.voice === s.data.voice) s.to(target.id).emit('signal', {
      from: s.id,
      signal: b.signal,
      user: publicUser(await one('SELECT * FROM users WHERE id=?', s.data.user.id))
    });
  }));
  s.on('voice-leave', leave);
  s.on('disconnect', () => {
    leave();
    io.emit('refresh');
  });
});
app.use(express.static('public'));
app.use((err, req, res, next) => {
  console.error(err.message);
  res.status(err.status===413?413:500).json({
    error: err.status===413?'Arquivo muito grande. O limite é 12 MB por anexo.':'Não foi possível concluir. Tente novamente.'
  });
});
http.listen(process.env.PORT || 3000, () => console.log('IliaCord pronto em http://localhost:' + (process.env.PORT || 3000)));
