const mongoose = require("mongoose");

const QuestionSchema = new mongoose.Schema({
  question: {
    type: String,
    required: true,
  },
  answer: {
    type: mongoose.Schema.Types.Mixed, // Can be String or Number
    required: true,
  },
  category: {
    type: String,
    required: true,
    enum: ["easy", "difficult", "hard", "calculus", "word"],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Question", QuestionSchema);