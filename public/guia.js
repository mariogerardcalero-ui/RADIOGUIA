const socket = io();

let micActive = false;
let seconds = 0;
let timer = null;
let localStream = null;
let peerConnections = {};

const iceConfig = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

socket.on('connect', () => console.log('Guía conectado:', socket.id));

socket.on('listener-count', (count) => {
  document.getElementById('listenerCount').textContent = count;
});

socket.on('tourist-ready', async ({ from }) => {
  if (!micActive || !localStream) return;
  console.log('Turista listo, enviando oferta a:', from);
  await crearOferta(from);
});

socket.on('answer', async ({ answer, from }) => {
  const pc = peerConnections[from];
  if (pc) await pc.setRemoteDescription(new RTCSessionDescription(answer));
});

socket.on('ice-candidate', async ({ candidate, from }) => {
  const pc = peerConnections[from];
  if (pc) {
    try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); }
    catch(e) { console.error('Error ICE:', e); }
  }
});

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