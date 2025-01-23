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

const checkWinner = (currentBoard) => {
  const winPatterns = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8], // Rows
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8], // Columns
    [0, 4, 8],
    [2, 4, 6], // Diagonals
  ];

  for (const pattern of winPatterns) {
    const [a, b, c] = pattern;
    if (
      currentBoard[a] &&
      currentBoard[a].solved &&
      currentBoard[b] &&
      currentBoard[b].solved &&
      currentBoard[c] &&
      currentBoard[c].solved &&
      currentBoard[a].player === currentBoard[b].player &&
      currentBoard[b].player === currentBoard[c].player
    ) {
      return currentBoard[a].player;
    }
  }
  return null;
};

const checkTie = (currentBoard) => {
  return currentBoard.every((cell) => cell && cell.solved);
};

const init = (server, sessionMiddleware) => {
  io = socketio(server, {
    cors: {
      origin: ["https://x-factor-puzzles.onrender.com", "http://localhost:5173"],
      credentials: true,
      methods: ["GET", "POST"],
      allowedHeaders: ["Content-Type"],
    },
  });

  // Use session middleware
  io.use((socket, next) => {
    sessionMiddleware(socket.request, {}, next);
  });

  io.on("connection", (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Debug listener for all events
    socket.onAny((eventName, ...args) => {
      console.log(`Socket ${socket.id} received event '${eventName}':`, args);
    });

    socket.on("disconnect", () => {
      const user = getUserFromSocketID(socket.id);
      if (user) removeUser(user, socket);
      console.log(`Socket ${socket.id} disconnected`);
    });

    socket.on("error", (error) => {
      console.error(`Socket ${socket.id} error:`, error);
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
          gameRooms.set(gameCode, {
            waitingPlayers: [],
            inGamePlayers: [],
            board: Array(9).fill(null),
            started: false,
          });
        }
        const gameRoom = gameRooms.get(gameCode);
        const user = getUserFromSocketID(socket.id);

        if (user && !gameRoom.inGamePlayers.includes(user._id)) {
          gameRoom.inGamePlayers.push(user._id);
          console.log(`Added user ${user._id} to room ${gameCode}`);
        }

        console.log(`Room ${gameCode} players:`, gameRoom.waitingPlayers);
        io.to(gameCode).emit("player joined", { players: gameRoom.waitingPlayers });
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
          category: category,
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

    socket.on("game:move", (data) => {
      const { gameCode, cellIndex, answer, question, correctAnswer } = data;
      const room = gameRooms.get(gameCode);

      if (!room) {
        console.error(`Room ${gameCode} not found`);
        return;
      }

      const player = room.inGamePlayers.find((p) => p.socket === socket.id);
      if (!player) {
        console.error(`Player ${socket.id} not found in room ${gameCode}`);
        return;
      }

      // Check if the cell is already solved
      if (room.board[cellIndex]?.solved) {
        console.log(`Cell ${cellIndex} already solved in game ${gameCode}`);
        return;
      }

      // Verify the answer
      if (!question || !correctAnswer) {
        console.error("Missing question or correct answer");
        return;
      }

      const isCorrect = String(correctAnswer).toLowerCase() === String(answer).toLowerCase();
      console.log(`Answer check for cell ${cellIndex}: ${isCorrect}`);

      if (isCorrect) {
        // Update the board
        room.board[cellIndex] = {
          ...room.board[cellIndex],
          solved: true,
          player: player.symbol,
        };
        gameRooms.set(gameCode, room);

        // Notify all players about the move
        io.to(gameCode).emit("cell_claimed", {
          index: cellIndex,
          symbol: player.symbol,
        });

        // Check for winner
        const winner = checkWinner(room.board);
        if (winner) {
          io.to(gameCode).emit("game:over", { winner });
          gameRooms.delete(gameCode);
        } else {
          // Check for tie
          const tie = room.board.every((cell) => cell.solved);
          if (tie) {
            io.to(gameCode).emit("game:over", { winner: "tie" });
            gameRooms.delete(gameCode);
          }
        }
      }
    });

    socket.on("game:join", ({ gameCode, user }) => {
      try {
        console.log(`Player ${socket.id} attempting to join game ${gameCode}`);

        // Get or create game room
        let room = gameRooms.get(gameCode);

        // Create new room if it doesn't exist
        if (!room) {
          console.log(`Creating new game room ${gameCode}`);
          room = {
            waitingPlayers: [], // List for players in the waiting room
            inGamePlayers: [], // List for players in the game
            board: Array(9).fill(null),
            started: false,
          };
          gameRooms.set(gameCode, room);
        }

        console.log(room);
        // Check room capacity
        if (room.waitingPlayers.length >= 2) {
          console.log(`Room ${gameCode} is full. Current players:`, room.waitingPlayers);
          socket.emit("game:error", { message: "Game room is full" });
          return;
        }

        // Add player to waiting room
        const player = { socket: socket.id, user };
        room.waitingPlayers.push(player);
        console.log(`Added player to waiting room ${gameCode}:`, {
          socket: player.socket,
          totalPlayers: room.waitingPlayers.length,
        });

        // Join socket room and notify player

        socket.join(gameCode);
        socket.emit("game:joined", {
          message: "Waiting for another player...",
          symbol: room.waitingPlayers.length === 1 ? "X" : "O",
        });

        // Start game if room is full
        if (room.waitingPlayers.length === 2 && !room.started) {
          console.log(
            `Starting game ${gameCode} with players:`,
            room.waitingPlayers.map((p) => p.socket)
          );
          room.started = true;
          // Move players to in-game list only when the game starts
          console.log(room.waitingPlayers);
          room.inGamePlayers = room.waitingPlayers.map((p, index) => ({
            socket: p.socket,
            symbol: index === 0 ? "X" : "O",
          }));
          room.waitingPlayers = []; // Clear waiting room
          io.to(gameCode).emit("game:start", {
            players: room.inGamePlayers,
            board: room.board,
          });
        }
      } catch (error) {
        console.error("Error in game:join:", error);
        socket.emit("game:error", { message: "Failed to join game" });
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

    socket.on("questions:share", ({ gameCode, questions, board }) => {
      try {
        if (!gameCode || !Array.isArray(questions) || !Array.isArray(board)) {
          throw new Error("Invalid game data format");
        }

        console.log(`Sharing questions for game ${gameCode}`);
        const room = gameRooms.get(gameCode);
        if (!room) {
          throw new Error("Game room not found");
        }

        // Store questions and board in the room
        room.questions = questions;
        room.board = board;
        gameRooms.set(gameCode, room);

        // Share questions with all players in the room
        console.log(`Broadcasting questions to room ${gameCode}`);
        io.to(gameCode).emit("questions:received", {
          questions: questions,
          board: board,
        });

        // Start the game if both players are ready
        if (room.inGamePlayers.length === 2) {
          console.log(`Starting game ${gameCode} with questions`);
          io.to(gameCode).emit("game:ready", {
            players: room.inGamePlayers,
            questions: questions,
            board: board,
          });
        }
      } catch (error) {
        console.error("Error sharing questions:", error);
        socket.emit("game:error", {
          message: error.message || "Failed to share questions",
          details: error.stack,
        });
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
