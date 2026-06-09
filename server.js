const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

// Rutas separadas
app.get('/guia', (req, res) => {
  res.sendFile(__dirname + '/public/guia.html');
});

app.get('/turista', (req, res) => {
  res.sendFile(__dirname + '/public/turista.html');
});

let guideId = null;
let tourists = new Set();

io.on('connection', (socket) => {
  console.log('Usuario conectado:', socket.id);

  socket.on('guide-start', () => {
    guideId = socket.id;
    console.log('Guía empezó a emitir');
    socket.broadcast.emit('guide-live', true);
    io.emit('listener-count', tourists.size);
    tourists.forEach(touristId => {
      socket.emit('tourist-ready', { from: touristId });
    });
  });

  socket.on('guide-stop', () => {
    guideId = null;
    console.log('Guía paró de emitir');
    socket.broadcast.emit('guide-live', false);
    io.emit('listener-count', 0);
  });

  socket.on('tourist-ready', () => {
    tourists.add(socket.id);
    console.log('Turista listo:', socket.id, '| Total:', tourists.size);
    if (guideId) {
      io.to(guideId).emit('tourist-ready', { from: socket.id });
      io.emit('listener-count', tourists.size);
    }
  });

  socket.on('tourist-leave', () => {
    tourists.delete(socket.id);
    io.emit('listener-count', tourists.size);
  });

  socket.on('offer', ({ offer, to }) => {
    io.to(to).emit('offer', { offer, from: socket.id });
  });

  socket.on('answer', ({ answer, to }) => {
    io.to(to).emit('answer', { answer, from: socket.id });
  });

  socket.on('ice-candidate', ({ candidate, to }) => {
    io.to(to).emit('ice-candidate', { candidate, from: socket.id });
  });

  socket.on('disconnect', () => {
    console.log('Usuario desconectado:', socket.id);
    if (socket.id === guideId) {
      guideId = null;
      io.emit('guide-live', false);
    }
    if (tourists.has(socket.id)) {
      tourists.delete(socket.id);
      io.emit('listener-count', tourists.size);
    }
  });
});

server.listen(process.env.PORT || 3000, () => {
  console.log('Servidor corriendo');
});