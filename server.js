const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const WavEncoder = require('wav-encoder');

const app = express();
app.use(express.static(path.join(__dirname, 'public')));

const server = http.Server(app);
server.listen(3000);

const io = socketIo(server);

var numConn = 0;
var users = [];

io.on('connection', (socket) => {
  socket.emit('connect');

  ++numConn;
  var newUser = {
    id: socket.id,
    name: ''
  };
  users.push(newUser)
  socket.emit('getID', socket.id);

  socket.on('changeID', (data) => {
    for (var i = 0; i < users.length; i++) {
      if (users[i].id == socket.id) {
        users[i].name = data;
      }
    }
    socket.emit('id_changed', data);
    socket.emit('list_user', users);
    socket.broadcast.emit('list_user', users);
    socket.broadcast.emit('user_join', data);
  });

  let sampleRate = 48000

  socket.on('start', (data) => {
    sampleRate = data.sampleRate
  })
  socket.on('endvoice', () => {
    socket.broadcast.emit('stop');
  })

  socket.on('send_message', (data) => {
    const itr = data.audio.values();
    const buf = new Array(data.audio.length);
    let buffer = [];
    for (var i = 0; i < buf.length; i++) {
      buf[i] = itr.next().value;
    }
    buffer = buffer.concat(buf);
    const f32array = toF32Array(buffer)
    const audioData = {
      sampleRate: sampleRate,
      channelData: [f32array]
    }
    WavEncoder.encode(audioData).then((buffer) => {
      data.audio = buffer;
      if (data.user_id != 'all') {
        io.to(data.user_id).emit('msg', data);
      } else {
        socket.broadcast.emit('msg', data);
      }
    })
  })

  socket.on('disconnect', () => {
    --numConn;
    var uleft;
    for (var i = 0; i < users.length; i++) {
      if (users[i].id == socket.id) {
        uleft = users[i];
        users.splice(i, 1);
      }
    }
    socket.emit('list_user', users);
    socket.broadcast.emit('list_user', users);
  });

  const toF32Array = (buf) => {
    const buffer = new ArrayBuffer(buf.length)
    const view = new Uint8Array(buffer)
    for (var i = 0; i < buf.length; i++) {
      view[i] = buf[i]
    }
    return new Float32Array(buffer)
  }

});
