import {PLUS_ITEMS,PLUS_COMBOS} from './plus-catalog.js';
const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const color=v=>/^#[0-9a-f]{6}$/i.test(v||'')?v:'#8da9ff';
const safeItem=(id,slot)=>PLUS_ITEMS[id]?.slot===slot?id:'none';
export function decoratedAvatar(base,u){const d=['orbit','glow','none'].includes(u.decoration)?u.decoration:safeItem(u.decoration,'decoration');return `<span class="avatar-wrap decor-${h(d)}" style="--decor:${color(u.color)}">${base}${d==='angel'?'<span class="wing wing-left"></span><span class="wing wing-right"></span>':''}${d==='royal'?'<span class="avatar-crown" aria-hidden="true">♛</span>':''}${d==='hearts'?'<span class="avatar-hearts" aria-hidden="true">♡ ♡</span>':''}${d==='petals'?'<span class="avatar-petals" aria-hidden="true">✿</span>':''}</span>`;}
export function styledName(u){return `<span class="nameplate plate-${safeItem(u.nameEffect,'nameEffect')}">${h(u.display||u.name)}</span>`;}
export function profileSurface(u,av,inner=''){
 const effect=safeItem(u.profileEffect,'profileEffect');
 const angle=Number.isFinite(Number(u.gradientAngle))?Number(u.gradientAngle):135;
 return `<section class="profile-surface effect-${effect}" style="--profile-a:${color(u.color)};--profile-b:${color(u.color2||'#232528')};--profile-angle:${angle}deg"><div class="profile-banner">${u.banner?`<img src="${h(u.banner)}" alt="Banner do perfil">`:''}</div><div class="profile-particles" aria-hidden="true">${Array.from({length:12},(_,i)=>`<i style="--i:${i}">${['snow','stardust'].includes(effect)?'✦':''}</i>`).join('')}</div><div class="profile-body">${av(u,true)}<div class="row between"><h2>${styledName(u)}</h2><span class="badge">✦ ILIA PLUS</span></div><small>@${h(u.name)}${u.pronouns?' · '+h(u.pronouns):''}</small><p>${h(u.status||'Disponível')}</p><hr><span class="eyebrow">SOBRE MIM</span><p>${h(u.bio||'Sem descrição.')}</p>${inner}</div></section>`;
}
export function makeEnhancements(ctx){
 const $=s=>document.querySelector(s);let inventory=[],drafts=new Map(),recording=null;
 const mediaCache=new Map();
 async function readImage(file,kind='banner'){
  if(!/^image\/(png|jpeg|webp|gif)$/.test(file.type))throw Error('Use PNG, JPG, WebP ou GIF.');
  if(file.size>12*1024*1024)throw Error('A imagem deve ter até 12 MB.');
  if(file.type==='image/gif'){
   if(file.size>1000000)throw Error('O GIF do banner deve ter até 1 MB.');
   return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file)});
  }
  const url=URL.createObjectURL(file);
  try{const im=new Image();await new Promise((r,j)=>{im.onload=r;im.onerror=()=>j(Error('Imagem inválida.'));im.src=url});const c=document.createElement('canvas');const scale=Math.min(1,960/im.naturalWidth,480/im.naturalHeight);c.width=Math.round(im.naturalWidth*scale);c.height=Math.round(im.naturalHeight*scale);c.getContext('2d').drawImage(im,0,0,c.width,c.height);return c.toDataURL('image/jpeg',.88);}finally{URL.revokeObjectURL(url);}
 }
 async function plusStore(ownedOnly=false){
  inventory=(await ctx.api('/plus')).owned;
  const u=ctx.user();
  ctx.showModal('Ilia Plus',`<p>Todos os combos são gratuitos. Adquira uma vez e escolha os itens no inventário.</p><div class="plus-tabs"><button type="button" id="plus-all" class="${!ownedOnly?'primary':'secondary'}">Loja</button><button type="button" id="plus-owned" class="${ownedOnly?'primary':'secondary'}">Meus combos · ${inventory.length}</button><button type="button" id="plus-equip" class="secondary">Personalizar perfil</button></div><div class="plus-grid">${PLUS_COMBOS.filter(c=>!ownedOnly||inventory.includes(c.id)).map(c=>{const sample={...u,color:c.color,banner:'',...Object.fromEntries(c.items.map(i=>[PLUS_ITEMS[i].slot,i]))};return `<article class="plus-product" style="--product-color:${c.color}"><div class="plus-preview">${ctx.av(sample,true)}<div>${styledName(sample)}</div></div><h3>${h(c.name)}</h3><small>${c.items.length} ${c.items.length===1?'item':'itens'} · GRÁTIS</small><ul>${c.items.map(i=>`<li>${h(PLUS_ITEMS[i].name)}</li>`).join('')}</ul><button type="button" data-combo="${c.id}" class="${inventory.includes(c.id)?'secondary':'primary'}">${inventory.includes(c.id)?'Equipar combo':'Adquirir grátis'}</button></article>`}).join('')||'<p>Nenhum combo adquirido ainda.</p>'}</div>`);
  ctx.modal.classList.add('plus-modal');
  $('#plus-all').onclick=ctx.action(()=>plusStore(false));$('#plus-owned').onclick=ctx.action(()=>plusStore(true));$('#plus-equip').onclick=ctx.action(appearance);
  ctx.modal.querySelectorAll('[data-combo]').forEach(b=>b.onclick=ctx.action(async()=>{const combo=PLUS_COMBOS.find(c=>c.id===b.dataset.combo);if(inventory.includes(combo.id)){await ctx.api('/appearance',Object.fromEntries(combo.items.map(i=>[PLUS_ITEMS[i].slot,i])),'PATCH');await ctx.refresh();ctx.toast('Combo equipado. Todos já podem ver no seu perfil.');return appearance();}ctx.showModal('Adquirir combo',`<p>Tem certeza que deseja adquirir <strong>${h(combo.name)}</strong>?</p><p>Este combo inclui ${combo.items.length} ${combo.items.length===1?'item':'itens'}:</p><ul>${combo.items.map(i=>`<li>${h(PLUS_ITEMS[i].name)}</li>`).join('')}</ul><p><strong>Grátis · sem cobrança.</strong></p><button type="button" class="primary" id="confirm-combo">Adquirir ${h(combo.name)}</button>`);$('#confirm-combo').onclick=ctx.action(async()=>{$('#confirm-combo').disabled=true;try{await ctx.api('/plus/acquire',{combo:combo.id});await plusStore(true);ctx.toast('Combo adicionado ao seu inventário.');}catch(e){$('#confirm-combo').disabled=false;throw e;}});}));
 }
 async function appearance(){
  inventory=(await ctx.api('/plus')).owned;const unlocked=new Set(PLUS_COMBOS.filter(c=>inventory.includes(c.id)).flatMap(c=>c.items));let draft={...ctx.user()};
  const options=slot=>[['none','Sem efeito'],...(slot==='decoration'?[['orbit','Órbita básica'],['glow','Brilho básico']]:[]),...[...unlocked].filter(i=>PLUS_ITEMS[i].slot===slot).map(i=>[i,PLUS_ITEMS[i].name])].map(([id,name])=>`<option value="${id}" ${draft[slot]===id?'selected':''}>${h(name)}</option>`).join('');
  ctx.showModal('Personalizar perfil',`<div class="appearance-layout"><div id="appearance-preview">${profileSurface(draft,ctx.av)}</div><div><label>Decoração do avatar</label><select name="decoration">${options('decoration')}</select><label>Efeito dentro do perfil</label><select name="profileEffect">${options('profileEffect')}</select><label>Placa do nome</label><select name="nameEffect">${options('nameEffect')}</select><div class="settings-grid"><div><label>Cor inicial</label><input name="color" type="color" value="${color(draft.color)}"></div><div><label>Cor final</label><input name="color2" type="color" value="${color(draft.color2||'#232528')}"></div></div><label>Ângulo do degradê</label><input name="gradientAngle" type="range" min="0" max="360" value="${draft.gradientAngle||135}"><label>Banner: foto ou GIF</label><input id="banner-file" type="file" accept="image/png,image/jpeg,image/webp,image/gif"><small>Fotos até 12 MB, ajustadas automaticamente. GIF até 1 MB.</small><button type="button" id="remove-banner" class="secondary">Remover banner</button><p><small>Adquira outros itens na loja do Ilia Plus.</small></p></div></div>`,async()=>{await ctx.api('/appearance',Object.fromEntries(['decoration','profileEffect','nameEffect','banner','color','color2','gradientAngle'].map(k=>[k,draft[k]])),'PATCH');await ctx.refresh();ctx.toast('Perfil atualizado para todos.');});
  ctx.modal.classList.add('plus-modal');
  const preview=()=>$('#appearance-preview').innerHTML=profileSurface(draft,ctx.av);
  ctx.modal.querySelectorAll('select,input[name]').forEach(input=>input.oninput=()=>{draft[input.name]=input.name==='gradientAngle'?Number(input.value):input.value;preview();});
  $('#remove-banner').onclick=()=>{draft.banner='';preview();};
  $('#banner-file').onchange=ctx.action(async e=>{if(!e.target.files[0])return;const save=$('#modal-form .modal-footer .primary');save.disabled=true;try{draft.banner=await readImage(e.target.files[0]);preview();}finally{save.disabled=false;}});
 }
 function linkified(text){
  const re=/https?:\/\/[^\s<>]+/g;let html='',last=0;for(const match of text.matchAll(re)){html+=h(text.slice(last,match.index));let url=match[0].replace(/[.,!?)\]}]+$/,'');html+=`<a href="${h(url)}" target="_blank" rel="noopener noreferrer">${h(url)}</a>`+h(match[0].slice(url.length));last=match.index+match[0].length;}return html+h(text.slice(last));
 }
 function messageContent(m){
  const text=String(m.body||''),urls=[...text.matchAll(/https?:\/\/[^\s<>]+/g)].slice(0,3).map(x=>x[0].replace(/[.,!?)\]}]+$/,''));
  let html=`<p class="message-text">${linkified(text)}</p>`;
  for(const link of urls){try{const u=new URL(link);if(u.origin===new URL(ctx.origin).origin&&u.pathname.startsWith('/invite/'))continue;if(u.protocol==='https:'&&/\.(gif|png|jpe?g|webp)$/i.test(u.pathname)){html+=`<img class="linked-image" src="${h(link)}" alt="Imagem compartilhada" loading="lazy" referrerpolicy="no-referrer">`;continue;}const host=u.hostname.replace(/^www\./,'');const label=host==='medal.tv'||host.endsWith('.medal.tv')?'Clipe do Medal':host==='youtu.be'||host==='youtube.com'?'Vídeo do YouTube':host;html+=`<a class="external-card" href="${h(link)}" target="_blank" rel="noopener noreferrer"><span class="external-icon">↗</span><span><strong>${h(label)}</strong><small>${h(u.pathname.length>80?u.pathname.slice(0,80)+'…':u.pathname||'/')}</small></span><span>Abrir</span></a>`;}catch{}}
  const attachments=Array.isArray(m.attachments)?m.attachments:[];
  html+=attachments.map(a=>`<div class="media-attachment" data-media="${h(a.id)}"><button type="button" class="secondary load-media">${a.mime.startsWith('image/')?'Ver imagem':a.mime.startsWith('video/')?'Reproduzir vídeo':'Ouvir áudio'} · ${h(a.name)} (${(a.size/1048576).toFixed(1)} MB)</button><div class="media-player"></div><small class="media-error" role="status"></small></div>`).join('');return html;
 }
 function bindMedia(area,messages){
  const files=new Map(messages.flatMap(m=>Array.isArray(m.attachments)?m.attachments:[]).map(a=>[a.id,a]));
  for(const box of area.querySelectorAll('[data-media]')){const a=files.get(box.dataset.media);if(!a)continue;const button=box.querySelector('.load-media');
   button.onclick=async()=>{button.disabled=true;box.querySelector('.media-error').textContent='';try{let url=mediaCache.get(a.id);if(!url){const response=await fetch(ctx.origin+'/api/media/'+a.id,{headers:{Authorization:'Bearer '+ctx.token()}});if(!response.ok)throw Error('Arquivo indisponível ou removido.');url=URL.createObjectURL(await response.blob());mediaCache.set(a.id,url);if(mediaCache.size>32){const first=mediaCache.keys().next().value;URL.revokeObjectURL(mediaCache.get(first));mediaCache.delete(first);}}
    if(!box.isConnected)return;const target=box.querySelector('.media-player');const el=document.createElement(a.mime.startsWith('image/')?'img':a.mime.startsWith('video/')?'video':'audio');el.src=url;if(el.tagName==='IMG'){el.alt=a.name;el.onclick=()=>{ctx.showModal(a.name,`<img src="${h(url)}" alt="${h(a.name)}" style="max-width:100%;max-height:75dvh">`);};}else{el.controls=true;el.playsInline=true;el.preload='metadata';}target.replaceChildren(el);const download=document.createElement('a');download.href=url;download.download=a.name;download.textContent='Baixar arquivo';target.append(download);button.hidden=true;
   }catch(e){box.querySelector('.media-error').textContent=e.message;}finally{button.disabled=false;}};
   if(a.mime.startsWith('image/'))button.click();
  }
 }
 const currentDraft=room=>{if(!drafts.has(room))drafts.set(room,[]);return drafts.get(room);};
 function paintDrafts(){const target=$('#attachment-drafts');if(!target)return;const list=currentDraft(ctx.room());target.innerHTML=list.map((d,i)=>`<div class="draft-file"><span>${h(d.name)}</span><small>${d.uploading?'Enviando '+d.progress+'%':d.error?h(d.error):'Pronto'}</small><button type="button" data-remove="${i}" aria-label="Remover anexo">×</button></div>`).join('');target.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{const [d]=list.splice(Number(b.dataset.remove),1);d.cancelled=true;d.xhr?.abort();if(d.id)ctx.api('/media/'+d.id,null,'DELETE').catch(()=>{});paintDrafts();});}
 async function upload(file,targetRoom=ctx.room()){
  if(!/^(image\/(png|jpeg|gif|webp)|video\/(mp4|webm|quicktime)|audio\/(webm|ogg|mp4|mpeg|wav))(;|$)/.test(file.type))throw Error('Use imagem, vídeo MP4/WebM/MOV ou áudio MP3/M4A/OGG/WAV/WebM.');
  if(file.size>12*1024*1024)throw Error('O limite é 12 MB por arquivo. Para vídeos maiores, envie o link do Medal ou de outro serviço.');
  const list=currentDraft(targetRoom);if(list.length>=4)throw Error('Envie até 4 anexos por mensagem.');
  const d={name:file.name||'audio.webm',uploading:true,progress:0};list.push(d);paintDrafts();
  try{const result=await new Promise((resolve,reject)=>{const xhr=new XMLHttpRequest();d.xhr=xhr;xhr.open('POST',ctx.origin+'/api/media?'+new URLSearchParams({room:targetRoom,name:d.name,mime:file.type}));xhr.setRequestHeader('Authorization','Bearer '+ctx.token());xhr.setRequestHeader('Content-Type','application/octet-stream');xhr.upload.onprogress=e=>{if(e.lengthComputable){d.progress=Math.round(100*e.loaded/e.total);if(ctx.room()===targetRoom)paintDrafts();}};xhr.onload=()=>{let result;try{result=JSON.parse(xhr.responseText)}catch{result={error:'Falha no envio.'}}xhr.status>=200&&xhr.status<300?resolve(result):reject(Error(result.error||'Falha no envio.'));};xhr.onerror=()=>reject(Error('Conexão interrompida. Remova o anexo e tente novamente.'));xhr.onabort=()=>reject(Error('Cancelado'));xhr.send(file);});if(d.cancelled){ctx.api('/media/'+result.id,null,'DELETE').catch(()=>{});return;}Object.assign(d,result,{uploading:false,xhr:null});}catch(e){d.error=e.message;d.uploading=false;}if(ctx.room()===targetRoom)paintDrafts();
 }
 async function recordAudio(){
  if(recording)return;
  if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder)throw Error('Gravação de áudio indisponível neste navegador. Você pode anexar um arquivo de áudio.');
  let stream;try{stream=await navigator.mediaDevices.getUserMedia({audio:true});}catch{throw Error('Permita o microfone para gravar um áudio.');}
  const mime=['audio/webm;codecs=opus','audio/mp4','audio/ogg;codecs=opus'].find(t=>MediaRecorder.isTypeSupported(t));const recorder=mime?new MediaRecorder(stream,{mimeType:mime}):new MediaRecorder(stream);const chunks=[];const targetRoom=ctx.room();let discarded=false,seconds=0,total=0;
  recording=recorder;ctx.showModal('Gravar áudio','<p id="record-time">Gravando · 0:00</p><button type="button" id="stop-record" class="primary">Parar e ouvir</button> <button type="button" id="cancel-record">Descartar</button><p><small>Até 3 minutos. O áudio só será enviado quando você confirmar a mensagem.</small></p>');
  const timer=setInterval(()=>{seconds++;if($('#record-time'))$('#record-time').textContent='Gravando · '+Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');if(seconds>=180&&recorder.state==='recording')recorder.stop();},1000);
  const onClose=()=>{if(recorder.state==='recording'){discarded=true;recorder.stop();}};ctx.modal.addEventListener('close',onClose,{once:true});
  recorder.ondataavailable=e=>{if(e.data.size){chunks.push(e.data);total+=e.data.size;if(total>11*1024*1024&&recorder.state==='recording')recorder.stop();}};
  recorder.onstop=()=>{clearInterval(timer);stream.getTracks().forEach(t=>t.stop());recording=null;ctx.modal.removeEventListener('close',onClose);if(discarded)return;const blob=new Blob(chunks,{type:recorder.mimeType||mime||'audio/webm'});const url=URL.createObjectURL(blob);ctx.showModal('Ouvir áudio',`<audio controls src="${h(url)}" style="width:100%"></audio><p><small>Será anexado à conversa em que você começou a gravar.</small></p><button type="button" class="primary" id="attach-record">Anexar à mensagem</button>`);ctx.modal.addEventListener('close',()=>URL.revokeObjectURL(url),{once:true});$('#attach-record').onclick=ctx.action(async()=>{ctx.modal.close();const ext=blob.type.includes('mp4')?'m4a':blob.type.includes('ogg')?'ogg':'webm';await upload(new File([blob],'audio-'+Date.now()+'.'+ext,{type:blob.type}),targetRoom);});};
  $('#stop-record').onclick=()=>{if(recorder.state==='recording')recorder.stop();};$('#cancel-record').onclick=()=>{discarded=true;ctx.modal.close();};recorder.start(1000);
 }
 function bindComposer(){
  const form=$('#composer');if(!form)return;
  const tools=document.createElement('div');tools.className='attachment-tools';tools.innerHTML='<button type="button" id="attach-file" title="Anexar imagem, vídeo ou áudio">＋</button><input hidden id="file-input" type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/quicktime,audio/*"><button type="button" id="record-audio" title="Gravar áudio">🎙</button>';
  form.prepend(tools);const d=document.createElement('div');d.id='attachment-drafts';form.before(d);paintDrafts();
  $('#attach-file').onclick=()=>$('#file-input').click();$('#file-input').onchange=ctx.action(async e=>{for(const file of [...e.target.files])await upload(file);e.target.value='';});$('#record-audio').onclick=ctx.action(recordAudio);
  $('#compose').addEventListener('paste',ctx.action(async e=>{const files=[...e.clipboardData.files];if(files.length){e.preventDefault();for(const file of files)await upload(file);}}));
  const chat=form.closest('.chat');chat.ondragover=e=>{e.preventDefault();chat.classList.add('drag-files');};chat.ondragleave=()=>chat.classList.remove('drag-files');chat.ondrop=ctx.action(async e=>{e.preventDefault();chat.classList.remove('drag-files');for(const file of [...e.dataTransfer.files])await upload(file);});
  form.onsubmit=ctx.action(async e=>{
   e.preventDefault();const targetRoom=ctx.room(),input=$('#compose'),body=input.value.trim(),list=currentDraft(targetRoom);
   if(list.some(d=>d.uploading))throw Error('Aguarde o envio dos anexos terminar.');if(list.some(d=>d.error))throw Error('Remova os anexos que falharam antes de enviar.');
   if(!body&&!list.length)return;
   const attachments=list.map(d=>({id:d.id,name:d.name,mime:d.mime,size:d.size}));input.value='';drafts.set(targetRoom,[]);paintDrafts();
   const pending=document.createElement('article');pending.className='message pending-message';pending.innerHTML='<div class="body"><strong>Você</strong><p>'+h(body||'Enviando anexo…')+'</p><small>Enviando…</small></div>';$('#messages')?.append(pending);pending.scrollIntoView({block:'nearest'});
   try{await ctx.send(body,attachments.map(a=>a.id),targetRoom);pending.remove();if(ctx.room()===targetRoom)await ctx.loadMessages();}
   catch(error){pending.remove();const activeList=currentDraft(targetRoom);drafts.set(targetRoom,[...list,...activeList]);if(ctx.room()===targetRoom){if(!$('#compose').value)$('#compose').value=body;paintDrafts();}throw error;}
  });
 }
 function clearMedia(){for(const url of mediaCache.values())URL.revokeObjectURL(url);mediaCache.clear();drafts.clear();}
 return {plusStore,appearance,messageContent,bindMedia,bindComposer,clearMedia};
}
