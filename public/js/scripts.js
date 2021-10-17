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

$("body").append(userNotif);
$("body").append(msgNotif);

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
  $("#userNotif").trigger('pause');
  $("#userNotif").trigger('play');
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

function initMessage() {
  socket.on('msg', (data) => {
    const audioBlob = new Blob(data.audio);
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    audio.play();
    $(".user").each(function () {
      var _t = $(this);
      if (data.from == _t.data('id')) {
        _t.addClass('bg-warning');
      }
    });
  });

  socket.on('stop', (data) => {
    console.log("stop");
    $(".user").removeClass('bg-warning');
  });

  $('.user').each(function () {
    $(this).on('mousedown', function (e) {
      startRecording($(this));
      $(this).addClass("bg-danger");
    }).bind('mouseup mouseleave', function () {
      if (processor != null) {
        stopRecording($(this));
      }
      $(this).removeClass("bg-danger");
    });

  })
}

function startRecording(user) {
  var send = {};
  console.log('start recording')
  context = new window.AudioContext()
  socket.emit('start', { 'sampleRate': context.sampleRate })

  navigator.mediaDevices.getUserMedia({ audio: true, video: false }).then((stream) => {
    localstream = stream
    const input = this.context.createMediaStreamSource(stream)
    processor = context.createScriptProcessor(16384, 3, 3)

    input.connect(processor)
    processor.connect(context.destination)

    processor.onaudioprocess = (e) => {
      const voice = e.inputBuffer.getChannelData(0)
      send.user_id = user.data('id');
      send.from = yourID;
      send.audio = voice.buffer;
      socket.emit('send_message', send);
    }
  }).catch((e) => {
    console.log(e)
  })
}

function stopRecording(user) {
  console.log('stop recording')
  processor.disconnect()
  processor.onaudioprocess = null
  processor = null
  localstream.getTracks().forEach((track) => {
    track.stop()
  })
  localstream = null
  socket.emit('endvoice');
}
