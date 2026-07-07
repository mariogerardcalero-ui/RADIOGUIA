import ws from 'k6/ws';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 10 },  // sube a 10 usuarios en 30s
    { duration: '30s', target: 30 },  // sube a 30 usuarios en 30s
    { duration: '30s', target: 50 },  // sube a 50 usuarios en 30s
    { duration: '30s', target: 0 },   // baja a 0
  ],
};

export default function () {
  const url = 'wss://radioguia.onrender.com/socket.io/?EIO=4&transport=websocket';

  const res = ws.connect(url, {}, function (socket) {
    socket.on('open', () => {
      console.log('Turista conectado');
      socket.send('40');  // handshake Socket.io
    });

    socket.on('message', (data) => {
      if (data.startsWith('40')) {
        socket.send('42["tourist-ready"]');  // simula turista uniéndose
      }
    });

    socket.on('close', () => console.log('Desconectado'));
    socket.on('error', (e) => console.error('Error:', e));

    sleep(10);
  });

  check(res, { 'conexión establecida': (r) => r && r.status === 101 });
}