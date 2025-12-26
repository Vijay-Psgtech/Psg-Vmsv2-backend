let io;

function initSocket(server) {
  io = require("socket.io")(server, {
    cors: { origin: "*" },
  });

  io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);
  });
}

function emitEvent(event, data) {
  if (io) io.emit(event, data);
}

module.exports = { initSocket, emitEvent };
