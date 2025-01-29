const mongoose = require("mongoose");

const QuestionSchema = new mongoose.Schema({
  question: {
    type: String,
    required: true,
  },
  answer: {
    type: Number, // Changed to Number since all answers will be integers
    required: true,
  },
  category: {
    type: String,
    required: true,
    enum: ["easy_arithmetic", "medium_arithmetic", "difficult_arithmetic", "word_problems"],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Question", QuestionSchema);