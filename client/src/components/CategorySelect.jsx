import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./CategorySelect.css";

const CategorySelect = () => {
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState("easy");
  const [timeLimit, setTimeLimit] = useState(30); // Default 30 seconds

  const handleCategoryChange = (event) => {
    setSelectedCategory(event.target.value);
  };

  const handleTimeLimitChange = (event) => {
    setTimeLimit(parseInt(event.target.value));
  };

  const startGame = () => {
    // Convert timeLimit to minutes for consistency
    navigate("/tictactoe/game", {
      state: {
        category: selectedCategory,
        mode: "single",
        timeLimit: timeLimit / 60, // Convert seconds to minutes
        gameStarted: true,
      },
    });
  };

  return (
    <div className="category-select-wrapper">
      <h1>Tic Tac Toe</h1>
      <div className="category-select-container">
        <h2>Select a Category</h2>
        <div className="select-group">
          <label>
            Category:
            <select value={selectedCategory} onChange={handleCategoryChange}>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
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
            </select>
          </label>
        </div>

        <button onClick={startGame}>Start Game</button>
      </div>
    </div>
  );
};

export default CategorySelect;
