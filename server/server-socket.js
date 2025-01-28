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

    socket.on("join room", async ({ gameCode, user }) => {
      try {
        socket.join(gameCode);
        socket.gameCode = gameCode;
        console.log("Player joined room:", gameCode, "User:", user);

        // Check if game exists in database
        let gameRoom = await GameRoom.findOne({ gameCode });
        if (!gameRoom) {
          throw new Error("Game room not found");
        }

        const room = io.sockets.adapter.rooms.get(gameCode);
        if (!room) {
          throw new Error("Socket room not found");
        }

        // Find existing player by database ID
        const existingPlayer = gameRoom.players.find(
          (p) => p.userId.toString() === user._id.toString()
        );

        if (existingPlayer) {
          // Player exists, update socket info
          socket.symbol = existingPlayer.symbol;
          socket.isHost = existingPlayer.isHost;
          socket.userId = user._id;

          // Send game state to reconnected player
          socket.emit("game:joined", {
            symbol: socket.symbol,
            isHost: socket.isHost,
            gameState: gameRoom.gameStarted
              ? {
                  board: gameRoom.board,
                  currentPlayer: gameRoom.currentPlayer,
                  winner: gameRoom.winner,
                  gameOver: !!gameRoom.winner, // Add gameOver status based on winner
                }
              : null,
          });

          // Notify other players about reconnection
          socket.to(gameCode).emit("player:reconnected", {
            userId: user._id,
            symbol: socket.symbol,
          });

          // Update room players
          io.to(gameCode).emit("player joined", {
            players: gameRoom.players.map((p) => ({
              socketId: p.userId,
              name: p.name,
              symbol: p.symbol,
              isHost: p.isHost,
              connected: true,
            })),
          });
        } else {
          socket.emit("game:error", {
            message: "Please join the game through the web interface first",
          });
          socket.leave(gameCode);
          return;
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
          { $sample: { size: 9 } },
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

        // Update game state in database
        const gameRoom = await GameRoom.findOne({ gameCode });
        if (!gameRoom) {
          throw new Error("Game room not found");
        }

        gameRoom.category = category;
        gameRoom.questions = questions;
        gameRoom.board = board;
        gameRoom.gameStarted = true;
        gameRoom.currentPlayer = "X";
        await gameRoom.save();

        console.log("Game state saved, emitting start event");

        // Emit start game event with board
        io.to(gameCode).emit("game:start", {
          board,
          currentPlayer: "X",
          category,
        });

        console.log("Game started successfully");
      } catch (err) {
        console.error("Error starting game:", err);
        socket.emit("game:error", { message: err.message });
      }
    });

    socket.on("claim cell", async ({ gameCode, index, answer, symbol }) => {
      try {
        const gameRoom = await GameRoom.findOne({ gameCode });
        if (!gameRoom) {
          throw new Error("Game not found");
        }

        if (gameRoom.board[index].solved) {
          throw new Error("Cell already claimed");
        }

        // Verify answer
        if (answer.toLowerCase() === gameRoom.board[index].answer.toLowerCase()) {
          // Send feedback only to the player who answered
          socket.emit("answer:correct", { index });

          // Update the board
          gameRoom.board[index].solved = true;
          gameRoom.board[index].player = symbol;

          // Check for winner
          const winner = checkWinner(gameRoom.board);
          if (winner) {
            gameRoom.winner = winner;
            gameRoom.gameOver = true;
          } else if (checkTie(gameRoom.board)) {
            gameRoom.winner = "tie";
            gameRoom.gameOver = true;
          }

          await gameRoom.save();

          // Emit board update to all players
          io.to(gameCode).emit("cell:claimed", {
            index,
            symbol,
          });

          if (gameRoom.gameOver) {
            io.to(gameCode).emit("game:over", {
              winner: gameRoom.winner,
              gameOver: true,
            });
          }
        } else {
          // Only notify the player who made incorrect guess
          socket.emit("answer:incorrect", { index });
        }
      } catch (err) {
        console.error("Error claiming cell:", err);
        socket.emit("game:error", { message: err.message });
      }
    });

    socket.on("make move", async ({ gameCode, position }) => {
      try {
        const gameRoom = await GameRoom.findOne({ gameCode });
        if (!gameRoom) {
          throw new Error("Game not found");
        }

        // Verify it's the player's turn
        if (gameRoom.currentPlayer !== socket.symbol) {
          throw new Error("Not your turn");
        }

        // Update the game state
        const updatedBoard = [...gameRoom.board];
        updatedBoard[position].player = socket.symbol;

        // Switch turns
        const nextPlayer = socket.symbol === "X" ? "O" : "X";

        // Save to database
        gameRoom.board = updatedBoard;
        gameRoom.currentPlayer = nextPlayer;
        await gameRoom.save();

        // Emit the updated state to all players
        io.to(gameCode).emit("game:update", {
          board: updatedBoard,
          currentPlayer: nextPlayer,
        });
      } catch (err) {
        console.error("Error making move:", err);
        socket.emit("game:error", { message: err.message });
      }
    });

    socket.on("disconnect", () => {
      console.log("Socket disconnected:", socket.id);

      if (socket.gameCode) {
        // Notify other players about disconnection
        socket.to(socket.gameCode).emit("player:disconnected", {
          socketId: socket.userId,
          symbol: socket.symbol,
        });
      }
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
    gameRoom.gameOver = state.gameOver || gameRoom.gameOver;

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
