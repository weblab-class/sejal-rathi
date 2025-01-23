const GameRoom = require("./models/gameroom");
const Question = require("./models/question");
const socketio = require("socket.io");

const gameStates = {};

let io = null;

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

    socket.on("join room", ({ gameCode, user }) => {
      try {
        socket.join(gameCode);
        socket.gameCode = gameCode;
        console.log("Player joined room:", gameCode);

        const room = io.sockets.adapter.rooms.get(gameCode);
        if (!room) {
          throw new Error("Room not found");
        }

        if (room.size > 2) {
          socket.emit("game:error", { message: "Game room is full" });
          socket.leave(gameCode);
          return;
        }

        const symbol = room.size === 1 ? "X" : "O";
        socket.symbol = symbol;
        socket.isHost = symbol === "X";

        socket.emit("game:joined", { symbol, isHost: socket.isHost });
        io.to(gameCode).emit("player joined", {
          players: Array.from(room).map((id) => ({
            socketId: id,
            symbol: io.sockets.sockets.get(id).symbol,
            isHost: io.sockets.sockets.get(id).isHost,
          })),
        });

        if (room.size === 2) {
          console.log("Room is full, ready to start");
        }
      } catch (err) {
        console.error("Error in join room:", err);
        socket.emit("game:error", { message: err.message });
      }
    });

    socket.on("start game", async ({ gameCode, category }) => {
      try {
        console.log("Start game request:", { gameCode, category });

        const room = io.sockets.adapter.rooms.get(gameCode);
        if (!room || room.size !== 2) {
          socket.emit("game:error", { message: "Need exactly 2 players to start" });
          return;
        }

        if (!socket.isHost) {
          socket.emit("game:error", { message: "Only host can start game" });
          return;
        }

        // Get random questions from MongoDB
        const questions = await Question.aggregate([
          { $match: { category: category } },
          { $sample: { size: 9 } }
        ]);

        if (!questions || questions.length < 9) {
          throw new Error("Not enough questions available");
        }

        console.log("Retrieved questions from database for category:", category);

        // Create board with questions from database
        const board = questions.map((q) => ({
          value: q.question,
          answer: q.answer,
          solved: false,
          player: null,
        }));

        // Save to game state
        gameStates[gameCode] = {
          questions,
          board,
          currentPlayer: "X",
          started: true,
        };

        // First share questions with all players
        io.to(gameCode).emit("questions:received", { questions, board });
        console.log("Questions shared with room:", gameCode);

        // Wait a bit to ensure questions are received
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Then start the game
        io.to(gameCode).emit("game:start");
        console.log("Game started in room:", gameCode);

        // Finally start the countdown
        await new Promise((resolve) => setTimeout(resolve, 500));
        const startTime = Date.now();
        io.to(gameCode).emit("countdown:start", { startTime });
        console.log("Countdown started in room:", gameCode);
      } catch (err) {
        console.error("Error starting game:", err);
        socket.emit("game:error", { message: err.message });
      }
    });

    socket.on("questions:share", ({ gameCode, questions, board }) => {
      try {
        if (!socket.isHost) {
          socket.emit("game:error", { message: "Only host can share questions" });
          return;
        }

        // Save to game state
        gameStates[gameCode] = {
          questions,
          board,
          currentPlayer: "X",
          started: true,
        };

        // Share with other players
        io.to(gameCode).emit("questions:received", { questions, board });
        console.log("Questions shared in room:", gameCode);
      } catch (err) {
        console.error("Error sharing questions:", err);
        socket.emit("game:error", { message: err.message });
      }
    });

    socket.on("claim cell", ({ gameCode, index, answer, symbol }) => {
      try {
        const gameState = gameStates[gameCode];
        if (!gameState) {
          throw new Error("Game not found");
        }

        console.log("Cell claim attempt:", {
          gameCode,
          index,
          answer,
          playerSymbol: symbol,
        });

        // Convert both answers to strings and lowercase for comparison
        const correctAnswer = String(gameState.board[index].answer).toLowerCase();
        const userAnswer = String(answer).toLowerCase();

        if (correctAnswer === userAnswer) {
          gameState.board[index].solved = true;
          gameState.board[index].player = symbol;

          io.to(gameCode).emit("cell:claimed", {
            index,
            symbol: symbol,
          });
          console.log("Cell claimed successfully:", {
            index,
            symbol: symbol,
          });

          // Check for winner
          const winner = checkWinner(gameState.board);
          if (winner) {
            io.to(gameCode).emit("game:over", { winner });
          }
        } else {
          console.log("Incorrect answer");
        }
      } catch (err) {
        console.error("Error claiming cell:", err);
        socket.emit("game:error", { message: err.message });
      }
    });

    socket.on("disconnect", () => {
      console.log(`Socket ${socket.id} disconnected`);
    });

    socket.on("error", (error) => {
      console.error(`Socket ${socket.id} error:`, error);
    });
  });

  io.on("error", (err) => {
    console.log(`Socket server error: ${err}`);
  });
};

const userToSocketMap = {}; // maps user ID to socket object
const socketToUserMap = {}; // maps socket ID to user object
const gameRooms = new Map(); // maps game code to room data

const getAllConnectedUsers = () => Object.values(socketToUserMap);

const getSocketFromUserID = (userId) => {
  for (let client of Object.keys(socketToUserMap)) {
    if (socketToUserMap[client]?._id === userId) return client;
  }
};

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

const saveGameState = async (gameCode, state) => {
  try {
    console.log("Saving game state for room:", gameCode);
    console.log("State to save:", state);

    // Update the game room in the database
    const gameRoom = await GameRoom.findOne({ gameCode });
    if (!gameRoom) {
      throw new Error("Game room not found");
    }

    // Update game state
    gameRoom.questions = state.questions || gameRoom.questions;
    gameRoom.board = state.board || gameRoom.board;
    gameRoom.gameStarted = state.gameStarted || gameRoom.gameStarted;
    gameRoom.currentPlayer = state.currentPlayer || gameRoom.currentPlayer;
    gameRoom.winner = state.winner || gameRoom.winner;

    await gameRoom.save();
    console.log("Game state saved successfully");
  } catch (err) {
    console.error("Error saving game state:", err);
    throw err;
  }
};

const getGameState = (gameCode) => {
  if (!gameCode || !gameStates[gameCode]) {
    return null;
  }
  return gameStates[gameCode];
};

module.exports = {
  init,
  getIo: () => io,
  getSocketFromUserID,
  getUserFromSocketID,
  getSocketFromSocketID,
  addUser,
  removeUser,
  getAllConnectedUsers,
  saveGameState,
  getGameState,
};
