const mongoose = require("mongoose");

const QuestionSchema = new mongoose.Schema({
  question: {
    type: String,
    required: true,
  },
  answer: {
    type: String,
    required: true,
  },
  difficulty: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
  },
});

const CategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  },
  description: String,
  questions: [QuestionSchema],
});

module.exports = mongoose.model("Category", CategorySchema);
