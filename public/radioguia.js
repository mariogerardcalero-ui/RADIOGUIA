const socket = io();
const params = new URLSearchParams(window.location.search);
const id_grupo = params.get('id');
const id_usuario = params.get('usuario');

let micActive = false;
let joined = false;
let seconds = 0;
let timer = null;
let localStream = null;
let peerConnections = {};
let userTipo = null;

const iceConfig = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

// Verificar usuario al cargar
async function init() {
  if (!id_grupo || !id_usuario) {
    showError('Faltan parámetros de acceso. Usa ?id=GRUPO&usuario=ID');
    return;
  }

  document.getElementById('loadingMsg').textContent = 'Verificando usuario...';

  try {
    const res = await fetch(`/api/verificar?id_grupo=${id_grupo}&id_usuario=${id_usuario}`);
    const data = await res.json();

    if (!res.ok) {
      showError(data.error || 'No tienes acceso a este grupo');
      return;
    }

    userTipo = data.tipo; // 1=turista, 2=guia
    document.getElementById('loadingScreen').style.display = 'none';

    if (userTipo === '2') {
      document.getElementById('guideGroupName').textContent = data.grupo;
      document.getElementById('guideView').style.display = 'block';
    } else {
      document.getElementById('touristGroupName').textContent = data.grupo;
      document.getElementById('touristView').style.display = 'block';
    }

  } catch(e) {
    showError('Error de conexión. Inténtalo de nuevo.');
  }
}

function showError(msg) {
  document.getElementById('loadingScreen').style.display = 'none';
  document.getElementById('errorScreen').style.display = 'block';
  document.getElementById('errorMsg').textContent = msg;
}

// Socket events
socket.on('listener-count', (count) => {
  document.getElementById('listenerCount').textContent = count;
});

socket.on('guide-live', (live) => {
  syncTourist(live);
});

socket.on('tourist-ready', async ({ from }) => {
  if (!micActive || !localStream) return;
  await crearOferta(from);
});

socket.on('offer', async ({ offer, from }) => {
  if (!joined) return;
  const pc = new RTCPeerConnection(iceConfig);
  peerConnections[from] = pc;

  pc.ontrack = (event) => {
    const audio = document.getElementById('remoteAudio');
    audio.srcObject = event.streams[0];
    audio.play().catch(e => console.error(e));
  };

  pc.onicecandidate = (event) => {
    if (event.candidate) socket.emit('ice-candidate', { candidate: event.candidate, to: from });
  };

  await pc.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  socket.emit('answer', { answer, to: from });
});

socket.on('answer', async ({ answer, from }) => {
  const pc = peerConnections[from];
  if (pc) await pc.setRemoteDescription(new RTCSessionDescription(answer));
});

socket.on('ice-candidate', async ({ candidate, from }) => {
  const pc = peerConnections[from];
  if (pc) {
    try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); }
    catch(e) { console.error(e); }
  }
});

// Funciones guía
async function toggleMic() {
  micActive = !micActive;
  const btn = document.getElementById('micBtn');
  const status = document.getElementById('micStatus');

  if (micActive) {
    try {
      localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      btn.classList.add('active');
      document.getElementById('micIcon').className = 'ti ti-microphone-off';
      status.textContent = 'Emitiendo en vivo';
      status.className = 'status-live';
      seconds = 0;
      timer = setInterval(() => {
        seconds++;
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        document.getElementById('timeActive').textContent = m + ':' + String(s).padStart(2, '0');
      }, 1000);
      socket.emit('guide-start', { id_grupo });
    } catch(err) {
      alert('No se pudo acceder al micrófono.');
      micActive = false;
    }
  } else {
    btn.classList.remove('active');
    document.getElementById('micIcon').className = 'ti ti-microphone';
    status.textContent = 'Inactivo';
    status.className = '';
    clearInterval(timer);
    if (localStream) { localStream.getTracks().forEach(t => t.stop()); localStream = null; }
    Object.values(peerConnections).forEach(pc => pc.close());
    peerConnections = {};
    socket.emit('guide-stop', { id_grupo });
  }
}

async function crearOferta(touristId) {
  const pc = new RTCPeerConnection(iceConfig);
  peerConnections[touristId] = pc;
  localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
  pc.onicecandidate = (event) => {
    if (event.candidate) socket.emit('ice-candidate', { candidate: event.candidate, to: touristId });
  };
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  socket.emit('offer', { offer, to: touristId });
}

// Funciones turista
function syncTourist(live) {
  const wave = document.getElementById('audioWave');
  const badge = document.getElementById('listenerBadge');
  const lstatus = document.getElementById('listenerStatus');

  if (live && joined) {
    wave.classList.add('active');
    badge.className = 'badge online'; badge.textContent = 'En vivo';
    lstatus.textContent = 'Recibiendo audio del guía...';
  } else if (live && !joined) {
    badge.className = 'badge offline'; badge.textContent = 'Emisión disponible';
    lstatus.textContent = 'Únete para escuchar al guía';
  } else {
    wave.classList.remove('active');
    badge.className = 'badge offline'; badge.textContent = 'Sin emisión';
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
    socket.emit('tourist-ready', { id_grupo });
  } else {
    btn.className = 'btn btn-primary';
    document.getElementById('joinText').textContent = 'Unirse al canal';
    syncTourist(false);
    socket.emit('tourist-leave', { id_grupo });
  }
}

init();