const mongoose = require("mongoose");

const CategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  level: {
    type: Number,
    required: true,
    min: 1,
    max: 4,
  },
  sampleNumbers: {
    type: [Number],
    required: true,
  },
});

module.exports = mongoose.model("category", CategorySchema);
