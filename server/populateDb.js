require("dotenv").config();
const mongoose = require("mongoose");
const Category = require("./models/category");

const mongoConnectionURL = process.env.MONGO_SRV;
const databaseName = "Cluster0";

mongoose.connect(mongoConnectionURL, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  dbName: databaseName,
});

const initialCategories = [
  {
    name: "Math",
    description: "Mathematical puzzles and problems",
    questions: [
      {
        question: "What is 2 + 2?",
        answer: "4",
        difficulty: 1,
      },
      // Add more questions here
    ],
  },
  {
    name: "Logic",
    description: "Logic puzzles and riddles",
    questions: [
      {
        question: "If all cats are animals, and Fluffy is a cat, what is Fluffy?",
        answer: "An animal",
        difficulty: 2,
      },
      // Add more questions here
    ],
  },
  // Add more categories here
];

async function populateDb() {
  try {
    // Clear existing categories
    await Category.deleteMany({});
    
    // Insert new categories
    await Category.insertMany(initialCategories);
    
    console.log("Database populated successfully!");
    process.exit(0);
  } catch (err) {
    console.error("Error populating database:", err);
    process.exit(1);
  }
}

populateDb();
