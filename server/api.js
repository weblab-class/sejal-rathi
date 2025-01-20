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

router.post("/initsocket", (req, res) => {
  if (!req.user) {
    res.status(403).send({ msg: "Not logged in" });
    return;
  }

  const socket = socketManager.getSocketFromSocketID(req.body.socketid);
  if (!socket) {
    res.status(400).send({ msg: "Invalid socket connection" });
    return;
  }

  socketManager.addUser(req.user, socket);
  res.send({});
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
    const categories = await Category.find({});
    res.send(categories);
  } catch (err) {
    console.error("Failed to get categories:", err);
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

// Get 4 random categories (one from each level)
router.get("/categories/random", (req, res) => {
  const categories = [
    // Level 1 (Simple & Visually Obvious Patterns)
    {
      _id: "1_1",
      name: "Multiples of 5",
      level: 1,
      sampleNumbers: [5, 10, 15, 20, 25, 30, 35, 40, 45, 50],
    },
    {
      _id: "1_2",
      name: "Prime Numbers",
      level: 1,
      sampleNumbers: [2, 3, 5, 7, 11, 13, 17, 19, 23, 29],
    },
    {
      _id: "1_3",
      name: "Powers of 2",
      level: 1,
      sampleNumbers: [2, 4, 8, 16, 32, 64, 128, 256, 512, 1024],
    },
    {
      _id: "1_4",
      name: "Same Digit Repeated",
      level: 1,
      sampleNumbers: [11, 22, 33, 44, 55, 66, 77, 88, 99, 111],
    },
    {
      _id: "1_5",
      name: "Even Numbers",
      level: 1,
      sampleNumbers: [2, 4, 6, 8, 10, 12, 14, 16, 18, 20],
    },
    {
      _id: "1_6",
      name: "Odd Numbers",
      level: 1,
      sampleNumbers: [1, 3, 5, 7, 9, 11, 13, 15, 17, 19],
    },
    {
      _id: "1_7",
      name: "Multiples of 10",
      level: 1,
      sampleNumbers: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
    },
    {
      _id: "1_8",
      name: "Single Digit Numbers",
      level: 1,
      sampleNumbers: [1, 2, 3, 4, 5, 6, 7, 8, 9],
    },
    {
      _id: "1_9",
      name: "Ascending Digits",
      level: 1,
      sampleNumbers: [12, 23, 34, 45, 56, 67, 78, 89, 123, 234],
    },
    {
      _id: "1_10",
      name: "Descending Digits",
      level: 1,
      sampleNumbers: [21, 32, 43, 54, 65, 76, 87, 98],
    },

    // Level 2 (Recognizable Mathematical Patterns)
    {
      _id: "2_1",
      name: "Palindrome Numbers",
      level: 2,
      sampleNumbers: [11, 22, 33, 44, 55, 66, 77, 88, 99, 121],
    },
    {
      _id: "2_2",
      name: "Perfect Squares",
      level: 2,
      sampleNumbers: [1, 4, 9, 16, 25, 36, 49, 64, 81, 100],
    },
    {
      _id: "2_3",
      name: "Perfect Cubes",
      level: 2,
      sampleNumbers: [1, 8, 27, 64, 125, 216, 343, 512, 729, 1000],
    },
    {
      _id: "2_4",
      name: "Powers of 3",
      level: 2,
      sampleNumbers: [3, 9, 27, 81, 243, 729, 2187, 6561, 19683],
    },
    {
      _id: "2_5",
      name: "Powers of 5",
      level: 2,
      sampleNumbers: [5, 25, 125, 625, 3125, 15625, 78125, 390625],
    },
    {
      _id: "2_6",
      name: "Multiples of 7",
      level: 2,
      sampleNumbers: [7, 14, 21, 28, 35, 42, 49, 56, 63, 70],
    },
    {
      _id: "2_7",
      name: "Arithmetic Sequence (+3)",
      level: 2,
      sampleNumbers: [4, 7, 10, 13, 16, 19, 22, 25, 28, 31],
    },
    {
      _id: "2_8",
      name: "Geometric Sequence (×2)",
      level: 2,
      sampleNumbers: [3, 6, 12, 24, 48, 96, 192, 384, 768],
    },
    {
      _id: "2_9",
      name: "Triangular Numbers",
      level: 2,
      sampleNumbers: [1, 3, 6, 10, 15, 21, 28, 36, 45, 55],
    },
    {
      _id: "2_10",
      name: "Fibonacci Numbers",
      level: 2,
      sampleNumbers: [1, 1, 2, 3, 5, 8, 13, 21, 34, 55],
    },

    // Level 3 (Intermediate Mathematical Structures)
    {
      _id: "3_1",
      name: "Factorials",
      level: 3,
      sampleNumbers: [1, 2, 6, 24, 120, 720, 5040, 40320, 362880],
    },
    {
      _id: "3_2",
      name: "Perfect Numbers",
      level: 3,
      sampleNumbers: [6, 28, 496, 8128, 33550336],
    },
    {
      _id: "3_3",
      name: "Catalan Numbers",
      level: 3,
      sampleNumbers: [1, 1, 2, 5, 14, 42, 132],
    },
    {
      _id: "3_4",
      name: "Highly Composite Numbers",
      level: 3,
      sampleNumbers: [12, 24, 36, 48, 60, 120, 180, 240, 360],
    },

    // Level 4 (Advanced & Less Obvious Patterns)
    {
      _id: "4_1",
      name: "Lucas Sequence",
      level: 4,
      sampleNumbers: [1, 3, 4, 7, 11, 18, 29, 47, 76, 123],
    },
    {
      _id: "4_2",
      name: "Double Factorial (Even)",
      level: 4,
      sampleNumbers: [2, 8, 48, 384, 3840, 46080],
    },
    {
      _id: "4_3",
      name: "Pentagonal Numbers",
      level: 4,
      sampleNumbers: [1, 5, 12, 22, 35, 51, 70, 92, 117, 145],
    },
    {
      _id: "4_4",
      name: "Bell Numbers",
      level: 4,
      sampleNumbers: [1, 1, 2, 5, 15, 52, 203, 877, 4140, 21147],
    },
    {
      _id: "4_5",
      name: "Happy Numbers",
      level: 4,
      sampleNumbers: [1, 7, 10, 13, 19, 23, 28, 31, 32, 44],
    },
  ];

  // Get one random category from each level
  const selectedCategories = [];
  for (let level = 1; level <= 4; level++) {
    const levelCategories = categories.filter((cat) => cat.level === level);
    const randomIndex = Math.floor(Math.random() * levelCategories.length);
    selectedCategories.push(levelCategories[randomIndex]);
  }

  res.send(selectedCategories);
});

// anything else falls to this "not found" case
router.all("*", (req, res) => {
  console.log(`API route not found: ${req.method} ${req.url}`);
  res.status(404).send({ msg: "API route not found" });
});

module.exports = router;
