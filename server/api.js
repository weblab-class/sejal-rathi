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
  // do nothing if user not logged in
  if (req.user)
    socketManager.addUser(req.user, socketManager.getSocketFromSocketID(req.body.socketid));
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
      return res.send({ msg: "Questions already initialized" });
    }

    const questions = [
      // Easy Arithmetic
      { question: "2 + 3", answer: 5, category: "easy" },
      { question: "7 - 4", answer: 3, category: "easy" },
      { question: "1 + 6", answer: 7, category: "easy" },
      { question: "8 - 5", answer: 3, category: "easy" },
      { question: "4 + 2", answer: 6, category: "easy" },
      { question: "9 - 3", answer: 6, category: "easy" },
      { question: "5 + 1", answer: 6, category: "easy" },
      { question: "7 - 2", answer: 5, category: "easy" },
      { question: "3 + 4", answer: 7, category: "easy" },
      
      // Normal Arithmetic
      { question: "12 × 3", answer: 36, category: "normal" },
      { question: "45 ÷ 5", answer: 9, category: "normal" },
      { question: "18 + 27", answer: 45, category: "normal" },
      { question: "56 - 19", answer: 37, category: "normal" },
      { question: "8 × 7", answer: 56, category: "normal" },
      { question: "72 ÷ 8", answer: 9, category: "normal" },
      { question: "31 + 16", answer: 47, category: "normal" },
      { question: "64 - 25", answer: 39, category: "normal" },
      { question: "6 × 9", answer: 54, category: "normal" },
      
      // Difficult Arithmetic
      { question: "3.14 + 2.86", answer: 6, category: "difficult" },
      { question: "7.5 × 1.2", answer: 9, category: "difficult" },
      { question: "15.3 - 6.3", answer: 9, category: "difficult" },
      { question: "24 ÷ 2.5", answer: 9.6, category: "difficult" },
      { question: "4.8 + 5.2", answer: 10, category: "difficult" },
      { question: "12.6 - 3.6", answer: 9, category: "difficult" },
      { question: "2.5 × 3.6", answer: 9, category: "difficult" },
      { question: "18 ÷ 1.5", answer: 12, category: "difficult" },
      { question: "5.7 + 4.3", answer: 10, category: "difficult" },
      
      // Calculus
      { question: "d/dx(x²)", answer: "2x", category: "calculus" },
      { question: "d/dx(3x + 2)", answer: "3", category: "calculus" },
      { question: "∫x dx", answer: "x²/2", category: "calculus" },
      { question: "d/dx(x³)", answer: "3x²", category: "calculus" },
      { question: "∫2x dx", answer: "x²", category: "calculus" },
      { question: "d/dx(sin x)", answer: "cos x", category: "calculus" },
      { question: "∫1 dx", answer: "x", category: "calculus" },
      { question: "d/dx(e^x)", answer: "e^x", category: "calculus" },
      { question: "∫0 dx", answer: "C", category: "calculus" },
      
      // Word Problems
      { question: "John has 5 apples and gets 3 more. How many does he have?", answer: 8, category: "word" },
      { question: "There are 10 birds, 4 fly away. How many remain?", answer: 6, category: "word" },
      { question: "A shop has 15 candies and sells 6. How many are left?", answer: 9, category: "word" },
      { question: "Sam has 7 marbles and finds 2 more. Total marbles?", answer: 9, category: "word" },
      { question: "20 students, 12 are boys. How many girls?", answer: 8, category: "word" },
      { question: "16 cookies shared by 2 friends equally. Each gets?", answer: 8, category: "word" },
      { question: "9 books on shelf, add 3 more. Total books?", answer: 12, category: "word" },
      { question: "14 pencils, 6 are red. How many aren't red?", answer: 8, category: "word" },
      { question: "11 cars, 2 leave parking. Cars remaining?", answer: 9, category: "word" },
    ];

    await Question.insertMany(questions);
    res.send({ msg: "Questions initialized successfully" });
  } catch (err) {
    console.log(`Failed to initialize questions: ${err}`);
    res.status(500).send({ msg: "Failed to initialize questions" });
  }
});

// anything else falls to this "not found" case
router.all("*", (req, res) => {
  console.log(`API route not found: ${req.method} ${req.url}`);
  res.status(404).send({ msg: "API route not found" });
});

module.exports = router;