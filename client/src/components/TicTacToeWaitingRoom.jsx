import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTheme } from "./context/ThemeContext";
import "./TicTacToeWaitingRoom.css";

const TicTacToeWaitingRoom = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isDarkMode } = useTheme();
  const { gameCode } = location.state || {};
  const [category, setCategory] = useState("easy");

  const handleStartGame = () => {
    navigate("/tictactoe", {
      state: {
        mode: "two-player",
        gameCode: gameCode,
        category: category,
      },
    });
  };

  return (
    <div className={`waiting-room-container ${isDarkMode ? "dark" : "light"}`}>
      <h1>Waiting Room</h1>
      <div className="waiting-room-box">
        <div className="room-code-display">
          <h2>Room Code</h2>
          <div className="code">{gameCode}</div>
          <p>Share this code with your opponent</p>
        </div>

        <div className="category-selection">
          <h2>Select Category</h2>
          <select 
            value={category} 
            onChange={(e) => setCategory(e.target.value)}
            className="category-select"
          >
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>

        <div className="status-message">
          Waiting for opponent to join...
        </div>

        <button className="start-button" onClick={handleStartGame}>
          Start Game
        </button>
      </div>
    </div>
  );
};

export default TicTacToeWaitingRoom;
