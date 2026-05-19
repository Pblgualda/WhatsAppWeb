const express = require('express')
const { Server } = require('socket.io');
const { createServer } = require('node:http');

const app = express()
const port = 9999
const server = createServer(app);
const io = new Server(server);
app.use(express.static('public'));

const users = {};

io.on('connection', (socket) => {
  console.log('a user connected', socket.id);

  socket.on('login', (user) => {
    users[socket.id] = user;
    socket.data.user = user;

    io.emit('userList', Object.values(users));
    socket.broadcast.emit('userJoined', user);
    console.log(`Usuario conectado: ${user && user.name}`);
  });

  socket.on('mensajeTexto', (data) => {
    const user = socket.data.user;
    const message = {
      user,
      text: data && data.text ? data.text.trim() : '',
      time: new Date().toISOString(),
    };
    
    // Si hay un destinatario, es un mensaje privado
    if (data.destinatario) {
      message.destinatario = data.destinatario;
      // Buscar el socket del destinatario
      const targetSocket = Array.from(io.sockets.sockets.values()).find(
        (s) => s.data.user?.name === data.destinatario && s.data.user?.avatar === data.destinatarioAvatar
      );
      // Enviar solo al destinatario y al remitente (si existe)
      if (targetSocket) {
        socket.emit('mensajePrivado', message);
        targetSocket.emit('mensajePrivado', message);
      }
    } else {
      // Mensaje público a todos
      io.emit('mensaje', message);
    }
  });

  socket.on('typing', () => {
    const user = socket.data.user;
    socket.broadcast.emit('typing', user);
  });

  socket.on('stopTyping', () => {
    const user = socket.data.user;
    socket.broadcast.emit('stopTyping', user);
  });

  socket.on('disconnect', () => {
    const user = users[socket.id];
    delete users[socket.id];
    io.emit('userList', Object.values(users));
    socket.broadcast.emit('userLeft', user);
    console.log(`Usuario desconectado: ${user && user.name}`);
  });
});

server.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})






