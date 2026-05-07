const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { Room } = require('./game/Room');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

const rooms = new Map();
let aiIdCounter = 0;

function generateRoomId() {
  let id;
  do {
    id = String(Math.floor(1000 + Math.random() * 9000));
  } while (rooms.has(id));
  return id;
}

function broadcastRoomState(room) {
  for (const player of room.players) {
    if (!player.isAI) {
      io.to(player.id).emit('gameState', room.getStateForPlayer(player.id));
    }
  }
}

io.on('connection', (socket) => {
  let currentRoomId = null;

  socket.on('createRoom', ({ playerName }, callback) => {
    const roomId = generateRoomId();
    const room = new Room(roomId);
    room.addPlayer(socket.id, playerName || '玩家1');
    rooms.set(roomId, room);
    currentRoomId = roomId;
    callback({ roomId });
    broadcastRoomState(room);
  });

  socket.on('joinRoom', ({ roomId, playerName }, callback) => {
    const room = rooms.get(roomId);
    if (!room) return callback({ error: '房间不存在' });
    if (!room.addPlayer(socket.id, playerName || '玩家')) {
      return callback({ error: '房间已满' });
    }
    currentRoomId = roomId;
    callback({ roomId });
    broadcastRoomState(room);
  });

  socket.on('addAI', ({}, callback) => {
    const room = rooms.get(currentRoomId);
    if (!room) return callback({ error: '房间不存在' });
    aiIdCounter++;
    const aiId = `ai_${aiIdCounter}`;
    const aiNames = ['电脑-小明', '电脑-小红', '电脑-小刚', '电脑-小丽', '电脑-小华'];
    const name = aiNames[(aiIdCounter - 1) % aiNames.length];
    if (!room.addPlayer(aiId, name, true)) {
      return callback({ error: '房间已满' });
    }
    callback({ ok: true, aiName: name });
    broadcastRoomState(room);
  });

  socket.on('startGame', ({}, callback) => {
    const room = rooms.get(currentRoomId);
    if (!room) return callback({ error: '房间不存在' });
    if (!room.startGame()) {
      return callback({ error: '无法开始游戏，至少需要2名玩家' });
    }
    callback({ ok: true });
    broadcastRoomState(room);
    processAI(room);
  });

  socket.on('makeChoice', ({ choice }, callback) => {
    const room = rooms.get(currentRoomId);
    if (!room) return callback({ error: '房间不存在' });
    const result = room.makeChoice(socket.id, choice);
    if (result.error) return callback(result);
    callback({ ok: true });
    broadcastRoomState(room);
    processAI(room);
  });

  socket.on('nextRound', ({}, callback) => {
    const room = rooms.get(currentRoomId);
    if (!room) return callback({ error: '房间不存在' });
    room.nextRound();
    callback({ ok: true });
    broadcastRoomState(room);
    processAI(room);
  });

  socket.on('leaveRoom', ({}, callback) => {
    if (currentRoomId) {
      const room = rooms.get(currentRoomId);
      if (room) {
        room.removePlayer(socket.id);
        if (room.players.length === 0) {
          rooms.delete(currentRoomId);
        } else {
          broadcastRoomState(room);
        }
      }
      currentRoomId = null;
    }
    callback({ ok: true });
  });

  socket.on('disconnect', () => {
    if (currentRoomId) {
      const room = rooms.get(currentRoomId);
      if (room) {
        room.removePlayer(socket.id);
        if (room.players.length === 0) {
          rooms.delete(currentRoomId);
        } else {
          broadcastRoomState(room);
        }
      }
    }
  });
});

function processAI(room) {
  const actions = room.processAITurns();
  if (actions.length > 0) {
    broadcastRoomState(room);
  }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`木塞游戏服务器运行在 http://localhost:${PORT}`);
});
