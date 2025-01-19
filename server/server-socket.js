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

const init = (server, sessionMiddleware) => {
  io = socketio(server, {
    cors: {
      origin: ["http://localhost:5173", "http://localhost:3000"],
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  // Use session middleware if provided
  if (sessionMiddleware) {
    io.use(sessionMiddleware);
  }

  io.on("connection", (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Debug listener for all events
    socket.onAny((eventName, ...args) => {
      console.log(`Socket ${socket.id} received event '${eventName}':`, args);
    });

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
        console.log(`Socket ${socket.id} joining room ${gameCode}`);
        socket.join(gameCode);
        
        // Debug room info after join
        const room = io.sockets.adapter.rooms.get(gameCode);
        console.log(`Room ${gameCode} size after join:`, room ? room.size : 0);
        
        if (!gameRooms.has(gameCode)) {
          gameRooms.set(gameCode, { players: [] });
        }
        const gameRoom = gameRooms.get(gameCode);
        const user = getUserFromSocketID(socket.id);
        
        if (user && !gameRoom.players.includes(user._id)) {
          gameRoom.players.push(user._id);
          console.log(`Added user ${user._id} to room ${gameCode}`);
        }

        console.log(`Room ${gameCode} players:`, gameRoom.players);
        io.to(gameCode).emit("player joined", { players: gameRoom.players });
      } catch (err) {
        console.error(`Error joining room:`, err);
      }
    });

    socket.on("game_started", ({ gameCode, category }) => {
      try {
        console.log(`Game start requested for room ${gameCode} with category ${category}`);
        
        // Debug room info
        const room = io.sockets.adapter.rooms.get(gameCode);
        console.log(`Room ${gameCode} exists:`, !!room);
        if (room) {
          console.log(`Room ${gameCode} size:`, room.size);
          console.log(`Room ${gameCode} sockets:`, Array.from(room));
        }
        
        // Debug socket info
        console.log(`Current socket rooms:`, Array.from(socket.rooms));
        
        // We don't need to check gameRooms, just broadcast to the room
        console.log(`Broadcasting game_started to room ${gameCode}`);
        io.to(gameCode).emit("game_started", {
          category: category
        });
        
        // Verify the event was sent
        console.log(`Broadcast complete to room ${gameCode}`);
      } catch (err) {
        console.error(`Error starting game:`, err);
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
