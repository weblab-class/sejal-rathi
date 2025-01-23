const GameRoom = require("./models/gameroom");
const socketio = require("socket.io");

const gameStates = {};

let io;

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
          players: Array.from(room).map(id => ({
            socketId: id,
            symbol: io.sockets.sockets.get(id).symbol,
            isHost: io.sockets.sockets.get(id).isHost
          }))
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

        // Get questions for the game
        const questions = getQuestionsByCategory(category);
        console.log("Generated questions for category:", category, questions);

        // Create board with questions
        const board = questions.map(q => ({
          value: q.question,
          answer: q.answer,
          solved: false,
          player: null
        }));
        console.log("Created board:", board);

        // Save to game state
        gameStates[gameCode] = {
          questions,
          board,
          currentPlayer: "X",
          started: true
        };
        console.log("Saved game state for room:", gameCode);

        // First share questions with all players
        io.to(gameCode).emit("questions:received", { questions, board });
        console.log("Questions shared with room:", gameCode);

        // Wait a bit to ensure questions are received
        await new Promise(resolve => setTimeout(resolve, 500));

        // Then start the game
        io.to(gameCode).emit("game:start");
        console.log("Game started in room:", gameCode);

        // Finally start the countdown
        await new Promise(resolve => setTimeout(resolve, 500));
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
          started: true
        };

        // Share with other players
        io.to(gameCode).emit("questions:received", { questions, board });
        console.log("Questions shared in room:", gameCode);

      } catch (err) {
        console.error("Error sharing questions:", err);
        socket.emit("game:error", { message: err.message });
      }
    });

    socket.on("claim cell", ({ gameCode, index, answer }) => {
      try {
        const gameState = gameStates[gameCode];
        if (!gameState) {
          throw new Error("Game not found");
        }

        if (answer.toLowerCase() === gameState.board[index].answer.toLowerCase()) {
          gameState.board[index].solved = true;
          gameState.board[index].player = socket.symbol;
          
          io.to(gameCode).emit("cell:claimed", {
            index,
            symbol: socket.symbol,
          });

          // Check for winner
          const winner = checkWinner(gameState.board);
          if (winner) {
            io.to(gameCode).emit("game:over", { winner });
          }
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

const QUESTIONS = {
  easy: [
    { question: "What is 2 + 2?", answer: "4" },
    { question: "What is 5 - 3?", answer: "2" },
    { question: "What is 3 x 4?", answer: "12" },
    { question: "What is 10 ÷ 2?", answer: "5" },
    { question: "What is 7 + 3?", answer: "10" },
    { question: "What is 8 - 5?", answer: "3" },
    { question: "What is 6 x 2?", answer: "12" },
    { question: "What is 9 ÷ 3?", answer: "3" },
    { question: "What is 4 + 6?", answer: "10" },
  ],
  medium: [
    { question: "What is 12 x 8?", answer: "96" },
    { question: "What is 45 ÷ 5?", answer: "9" },
    { question: "What is 23 + 59?", answer: "82" },
    { question: "What is 67 - 38?", answer: "29" },
    { question: "What is 15 x 7?", answer: "105" },
    { question: "What is 72 ÷ 8?", answer: "9" },
    { question: "What is 44 + 67?", answer: "111" },
    { question: "What is 89 - 45?", answer: "44" },
    { question: "What is 13 x 6?", answer: "78" },
  ],
  hard: [
    { question: "What is 156 + 289?", answer: "445" },
    { question: "What is 423 - 167?", answer: "256" },
    { question: "What is 25 x 18?", answer: "450" },
    { question: "What is 144 ÷ 12?", answer: "12" },
    { question: "What is 234 + 567?", answer: "801" },
    { question: "What is 789 - 345?", answer: "444" },
    { question: "What is 36 x 15?", answer: "540" },
    { question: "What is 225 ÷ 15?", answer: "15" },
    { question: "What is 678 + 234?", answer: "912" },
  ],
};

const getQuestionsByCategory = (category) => {
  const questions = QUESTIONS[category] || QUESTIONS.easy;
  // Shuffle questions and take 9
  return [...questions]
    .sort(() => Math.random() - 0.5)
    .slice(0, 9);
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
