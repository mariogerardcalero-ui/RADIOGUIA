const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const https = require('https');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const API_TOKEN = '11kBFW02mvNSQVkv2sslCcwJcwWPUio9EwJFI9tRuaqDzDJC';
const API_BASE = 'https://apppro.appdeviajes.com/api/public/audioguiasgrupos';

// Función para consultar la API
function fetchAPI(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(e); }
      });
    }).on('error', reject);
  });
}

// Endpoint para obtener grupos
app.get('/api/grupos', async (req, res) => {
  try {
    const data = await fetchAPI(`${API_BASE}/grupos?token=${API_TOKEN}`);
    res.json(data);
  } catch(e) {
    res.status(500).json({ error: 'Error obteniendo grupos' });
  }
});

// Endpoint para verificar usuario en grupo
app.get('/api/verificar', async (req, res) => {
  const { id_grupo, id_usuario } = req.query;
  if (!id_grupo || !id_usuario) {
    return res.status(400).json({ error: 'Faltan parámetros' });
  }
  try {
    const personas = await fetchAPI(`${API_BASE}/personas?token=${API_TOKEN}&id=${id_grupo}`);
    const usuario = personas.find(p => p.id_usuario === id_usuario);
    if (!usuario) {
      return res.status(403).json({ error: 'Usuario no pertenece a este grupo' });
    }
    res.json({
      id_usuario: usuario.id_usuario,
      nombre: usuario.nombre,
      tipo: usuario.tipo_usuario, // 1=turista, 2=guia
      grupo: usuario.grupo
    });
  } catch(e) {
    res.status(500).json({ error: 'Error verificando usuario' });
  }
});

// Rutas principales
app.get('/radioguia', (req, res) => {
  res.sendFile(__dirname + '/public/radioguia.html');
});

let rooms = {}; // { id_grupo: { guideId, tourists: Set } }

io.on('connection', (socket) => {
  console.log('Usuario conectado:', socket.id);

  socket.on('guide-start', ({ id_grupo }) => {
    if (!rooms[id_grupo]) rooms[id_grupo] = { guideId: null, tourists: new Set() };
    rooms[id_grupo].guideId = socket.id;
    socket.join(id_grupo);
    socket.to(id_grupo).emit('guide-live', true);
    io.to(id_grupo).emit('listener-count', rooms[id_grupo].tourists.size);
    rooms[id_grupo].tourists.forEach(touristId => {
      socket.emit('tourist-ready', { from: touristId });
    });
    console.log(`Guía emitiendo en grupo ${id_grupo}`);
  });

  socket.on('guide-stop', ({ id_grupo }) => {
    if (rooms[id_grupo]) rooms[id_grupo].guideId = null;
    socket.to(id_grupo).emit('guide-live', false);
    io.to(id_grupo).emit('listener-count', 0);
  });

  socket.on('tourist-ready', ({ id_grupo }) => {
    if (!rooms[id_grupo]) rooms[id_grupo] = { guideId: null, tourists: new Set() };
    rooms[id_grupo].tourists.add(socket.id);
    socket.join(id_grupo);
    const guideId = rooms[id_grupo].guideId;
    if (guideId) {
      io.to(guideId).emit('tourist-ready', { from: socket.id });
      io.to(id_grupo).emit('listener-count', rooms[id_grupo].tourists.size);
    }
    console.log(`Turista unido al grupo ${id_grupo} | Total: ${rooms[id_grupo].tourists.size}`);
  });

  socket.on('tourist-leave', ({ id_grupo }) => {
    if (rooms[id_grupo]) {
      rooms[id_grupo].tourists.delete(socket.id);
      io.to(id_grupo).emit('listener-count', rooms[id_grupo].tourists.size);
    }
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
    Object.keys(rooms).forEach(id_grupo => {
      const room = rooms[id_grupo];
      if (room.guideId === socket.id) {
        room.guideId = null;
        io.to(id_grupo).emit('guide-live', false);
      }
      if (room.tourists.has(socket.id)) {
        room.tourists.delete(socket.id);
        io.to(id_grupo).emit('listener-count', room.tourists.size);
      }
    });
  });
});

server.listen(process.env.PORT || 3000, () => {
  console.log('Servidor corriendo');
});