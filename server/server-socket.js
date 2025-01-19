const GameRoom = require("./models/gameroom");
const socketio = require("socket.io");

let io;

const userToSocketMap = {}; // maps user ID to socket object
const socketToUserMap = {}; // maps socket ID to user object
const gameRooms = new Map(); // maps game code to room data
const gameStates = new Map(); // maps game code to game state

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

const checkWinner = (board) => {
  // implement logic to check for a winner
  // for now, just return null
  return null;
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

    // Game room management
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

    socket.on("cell_claimed", ({ gameCode, index, symbol }) => {
      try {
        console.log(`Player claimed cell ${index} with symbol ${symbol} in game ${gameCode}`);
        // Broadcast the move to all players in the room except the sender
        socket.to(gameCode).emit("cell_claimed", { index, symbol });
      } catch (err) {
        console.error(`Error handling cell claim:`, err);
      }
    });

    socket.on("game:move", async (data) => {
      const { gameCode, cellIndex, answer, question } = data;
      const game = gameStates.get(gameCode);
      
      if (!game) return;

      const player = game.players.find((p) => p.socket === socket.id);
      if (!player) return;

      // Check if it's a valid move
      if (game.board[cellIndex].solved) return;

      try {
        // Verify answer with the question
        const isCorrect = String(answer).toLowerCase() === String(question.answer).toLowerCase();

        if (isCorrect) {
          // Update the game state
          game.board[cellIndex] = {
            ...game.board[cellIndex],
            solved: true,
            player: player.symbol
          };

          // Notify all players about the move
          io.to(gameCode).emit("cell_claimed", {
            index: cellIndex,
            symbol: player.symbol
          });

          // Check for winner
          const winner = checkWinner(game.board);
          if (winner) {
            io.to(gameCode).emit("game:over", { winner });
            gameStates.delete(gameCode);
          }
        }
      } catch (err) {
        console.error("Error checking answer:", err);
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
