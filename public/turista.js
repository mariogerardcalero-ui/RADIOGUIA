const socket = io();

let joined = false;
let micActive = false;
let peerConnections = {};

const iceConfig = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

socket.on('connect', () => console.log('Turista conectado:', socket.id));

socket.on('guide-live', (live) => {
  micActive = live;
  syncTourist(live);
});

socket.on('offer', async ({ offer, from }) => {
  if (!joined) return;
  const pc = new RTCPeerConnection(iceConfig);
  peerConnections[from] = pc;

  pc.ontrack = (event) => {
    console.log('Audio recibido!');
    const audio = document.getElementById('remoteAudio');
    audio.srcObject = event.streams[0];
    audio.play().catch(e => console.error('Error reproduciendo:', e));
  };

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('ice-candidate', { candidate: event.candidate, to: from });
    }
  };

  await pc.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  socket.emit('answer', { answer, to: from });
});

socket.on('ice-candidate', async ({ candidate, from }) => {
  const pc = peerConnections[from];
  if (pc) {
    try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); }
    catch(e) { console.error('Error ICE:', e); }
  }
});

function syncTourist(live) {
  const wave = document.getElementById('audioWave');
  const badge = document.getElementById('listenerBadge');
  const lstatus = document.getElementById('listenerStatus');

  if (live && joined) {
    wave.classList.add('active');
    badge.className = 'badge online';
    badge.textContent = 'En vivo';
    lstatus.textContent = 'Recibiendo audio del guía...';
  } else if (live && !joined) {
    badge.className = 'badge offline';
    badge.textContent = 'Emisión disponible';
    lstatus.textContent = 'Únete para escuchar al guía';
  } else {
    wave.classList.remove('active');
    badge.className = 'badge offline';
    badge.textContent = 'Sin emisión';
    lstatus.textContent = 'El guía no está emitiendo';
  }
}

function toggleJoin() {
  joined = !joined;
  const btn = document.getElementById('joinBtn');

  if (joined) {
    btn.className = 'btn btn-secondary';
    document.getElementById('joinText').textContent = 'Salir del canal';
    syncTourist(micActive);
    socket.emit('tourist-ready');
  } else {
    btn.className = 'btn btn-primary';
    document.getElementById('joinText').textContent = 'Unirse al canal';
    syncTourist(false);
    socket.emit('tourist-leave');
  }
}