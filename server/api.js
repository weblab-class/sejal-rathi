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
    const difficulty = req.query.difficulty || 'medium';
    let levelCounts;

    // Define how many categories we need from each level
    switch (difficulty) {
      case 'easy':
        levelCounts = { 1: 2, 2: 2 }; // 2 from level 1, 2 from level 2
        break;
      case 'medium':
        levelCounts = { 1: 1, 2: 2, 3: 1 }; // 1 from level 1, 2 from level 2, 1 from level 3
        break;
      case 'hard':
        levelCounts = { 1: 1, 2: 1, 3: 1, 4: 1 }; // 1 from each level
        break;
      default:
        levelCounts = { 1: 1, 2: 2, 3: 1 };
    }

    const selectedCategories = [];
    const usedNumbers = new Set();

    // Get categories for each level
    for (const [level, count] of Object.entries(levelCounts)) {
      // Get all categories for this level
      const levelCategories = await Category.aggregate([
        { $match: { level: parseInt(level) } },
        { $sample: { size: count * 2 } } // Get extra categories in case some don't have enough unique numbers
      ]);

      let categoriesAdded = 0;
      for (const category of levelCategories) {
        if (categoriesAdded >= count) break;

        // Filter out numbers that are already used
        const availableNumbers = category.sampleNumbers.filter(num => !usedNumbers.has(num));
        
        if (availableNumbers.length >= 4) {
          // Take exactly 4 random numbers from available numbers
          const selectedNumbers = availableNumbers
            .sort(() => Math.random() - 0.5)
            .slice(0, 4);
          
          // Add these numbers to used numbers set
          selectedNumbers.forEach(num => usedNumbers.add(num));
          
          // Add category with its selected numbers
          selectedCategories.push({
            ...category,
            sampleNumbers: selectedNumbers
          });
          
          categoriesAdded++;
        }
      }

      if (categoriesAdded < count) {
        throw new Error(`Not enough categories with unique numbers for level ${level}`);
      }
    }

    res.send(selectedCategories);
  } catch (error) {
    console.error("Error getting random categories:", error);
    res.status(500).send(error.message);
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

// Get user stats
router.get("/stats", auth.ensureLoggedIn, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      console.error("User not found:", req.user._id);
      return res.status(404).send({ error: "User not found" });
    }

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
      await user.save();
    }

    console.log("Retrieved stats for user:", user._id, "Stats:", user.stats);
    res.send(user.stats);
  } catch (err) {
    console.error("Failed to get stats:", err);
    res.status(500).send({ error: "Failed to get stats" });
  }
});

// Get user stats
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
router.post("/gameroom/create", auth.ensureLoggedIn, async (req, res) => {
  try {
    const gameCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const { category } = req.body;

    // Get the current user from the auth middleware
    const user = req.user;
    if (!user) {
      console.log("No user found in request");
      return res.status(401).send({ error: "User not authenticated" });
    }

    console.log("Creating game room for user:", user._id, "with code:", gameCode);

    const newRoom = new GameRoom({
      code: gameCode,
      category: category || "easy",
      players: [
        {
          userId: user._id,
          name: user.name,
          isHost: true,
        },
      ],
    });

    const savedRoom = await newRoom.save();
    console.log("Game room created:", savedRoom);
    res.send({ gameCode: savedRoom.code });
  } catch (err) {
    console.error("Error in /gameroom/create:", err);
    res.status(500).send({ error: "Could not create game room" });
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

    const room = await GameRoom.findOne({ code: gameCode });
    if (!room) {
      return res.status(404).send({ error: "Invalid room code" });
    }

    if (room.players.length >= 2) {
      return res.status(400).send({ error: "Room is full" });
    }

    // Check if user is already in the room
    const existingPlayer = room.players.find((p) => p.userId.toString() === user._id.toString());
    if (existingPlayer) {
      return res.send({ success: true }); // Already in room
    }

    // Add player to room
    room.players.push({
      userId: user._id,
      name: user.name,
      isHost: false,
    });

    await room.save();
    console.log("User joined room successfully:", room);
    res.send({ success: true });
  } catch (err) {
    console.error("Error in /gameroom/join:", err);
    res.status(500).send({ error: "Could not join game room" });
  }
});

router.get("/gameroom/:code", auth.ensureLoggedIn, (req, res) => {
  GameRoom.findOne({ code: req.params.code })
    .then((room) => {
      if (!room) {
        return res.status(404).send({ error: "Room not found" });
      }
      res.send(room);
    })
    .catch((err) => {
      console.log("Error getting game room:", err);
      res.status(500).send({ error: "Could not get game room" });
    });
});

router.post("/gameroom/:code/leave", auth.ensureLoggedIn, (req, res) => {
  const user = req.user;
  if (!user) {
    return res.status(401).send({ error: "User not authenticated" });
  }

  GameRoom.findOne({ code: req.params.code })
    .then((room) => {
      if (!room) {
        return res.status(404).send({ error: "Room not found" });
      }

      room.players = room.players.filter((p) => p.userId !== user._id.toString());

      if (room.players.length === 0) {
        return GameRoom.deleteOne({ code: req.params.code });
      }

      return room.save();
    })
    .then(() => {
      res.send({ success: true });
    })
    .catch((err) => {
      console.log("Error leaving game room:", err);
      res.status(500).send({ error: "Could not leave game room" });
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

  const question = allQuestions.find(q => q._id === questionId);
  
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
