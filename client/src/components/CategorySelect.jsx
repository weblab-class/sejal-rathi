import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "./context/ThemeContext";
import "./CategorySelect.css";

const CategorySelect = () => {
  const navigate = useNavigate();
  const { isDarkMode } = useTheme();

  const [selectedCategory, setSelectedCategory] = useState("easy_arithmetic");
  const [timeLimit, setTimeLimit] = useState(30); // Default 30 seconds

  const categories = [
    {
      id: "easy_arithmetic",
      name: "Easy Arithmetic",
      description: "Basic addition, subtraction, multiplication, and division",
      icon: "➕",
    },
    {
      id: "medium_arithmetic",
      name: "Medium Arithmetic",
      description: "More challenging arithmetic problems with larger numbers",
      icon: "✖️",
    },
    {
      id: "difficult_arithmetic",
      name: "Difficult Arithmetic",
      description: "Complex arithmetic problems with multi-digit numbers",
      icon: "➗",
    },
    {
      id: "word_problems",
      name: "Word Problems",
      description: "Real-world math problems that require problem-solving skills",
      icon: "📝",
    },
  ];

  const handleCategoryChange = (event) => {
    setSelectedCategory(event.target.value);
  };

  const handleTimeLimitChange = (event) => {
    setTimeLimit(parseInt(event.target.value));
  };

  const startGame = () => {
    navigate("/tictactoe/game/single", {
      state: {
        category: selectedCategory,
        mode: "single",
        timeLimit: timeLimit / 60, // Convert seconds to minutes
        gameStarted: true,
      },
    });
  };

  return (
    <div>
      <div className="tic-back-button-container">
        <button className="tic-back-button" onClick={() => navigate("/games")}>
          ↩
        </button>
      </div>

      <div className={`category-select-wrapper ${isDarkMode ? "dark" : "light"}`}>
        <h1>Num-Tac-Toe</h1>
        <div className="tic-category-select-container">
          <h2>Select a Category</h2>
          <div className="select-group">
            <label>
              Category:
              <select value={selectedCategory} onChange={handleCategoryChange}>
                <option value="easy_arithmetic">Easy Arithmetic</option>
                <option value="medium_arithmetic">Medium Arithmetic</option>
                <option value="difficult_arithmetic">Difficult Arithmetic</option>
                <option value="word_problems">Word Problems</option>
              </select>
            </label>
          </div>

          <div className="select-group">
            <label>
              Time Limit (seconds):
              <select value={timeLimit} onChange={handleTimeLimitChange}>
                <option value="15">15</option>
                <option value="30">30</option>
                <option value="45">45</option>
                <option value="60">60</option>
                <option value="75">75</option>
                <option value="90">90</option>
                <option value="120">120</option>
                <option value="150">150</option>
              </select>
            </label>
          </div>

          <button onClick={startGame}>Start Game</button>
        </div>
      </div>
    </div>
  );
};

export default CategorySelect;
