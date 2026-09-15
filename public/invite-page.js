async function updateInviteCounts(){try{const code=location.pathname.split('/')[2];const r=await fetch('/api/invites/'+encodeURIComponent(code));if(!r.ok)return;const s=await r.json();document.getElementById('invite-counts').textContent=`${s.online} online · ${s.offline} offline · ${s.total} membros`;}catch{}}
updateInviteCounts();setInterval(()=>{if(!document.hidden)updateInviteCounts()},15000);
