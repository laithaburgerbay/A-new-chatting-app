
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

let users = {};

io.on('connection', (socket) => {
  let nickname = '';
  
  socket.on('set nickname', (name) => {
    if(!name) name = 'Anonymous';
    nickname = name;
    users[socket.id] = nickname;
    io.emit('chat message', { system: true, msg: `${nickname} has joined the chat` });
    io.emit('update users', Object.values(users));
  });

  socket.on('chat message', (msg) => {
    if(nickname && msg) {
      io.emit('chat message', { user: nickname, msg, time: new Date().toLocaleTimeString() });
    }
  });

  socket.on('typing', (status) => {
    socket.broadcast.emit('typing', { user: nickname, status });
  });

  socket.on('disconnect', () => {
    if(nickname) {
      io.emit('chat message', { system: true, msg: `${nickname} has left the chat` });
      delete users[socket.id];
      io.emit('update users', Object.values(users));
    }
  });
});

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
