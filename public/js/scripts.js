String.prototype.format = function () {
  var formatted = this;
  for (var i = 0; i < arguments.length; i++) {
    var regexp = new RegExp('\\{' + i + '\\}', 'gi');
    formatted = formatted.replace(regexp, arguments[i]);
  }
  return formatted;
};
function yourName() {
  var name = prompt("What is your name?");
  if (!name) {
    alert('Anda harus mengisi nama anda!');
    return yourName();
  }
  name = name.replace(/<(.|\n)*?>/g, '').trim();
  return name;
}

var $server_status = $("#status");

var socket = io();

var yourID;
var userName = null;
var processor = null;
var localstream = null;
var userNotif = '<audio src="sounds/user.mp3" style="display: none" id="userNotif"></audio>';
var msgNotif = '<audio src="sounds/msg.mp3" style="display: none" id="msgNotif"></audio>';

// $("body").append(userNotif);
// $("body").append(msgNotif);

socket.on('connect', (data) => {
  if (userName == null) {
    userName = yourName();
  }
  socket.emit('changeID', userName);
  $server_status.html('<h5 class="text-center m-0 bg-olive p-1">Server Online</h5>');
  initMessage();
});

socket.on('disconnect', (data) => {
  $server_status.html('<h5 class="text-center m-0 bg-danger p-1">Server Offline</h5>');
});

socket.on('user_join', () => {
  // $("#userNotif").trigger('pause');
  // $("#userNotif").trigger('play');
});

socket.on('getID', (data) => {
  yourID = data;
});
socket.on('id_changed', (data) => {
  $("#username").text('Hai ' + data);
  $("#username").parent().removeClass('d-none');
});

socket.on('list_user', (data) => {
  var utemp = `<button class="btn btn-lg btn-primary p-3 col-md-2 m-2 user" data-id="{0}">{1}</button>`;
  var duser = '';
  data.forEach(function (v) {
    if (v.id != yourID && v.name != '') {
      duser += utemp.format(v.id, v.name);
    }
  });
  $("#userlist").html(duser);
  $("#allwrap").html(`<button class="btn btn-lg bg-olive col-md-4 p-4 align-self-center user" data-id="all">SEMUA USER</button>`);
  initMessage();
});

var speech = [];
var play = false;

function initMessage() {
  socket.on('msg', async (data) => {
    speech.push(data.audio);
    if (!play) {
      play = true
      $(".user").each(function () {
        var _t = $(this);
        if (data.from == _t.data('id')) {
          _t.addClass('bg-warning');
        }
      });
      const audioBlob = new Blob(speech);
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      await audio.play();
      play = false
      speech = [];
    }
  });

  socket.on('stop', (data) => {
    $(".user").removeClass('bg-warning');
  });

  $('.user').each(function () {
    $(this).on('mousedown touchstart', function () {
      startRecording($(this));
      $(this).addClass("bg-danger");
    });
    $(this).on('mouseup mouseleave touchend touchleave', function () {
      stopRecording();
      socket.emit('endvoice');
      $(this).removeClass("bg-danger");
    });
  })
}

async function startRecording(user) {
  var send = {};
  var input = null;
  var delay = null
  var compressor = null;
  var context = new AudioContext();
  socket.emit('start', { 'sampleRate': context.sampleRate })

  navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      autoGainControl: true,
      noiseSupperssion: true,
      latency: 0.35
    },
    video: false,
  }).then(async (stream) => {
    input = await context.createMediaStreamSource(stream)
    delay = await context.createDelay(100)
    compressor = await context.createDynamicsCompressor()
    compressor.threshold.value = -50;
    compressor.knee.value = 40;
    compressor.ratio.value = 15;
    compressor.reduction.value = -20;
    compressor.attack.value = 0;
    compressor.release.value = 0.5;
    processor = await context.createScriptProcessor(8192, 1, 2);

    input.connect(delay)
    delay.connect(compressor)
    compressor.connect(processor)
    processor.connect(context.destination)

    processor.onaudioprocess = async (e) => {
      const voice = await e.inputBuffer.getChannelData(0)
      send.user_id = user.data('id');
      send.from = yourID;
      send.audio = await voice.buffer;
      await socket.emit('send_message', send);
    }
  }).catch((e) => {
    console.log(e)
  })
}

function stopRecording() {
  if (processor != null) {
    processor.disconnect()
    processor.onaudioprocess = null
    processor = null
  }
}
