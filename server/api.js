/*
|--------------------------------------------------------------------------
| api.js -- server routes
|--------------------------------------------------------------------------
|
| This file defines the routes for your server.
|
*/

const express = require("express");

// import models so we can interact with the database
const User = require("./models/user");
const Question = require("./models/question");
const Category = require("./models/category");
const GameRoom = require("./models/gameroom");

// import authentication library
const auth = require("./auth");

// api endpoints: all these paths will be prefixed with "/api/"
const router = express.Router();

//initialize socket
const socketManager = require("./server-socket");

router.post("/login", auth.login);
router.post("/logout", auth.logout);
router.get("/whoami", (req, res) => {
  if (!req.user) {
    // not logged in
    return res.send({});
  }

  res.send(req.user);
});

router.post("/initsocket", auth.ensureLoggedIn, (req, res) => {
  const socket = socketManager.getSocketFromSocketID(req.body.socketid);
  if (socket !== null) {
    socketManager.addUser(req.session.user, socket);
    res.send({});
  } else {
    res.status(400).send({ msg: "Invalid socket ID" });
  }
});

router.post("/disconnectsocket", (req, res) => {
  if (!req.user) {
    res.status(403).send({ msg: "Not logged in" });
    return;
  }

  const socket = socketManager.getSocketFromSocketID(req.body.socketid);
  if (socket) {
    socketManager.removeUser(req.user, socket);
  }
  res.send({});
});

// |------------------------------|
// | write your API methods below!|
// |------------------------------|

// Get random questions for a specific category
router.get("/questions/:category", async (req, res) => {
  try {
    const questions = await Question.aggregate([
      { $match: { category: req.params.category } },
      { $sample: { size: 9 } }, // Get 9 random questions for the game board
    ]);
    res.send(questions);
  } catch (err) {
    console.log(`Failed to get questions: ${err}`);
    res.status(500).send({ msg: "Failed to get questions" });
  }
});

// Initialize the database with questions (only run once)
router.post("/init-questions", async (req, res) => {
  try {
    // First check if questions already exist
    const count = await Question.countDocuments();
    if (count > 0) {
      // Clear existing questions to reinitialize with correct categories
      await Question.deleteMany({});
    }

    // Get questions from your MongoDB database
    const questions = await Question.find({});

    if (questions.length === 0) {
      console.log("No questions found in the database");
      res.status(404).send({ msg: "No questions found in database" });
      return;
    }

    res.send({ msg: "Questions retrieved successfully", count: questions.length });
  } catch (err) {
    console.error("Failed to initialize questions:", err);
    res.status(500).send({ msg: "Failed to initialize questions" });
  }
});

// Get all categories
router.get("/categories", async (req, res) => {
  try {
    const categories = await Category.find({}).sort({ level: 1, name: 1 });
    res.send(categories);
  } catch (error) {
    console.error("Error getting categories:", error);
    res.status(500).send({ error: "Failed to get categories" });
  }
});

// Get questions for a specific category
router.get("/categories/:categoryId/questions", async (req, res) => {
  try {
    const category = await Category.findById(req.params.categoryId);
    if (!category) {
      return res.status(404).send({ error: "Category not found" });
    }
    res.send(category.questions);
  } catch (err) {
    console.error("Failed to get questions:", err);
    res.status(500).send({ error: "Failed to get questions" });
  }
});

// Add a new category (admin only)
router.post("/categories", async (req, res) => {
  try {
    const category = new Category(req.body);
    await category.save();
    res.status(201).send(category);
  } catch (err) {
    console.error("Failed to create category:", err);
    res.status(500).send({ error: "Failed to create category" });
  }
});

// Add questions to a category (admin only)
router.post("/categories/:categoryId/questions", async (req, res) => {
  try {
    const category = await Category.findById(req.params.categoryId);
    if (!category) {
      return res.status(404).send({ error: "Category not found" });
    }
    category.questions.push(req.body);
    await category.save();
    res.status(201).send(category);
  } catch (err) {
    console.error("Failed to add question:", err);
    res.status(500).send({ error: "Failed to add question" });
  }
});

// Get random categories based on difficulty
router.get("/categories/random", async (req, res) => {
  try {
    const difficulty = req.query.difficulty || "medium";
    let levelCounts;

    // Define how many categories we need from each level
    switch (difficulty) {
      case "easy":
        levelCounts = { 1: 2, 2: 2 }; // 2 from level 1, 2 from level 2
        break;
      case "medium":
        levelCounts = { 1: 1, 2: 2, 3: 1 }; // 1 from level 1, 2 from level 2, 1 from level 3
        break;
      case "hard":
        levelCounts = { 1: 1, 2: 1, 3: 1, 4: 1 }; // 1 from each level
        break;
      default:
        throw new Error("Invalid difficulty level");
    }

    const selectedCategories = {};
    const usedNumbers = new Set();

    // Get categories for each level
    for (const level in levelCounts) {
      // Get all categories for this level
      const levelCategories = await Category.aggregate([
        { $match: { level: parseInt(level) } },
        { $sample: { size: levelCounts[level] * 5 } }, // Get many extra categories in case some don't have enough unique numbers
      ]);

      // Store all categories for this level
      selectedCategories[level] = levelCategories;
    }

    res.send({
      categories: selectedCategories,
      levelCounts: levelCounts, // Send the required count for each level
    });
  } catch (error) {
    console.error("Error getting random categories:", error);
    res.status(500).send({ error: "Failed to get random categories" });
  }
});

// Update user stats after a game
router.post("/stats/tictactoe", auth.ensureLoggedIn, async (req, res) => {
  try {
    // Find user and ensure they exist
    const user = await User.findById(req.user._id);
    if (!user) {
      console.error("User not found:", req.user._id);
      return res.status(404).send({ error: "User not found" });
    }
    console.log(req.user._id);
    // Initialize stats if they don't exist
    if (!user.stats || !user.stats.tictactoe) {
      user.stats = {
        tictactoe: {
          gamesPlayed: 0,
          gamesWon: 0,
          gamesLost: 0,
          gamesTied: 0,
          winStreak: 0,
          currentWinStreak: 0,
        },
      };
    }

    const { result } = req.body;
    console.log("Updating stats for user:", user._id, "Result:", result);

    // Update the stats
    const stats = user.stats.tictactoe;
    stats.gamesPlayed += 1;

    if (result === "win") {
      stats.gamesWon += 1;
      stats.currentWinStreak += 1;
      if (stats.currentWinStreak > stats.winStreak) {
        stats.winStreak = stats.currentWinStreak;
      }
    } else if (result === "loss") {
      stats.gamesLost += 1;
      stats.currentWinStreak = 0;
    } else if (result === "tie") {
      stats.gamesTied += 1;
      stats.currentWinStreak = 0;
    }

    // Mark the stats object as modified and save
    user.markModified("stats");
    await user.save();

    console.log("Updated stats:", user.stats.tictactoe);
    res.send(user.stats);
  } catch (err) {
    console.error("Failed to update stats:", err);
    res.status(500).send({ error: "Failed to update stats" });
  }
});

router.post("/stats/tictactoesingle", auth.ensureLoggedIn, async (req, res) => {
  try {
    // Find user and ensure they exist
    console.log(req.body);
    const user = await User.findById(req.body.userId);
    if (!user) {
      console.error("User not found:", req.body.userId);
      return res.status(404).send({ error: "User not found" });
    }
    console.log(req.body.userId);
    console.log(user);
    // Initialize stats if they don't exist
    if (!user.tictactoeStats) {
      console.log("Initializing stats for user:", user._id);
      user.tictactoeStats = {
        gamesPlayed: 0,
        gamesWon: 0,
        gamesLost: 0,
        gamesTied: 0,
        winStreak: 0,
        currentWinStreak: 0,
      };
    }

    result = req.body.won ? "win" : "loss";
    console.log("Updating stats for user:", user._id, "Result:", result);

    // Update the stats
    const stats = user.tictactoeStats;
    stats.gamesPlayed += 1;

    if (result === "win") {
      stats.gamesWon += 1;
      stats.currentWinStreak += 1;
      if (stats.currentWinStreak > stats.winStreak) {
        stats.winStreak = stats.currentWinStreak;
      }
    } else if (result === "loss") {
      stats.gamesLost += 1;
      stats.currentWinStreak = 0;
    } else if (result === "tie") {
      stats.gamesTied += 1;
      stats.currentWinStreak = 0;
    }

    // Mark the stats object as modified and save
    user.markModified("tictactoeStats");
    await user.save();

    console.log("Updated stats:", user.tictactoeStats);
    res.send(user.tictactoeStats);
  } catch (err) {
    console.error("Failed to update stats:", err);
    res.status(500).send({ error: "Failed to update stats" });
  }
});

// Get user stats
router.get("/stats", auth.ensureLoggedIn, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).send({ error: "User not found" });
    }

    // Return stats object with game-specific stats
    res.send({
      tictactoe: user.tictactoeStats || { gamesPlayed: 0, gamesWon: 0 },
      connections: user.connectionsStats || { gamesPlayed: 0, gamesWon: 0 },
      nerdle: user.nerdleStats || {
        gamesPlayed: 0,
        gamesWon: 0,
        streak: 0,
        longestStreak: 0,
        averageGuesses: 0,
      },
    });
  } catch (err) {
    console.error("Error getting stats:", err);
    res.status(500).send({ error: "Failed to get stats" });
  }
});

// Update game stats
router.post("/stats/:game", auth.ensureLoggedIn, async (req, res) => {
  try {
    const { game } = req.params;
    const { won, userId } = req.body;
    console.log(
      "Updating stats for user:",
      userId || req.user._id,
      "Result:",
      won ? "win" : "loss"
    );

    // Use provided userId if available, otherwise fall back to session user
    const user = await User.findById(userId || req.user._id);
    if (!user) {
      return res.status(404).send({ error: "User not found" });
    }

    // Get the correct stats field based on game type
    let statsField;
    switch (game) {
      case "tictactoe":
        statsField = "tictactoeStats";
        break;
      case "connections":
        statsField = "connectionsStats";
        break;
      case "nerdle":
        statsField = "nerdleStats";
        break;
      default:
        return res.status(400).send({ error: "Invalid game type" });
    }

    // Initialize stats object if it doesn't exist
    if (!user[statsField]) {
      user[statsField] = {
        gamesPlayed: 0,
        gamesWon: 0,
        gamesLost: 0,
        gamesTied: 0,
        winStreak: 0,
        currentWinStreak: 0,
      };
    }

    // Update Tic Tac Toe specific stats
    if (game === "tictactoe") {
      user[statsField].gamesPlayed += 1;
      if (won) {
        user[statsField].gamesWon += 1;
        user[statsField].currentWinStreak += 1;
        user[statsField].winStreak = Math.max(
          user[statsField].winStreak,
          user[statsField].currentWinStreak
        );
      } else {
        user[statsField].gamesLost += 1;
        user[statsField].currentWinStreak = 0;
      }
    }
    // Update other game stats
    else {
      user[statsField].gamesPlayed += 1;
      if (won) {
        user[statsField].gamesWon += 1;
        user[statsField].streak = (user[statsField].streak || 0) + 1;
        user[statsField].longestStreak = Math.max(
          user[statsField].streak || 0,
          user[statsField].longestStreak || 0
        );
      } else {
        user[statsField].streak = 0;
      }

      if (req.body.attempts && (game === "connections" || game === "nerdle")) {
        const attemptsField = game === "nerdle" ? "averageGuesses" : "averageAttempts";
        const totalAttempts =
          (user[statsField][attemptsField] || 0) * (user[statsField].gamesPlayed - 1) +
          req.body.attempts;
        user[statsField][attemptsField] = totalAttempts / user[statsField].gamesPlayed;
      }
    }

    await user.save();
    console.log("Updated stats:", user[statsField]);
    res.send(user[statsField]);
  } catch (err) {
    console.error("Error updating stats:", err);
    res.status(500).send({ error: "Failed to update stats" });
  }
});

router.get("/user/stats", auth.ensureLoggedIn, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json({ stats: user.stats });
  } catch (error) {
    console.error("Error fetching user stats:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get user settings
router.get("/settings", auth.ensureLoggedIn, (req, res) => {
  User.findById(req.user._id).then((user) => {
    res.send({ settings: user.settings });
  });
});

// Update user settings
router.post("/settings", auth.ensureLoggedIn, (req, res) => {
  User.findById(req.user._id).then((user) => {
    user.settings = {
      ...user.settings,
      ...req.body,
    };
    user.save().then((savedUser) => {
      res.send({ settings: savedUser.settings });
    });
  });
});

// Game Room endpoints
router.get("/gameroom/:gameCode", (req, res) => {
  const gameCode = req.params.gameCode;

  GameRoom.findOne({ gameCode })
    .then((room) => {
      if (!room) {
        res.status(404).send({ error: "Game room not found" });
        return;
      }

      console.log("Found game room:", room);
      res.send({
        gameCode: room.gameCode,
        category: room.category,
        players: room.players,
        started: room.gameStarted,
        questions: room.questions,
        board: room.board,
        currentPlayer: room.currentPlayer,
        winner: room.winner,
      });
    })
    .catch((err) => {
      console.error("Error finding game room:", err);
      res.status(500).send({ error: "Failed to get game room" });
    });
});

router.post("/gameroom/create", auth.ensureLoggedIn, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).send({ error: "User not found" });
    }

    // Generate a unique game code using the static method
    const gameCode = await GameRoom.generateGameCode();
    console.log("Creating game room for user:", user._id, "with code:", gameCode);

    // Create new room with host player
    const newRoom = new GameRoom({
      gameCode: gameCode,
      category: req.body.category || "easy",
      players: [
        {
          userId: user._id,
          name: user.name || "Player 1", // Ensure name is always set
          isHost: true,
          symbol: "X",
        },
      ],
      questions: [],
      board: Array(9)
        .fill()
        .map(() => ({
          value: "",
          answer: "",
          solved: false,
          player: null,
        })),
      gameStarted: false,
      currentPlayer: "X",
    });

    console.log("New room object:", newRoom);
    const savedRoom = await newRoom.save();
    console.log("Game room created:", savedRoom);

    res.send({
      gameCode: savedRoom.gameCode,
      category: savedRoom.category,
      isHost: true,
    });
  } catch (err) {
    console.error("Error in /gameroom/create:", err);
    res.status(500).send({ error: err.message || "Could not create game room" });
  }
});

router.post("/gameroom/join", auth.ensureLoggedIn, async (req, res) => {
  try {
    const { gameCode } = req.body;
    const user = req.user;

    if (!user) {
      console.log("No user found in request");
      return res.status(401).send({ error: "User not authenticated" });
    }

    console.log("User attempting to join room:", user._id, gameCode);

    const room = await GameRoom.findOne({ gameCode });
    if (!room) {
      return res.status(404).send({ error: "Invalid room code" });
    }

    // Check if user is already in the room (using database ID)
    const existingPlayer = room.players.find((p) => p.userId.toString() === user._id.toString());

    if (existingPlayer) {
      console.log("User reconnecting to room:", gameCode);
      return res.send({
        success: true,
        reconnecting: true,
        category: room.category,
        symbol: existingPlayer.symbol,
        isHost: existingPlayer.isHost,
      });
    }

    // For new players, check if room is full
    if (room.players.length >= 2) {
      console.log("Room is full:", gameCode);
      console.log("Current players:", room.players);
      return res.status(400).send({ error: "Room is full" });
    }

    // Add new player (always as non-host since host is added in create)
    const newPlayer = {
      userId: user._id,
      name: user.name || "Player 2", // Ensure name is always set
      isHost: false,
      symbol: "O",
    };

    room.players.push(newPlayer);
    await room.save();

    console.log("User joined room successfully. Current players:", room.players);
    res.send({
      success: true,
      reconnecting: false,
      category: room.category,
      symbol: "O",
      isHost: false,
    });
  } catch (err) {
    console.error("Error in /gameroom/join:", err);
    res.status(500).send({ error: "Could not join game room" });
  }
});

// Get game state
router.get("/game", (req, res) => {
  const gameCode = req.query.gameCode;
  if (!gameCode) {
    return res.status(400).json({ error: "No game code provided" });
  }

  GameRoom.findOne({ gameCode })
    .then((game) => {
      if (!game) {
        return res.status(404).json({ error: "Game not found" });
      }
      res.send({
        gameStarted: game.gameStarted,
        winner: game.winner,
        gameOver: game.gameOver,
      });
    })
    .catch((err) => {
      console.error("Error getting game state:", err);
      res.status(500).json({ error: "Failed to get game state" });
    });
});

// Question API routes
router.get("/question", (req, res) => {
  const { category } = req.query;

  // For now, return a sample question. You can expand this to use a database later
  const questions = {
    easy: [
      { _id: "1", question: "What is 2 + 2?", answer: "4" },
      { _id: "2", question: "What is 5 - 3?", answer: "2" },
      { _id: "3", question: "What is 3 × 3?", answer: "9" },
    ],
    medium: [
      { _id: "4", question: "What is 12 × 8?", answer: "96" },
      { _id: "5", question: "What is 15 + 27?", answer: "42" },
      { _id: "6", question: "What is 45 ÷ 5?", answer: "9" },
    ],
    hard: [
      { _id: "7", question: "What is 156 + 244?", answer: "400" },
      { _id: "8", question: "What is 17 × 13?", answer: "221" },
      { _id: "9", question: "What is 625 ÷ 25?", answer: "25" },
    ],
  };

  const categoryQuestions = questions[category] || questions.easy;
  const randomQuestion = categoryQuestions[Math.floor(Math.random() * categoryQuestions.length)];

  res.send(randomQuestion);
});

router.post("/check-answer", (req, res) => {
  const { questionId, answer } = req.body;

  // For now, we'll use the same questions object
  const allQuestions = [
    { _id: "1", question: "What is 2 + 2?", answer: "4" },
    { _id: "2", question: "What is 5 - 3?", answer: "2" },
    { _id: "3", question: "What is 3 × 3?", answer: "9" },
    { _id: "4", question: "What is 12 × 8?", answer: "96" },
    { _id: "5", question: "What is 15 + 27?", answer: "42" },
    { _id: "6", question: "What is 45 ÷ 5?", answer: "9" },
    { _id: "7", question: "What is 156 + 244?", answer: "400" },
    { _id: "8", question: "What is 17 × 13?", answer: "221" },
    { _id: "9", question: "What is 625 ÷ 25?", answer: "25" },
  ];

  const question = allQuestions.find((q) => q._id === questionId);

  if (!question) {
    return res.status(404).send({ msg: "Question not found" });
  }

  const isCorrect = String(question.answer).toLowerCase() === String(answer).toLowerCase();

  res.send({
    correct: isCorrect,
    message: isCorrect ? "Correct!" : "Incorrect, try again!",
  });
});

// Get all categories (for testing)
router.get("/categories", async (req, res) => {
  try {
    const categories = await Category.find({}).sort({ level: 1, name: 1 });
    res.send(categories);
  } catch (error) {
    console.error("Error getting categories:", error);
    res.status(500).send("Error getting categories");
  }
});

// Initialize categories in MongoDB (run this once)
router.post("/categories/init", async (req, res) => {
  try {
    // First, clear existing categories
    await Category.deleteMany({});
    res.send("Categories cleared successfully");
  } catch (error) {
    console.error("Error clearing categories:", error);
    res.status(500).send("Error clearing categories");
  }
});

// Update user stats for Connections game
router.post("/stats/connections", auth.ensureLoggedIn, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const { won, attempts } = req.body;

    // Update games played and won
    user.stats.connections.gamesPlayed += 1;
    if (won) {
      user.stats.connections.gamesWon += 1;
      user.stats.connections.streak += 1;
      user.stats.connections.longestStreak = Math.max(
        user.stats.connections.longestStreak,
        user.stats.connections.streak
      );
    } else {
      user.stats.connections.streak = 0;
    }

    // Update average attempts (only for won games)
    if (won) {
      const totalGamesWon = user.stats.connections.gamesWon;
      const currentAverage = user.stats.connections.averageAttempts;
      user.stats.connections.averageAttempts =
        (currentAverage * (totalGamesWon - 1) + attempts) / totalGamesWon;
    }

    await user.save();
    res.send(user);
  } catch (err) {
    console.error("Failed to update Connections stats:", err);
    res.status(500).send({ error: "Failed to update stats" });
  }
});

// anything else falls to this "not found" case
router.all("*", (req, res) => {
  console.log(`API route not found: ${req.method} ${req.url}`);
  res.status(404).send({ msg: "API route not found" });
});

module.exports = router;
