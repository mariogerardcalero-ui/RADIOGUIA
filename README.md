# 🎧 Radio Guía — Tourist Road Guides

Prototipo funcional de radio guía en tiempo real para la app Tourist Road Guides.
El guía emite audio en vivo y los turistas lo escuchan desde cualquier dispositivo.

## ¿Cómo funciona?

- El **guía** activa el micrófono y emite audio en vivo
- Los **turistas** se unen al canal y escuchan al guía en tiempo real
- Funciona aunque el turista se una antes o después de que el guía empiece
- Muestra el número de oyentes conectados en tiempo real

## Tecnologías usadas

- Node.js + Express (servidor)
- Socket.io (comunicación en tiempo real)
- WebRTC (audio en vivo)

## Instalación y prueba local

1. Clona el repositorio
git clone https://github.com/tuusuario/radioguia.git
2. Entra en la carpeta
cd radioguia
3. Instala las dependencias
npm install
4. Arranca el servidor
node server.js
5. Abre el navegador en `http://localhost:3000`

## Cómo probarlo

1. Abre **dos pestañas** en `http://localhost:3000`
2. En una pestaña ve a la vista **Turista** y pulsa **Unirse al canal**
3. En la otra pestaña ve a la vista **Guía** y pulsa el **micrófono**
4. El turista debería escuchar el audio del guía en tiempo real

> Funciona también al revés: el guía puede emitir primero y el turista unirse después.

