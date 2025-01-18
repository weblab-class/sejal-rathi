const GameRoom = require("./models/gameroom");
const socketio = require("socket.io");

let io;

const userToSocketMap = {}; // maps user ID to socket object
const socketToUserMap = {}; // maps socket ID to user object
const gameRooms = new Map(); // maps game code to room data

const getAllConnectedUsers = () => Object.values(socketToUserMap);
const getSocketFromUserID = (userid) => userToSocketMap[userid];
const getUserFromSocketID = (socketid) => socketToUserMap[socketid];
const getSocketFromSocketID = (socketid) => {
  if (io) {
    return io.sockets.sockets.get(socketid);
  }
  return null;
};

const addUser = (user, socket) => {
  const oldSocket = userToSocketMap[user._id];
  if (oldSocket && oldSocket.id !== socket.id) {
    // there was an old tab open for this user, force it to disconnect
    oldSocket.disconnect();
    delete socketToUserMap[oldSocket.id];
  }

  userToSocketMap[user._id] = socket;
  socketToUserMap[socket.id] = user;
  socket.join(user._id);
};

const removeUser = (user, socket) => {
  if (user) delete userToSocketMap[user._id];
  delete socketToUserMap[socket.id];
  if (user) socket.leave(user._id);
};

const init = (server) => {
  io = socketio(server, {
    cors: {
      origin: ["http://localhost:5173", "http://localhost:3000"],
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    socket.on("disconnect", (reason) => {
      console.log(`Socket disconnected: ${socket.id} due to ${reason}`);
      const user = getUserFromSocketID(socket.id);
      removeUser(user, socket);
    });

    socket.on("error", (err) => {
      console.log(`Socket error: ${socket.id} - ${err}`);
    });

    socket.on("join room", (gameCode) => {
      try {
        const user = getUserFromSocketID(socket.id);
        if (!user) {
          console.log("No user found for socket:", socket.id);
          return;
        }

        // Join the game room
        socket.join(gameCode);

        if (!gameRooms.has(gameCode)) {
          gameRooms.set(gameCode, { players: [] });
        }
        const room = gameRooms.get(gameCode);
        if (!room.players.includes(user._id)) {
          room.players.push(user._id);
        }
        io.to(gameCode).emit("player joined", { players: room.players });
      } catch (err) {
        console.log(`Error joining room: ${err}`);
      }
    });

    socket.on("leave room", (gameCode) => {
      try {
        const user = getUserFromSocketID(socket.id);
        if (!user) return;

        socket.leave(gameCode);
        const room = gameRooms.get(gameCode);
        if (room) {
          room.players = room.players.filter((id) => id !== user._id);
          if (room.players.length === 0) {
            gameRooms.delete(gameCode);
          } else {
            io.to(gameCode).emit("player left", { players: room.players });
          }
        }
      } catch (err) {
        console.log(`Error leaving room: ${err}`);
      }
    });
  });

  io.on("error", (err) => {
    console.log(`Socket server error: ${err}`);
  });
};

module.exports = {
  init,
  getSocketFromUserID,
  getUserFromSocketID,
  getSocketFromSocketID,
  addUser,
  removeUser,
  getAllConnectedUsers,
};
