const socket = io();

let micActive = false;
let joined = false;
let seconds = 0;
let timer = null;
let localStream = null;
let peerConnections = {};

const iceConfig = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

socket.on('connect', () => console.log('Socket conectado:', socket.id));

socket.on('listener-count', (count) => {
  document.getElementById('listenerCount').textContent = count;
});

socket.on('guide-live', (live) => {
  syncTourist(live);
});

// El guía recibe aviso de que hay un turista listo y le envía oferta
socket.on('tourist-ready', async ({ from }) => {
  if (!micActive || !localStream) return;
  console.log('Turista listo, enviando oferta a:', from);
  await crearOferta(from);
});

// El turista recibe la oferta del guía
socket.on('offer', async ({ offer, from }) => {
  console.log('Oferta recibida de:', from);
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

socket.on('answer', async ({ answer, from }) => {
  console.log('Respuesta recibida de:', from);
  const pc = peerConnections[from];
  if (pc) await pc.setRemoteDescription(new RTCSessionDescription(answer));
});

socket.on('ice-candidate', async ({ candidate, from }) => {
  const pc = peerConnections[from];
  if (pc) {
    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch(e) {
      console.error('Error añadiendo ICE:', e);
    }
  }
});

// --- Funciones UI ---

function switchTab(tab) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  document.getElementById('panel-' + tab).classList.add('active');
}

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
      socket.emit('guide-start');
    } catch (err) {
      console.error('Error micrófono:', err);
      alert('No se pudo acceder al micrófono. Revisa los permisos.');
      micActive = false;
    }
  } else {
    btn.classList.remove('active');
    document.getElementById('micIcon').className = 'ti ti-microphone';
    status.textContent = 'Inactivo';
    status.className = '';
    clearInterval(timer);
    document.getElementById('listenerCount').textContent = '0';
    if (localStream) {
      localStream.getTracks().forEach(t => t.stop());
      localStream = null;
    }
    Object.values(peerConnections).forEach(pc => pc.close());
    peerConnections = {};
    socket.emit('guide-stop');
  }
}

async function crearOferta(touristId) {
  const pc = new RTCPeerConnection(iceConfig);
  peerConnections[touristId] = pc;

  localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('ice-candidate', { candidate: event.candidate, to: touristId });
    }
  };

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  socket.emit('offer', { offer, to: touristId });
}

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
    console.log('Turista unido, avisando al guía...');
    socket.emit('tourist-ready');
  } else {
    btn.className = 'btn btn-primary';
    document.getElementById('joinText').textContent = 'Unirse al canal';
    syncTourist(false);
    socket.emit('tourist-leave');
  }
}