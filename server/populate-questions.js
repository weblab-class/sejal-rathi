require("dotenv").config();
const mongoose = require("mongoose");
const Question = require("./models/question");

// Helper functions to generate questions
function generateRandomNumber(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateEasyArithmeticQuestions(count) {
  const questions = [];
  const operations = ['+', '-'];
  
  for (let i = 0; i < count; i++) {
    const operation = operations[Math.floor(Math.random() * operations.length)];
    let num1, num2, answer, question;

    if (operation === '+') {
      num1 = generateRandomNumber(1, 20);
      num2 = generateRandomNumber(1, 20);
      answer = num1 + num2;
      question = `${num1} + ${num2}`;
    } else {
      num1 = generateRandomNumber(10, 30);
      num2 = generateRandomNumber(1, num1); // Ensure positive result
      answer = num1 - num2;
      question = `${num1} - ${num2}`;
    }

    questions.push({ question, answer });
  }
  return questions;
}

function generateMediumArithmeticQuestions(count) {
  const questions = [];
  const operations = ['×', '÷', '+', '-'];
  
  for (let i = 0; i < count; i++) {
    const operation = operations[Math.floor(Math.random() * operations.length)];
    let num1, num2, answer, question;

    switch (operation) {
      case '×':
        num1 = generateRandomNumber(2, 12);
        num2 = generateRandomNumber(2, 12);
        answer = num1 * num2;
        question = `${num1} × ${num2}`;
        break;
      case '÷':
        num2 = generateRandomNumber(2, 12);
        answer = generateRandomNumber(2, 12);
        num1 = num2 * answer; // Ensure clean division
        question = `${num1} ÷ ${num2}`;
        break;
      case '+':
        num1 = generateRandomNumber(10, 50);
        num2 = generateRandomNumber(10, 50);
        answer = num1 + num2;
        question = `${num1} + ${num2}`;
        break;
      case '-':
        num1 = generateRandomNumber(25, 99);
        num2 = generateRandomNumber(10, num1);
        answer = num1 - num2;
        question = `${num1} - ${num2}`;
        break;
    }

    questions.push({ question, answer });
  }
  return questions;
}

function generateDifficultArithmeticQuestions(count) {
  const questions = [];
  const operations = ['×', '÷', '+', '-'];
  
  for (let i = 0; i < count; i++) {
    const operation = operations[Math.floor(Math.random() * operations.length)];
    let num1, num2, answer, question;

    switch (operation) {
      case '×':
        num1 = generateRandomNumber(12, 30);
        num2 = generateRandomNumber(12, 30);
        answer = num1 * num2;
        question = `${num1} × ${num2}`;
        break;
      case '÷':
        num2 = generateRandomNumber(2, 20);
        answer = generateRandomNumber(5, 20);
        num1 = num2 * answer; // Ensure clean division
        question = `${num1} ÷ ${num2}`;
        break;
      case '+':
        num1 = generateRandomNumber(100, 999);
        num2 = generateRandomNumber(100, 999);
        answer = num1 + num2;
        question = `${num1} + ${num2}`;
        break;
      case '-':
        num1 = generateRandomNumber(500, 999);
        num2 = generateRandomNumber(100, num1);
        answer = num1 - num2;
        question = `${num1} - ${num2}`;
        break;
    }

    questions.push({ question, answer });
  }
  return questions;
}

function generateWordProblems(count) {
  const questions = [];
  const templates = [
    {
      template: "A store has {n1} apples. They sell {n2} apples. How many apples are left?",
      generate: function() {
        const n1 = generateRandomNumber(20, 100);
        const n2 = generateRandomNumber(1, n1);
        return {
          question: this.template.replace("{n1}", n1).replace("{n2}", n2),
          answer: n1 - n2
        };
      }
    },
    {
      template: "Each bag has {n1} candies. How many candies are in {n2} bags?",
      generate: function() {
        const n1 = generateRandomNumber(5, 20);
        const n2 = generateRandomNumber(2, 10);
        return {
          question: this.template.replace("{n1}", n1).replace("{n2}", n2),
          answer: n1 * n2
        };
      }
    },
    {
      template: "You have ${n1} and spend ${n2}. How much money is left?",
      generate: function() {
        const n1 = generateRandomNumber(20, 100);
        const n2 = generateRandomNumber(1, n1);
        return {
          question: this.template.replace("{n1}", n1).replace("{n2}", n2),
          answer: n1 - n2
        };
      }
    },
    {
      template: "{n1} friends each have {n2} stickers. How many stickers do they have in total?",
      generate: function() {
        const n1 = generateRandomNumber(2, 10);
        const n2 = generateRandomNumber(5, 20);
        return {
          question: this.template.replace("{n1}", n1).replace("{n2}", n2),
          answer: n1 * n2
        };
      }
    },
    {
      template: "A bakery makes {n1} cookies and packs them into boxes of {n2}. How many full boxes can they make?",
      generate: function() {
        const n2 = generateRandomNumber(5, 12);
        const answer = generateRandomNumber(2, 10);
        const n1 = n2 * answer;
        return {
          question: this.template.replace("{n1}", n1).replace("{n2}", n2),
          answer: answer
        };
      }
    }
  ];

  for (let i = 0; i < count; i++) {
    const template = templates[i % templates.length];
    const { question, answer } = template.generate();
    questions.push({ question, answer });
  }
  return questions;
}

// Generate questions for each category
const questions = {
  easy_arithmetic: generateEasyArithmeticQuestions(50),
  medium_arithmetic: generateMediumArithmeticQuestions(50),
  difficult_arithmetic: generateDifficultArithmeticQuestions(50),
  word_problems: generateWordProblems(50)
};

async function populateQuestions() {
  try {
    // Connect to MongoDB with explicit database name (case sensitive)
    await mongoose.connect(process.env.MONGO_SRV.replace('/?', '/Cluster0?'));
    console.log("Connected to MongoDB Cluster0 database");

    // Clear existing questions
    await Question.deleteMany({});
    console.log("Cleared existing questions");

    // Add new questions
    for (const [category, categoryQuestions] of Object.entries(questions)) {
      const questionsToInsert = categoryQuestions.map(q => ({
        ...q,
        category,
      }));
      await Question.insertMany(questionsToInsert);
      console.log(`Added ${questionsToInsert.length} questions for ${category}`);
    }

    console.log("Database populated successfully");
  } catch (err) {
    console.error("Error populating database:", err);
  } finally {
    await mongoose.connection.close();
    console.log("Database connection closed");
  }
}

// Run the population script
populateQuestions();
