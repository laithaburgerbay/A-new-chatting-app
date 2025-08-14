// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const db = new sqlite3.Database('chat.db');

// Create messages table if it doesn't exist
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user TEXT,
    msg TEXT,
    time TEXT
  )`);
});

app.use(express.static(path.join(__dirname, 'public')));

let users = {};
let typingUsers = {};

io.on('connection', socket => {
  console.log('a user connected');

  // Send last 50 messages from DB
  db.all(`SELECT * FROM messages ORDER BY id DESC LIMIT 50`, (err, rows) => {
    if (!err) {
      rows.reverse().forEach(row => {
        socket.emit('chat message', { user: row.user, msg: row.msg, time: row.time });
      });
    }
  });

  // Set nickname
  socket.on('set nickname', nickname => {
    socket.nickname = nickname;
    users[socket.id] = nickname;
    io.emit('update users', Object.values(users));
    io.emit('chat message', { system:true, msg:`${nickname} joined the chat` });
  });

  // Handle chat messages
  socket.on('chat message', msg => {
    if (!msg || !socket.nickname) return;
    const time = new Date().toLocaleTimeString();
    const messageData = { user: socket.nickname, msg, time };
    
    // Store message in DB
    db.run(`INSERT INTO messages (user, msg, time) VALUES (?, ?, ?)`, [socket.nickname, msg, time]);
    
    io.emit('chat message', messageData);
  });

  // Typing indicator
  socket.on('typing', status => {
    typingUsers[socket.id] = status ? socket.nickname : null;
    const active = Object.values(typingUsers).filter(u => u).join(', ');
    io.emit('typing', { status: active.length>0, user: active });
  });

  socket.on('disconnect', () => {
    if (socket.nickname) {
      io.emit('chat message', { system:true, msg:`${socket.nickname} left the chat` });
    }
    delete users[socket.id];
    delete typingUsers[socket.id];
    io.emit('update users', Object.values(users));
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
