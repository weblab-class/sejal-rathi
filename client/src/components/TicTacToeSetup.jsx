import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "./context/ThemeContext";
import "./TicTacToeSetup.css";

const TicTacToeSetup = () => {
  const navigate = useNavigate();
  const { isDarkMode } = useTheme();

  const [gameMode, setGameMode] = useState("single");
  const [category, setCategory] = useState("easy");
  const [timeLimit, setTimeLimit] = useState(5);
  const [roomCode, setRoomCode] = useState("");

  const handleStartGame = () => {
    const gameConfig = {
      mode: gameMode,
      category: category,
      timeLimit: timeLimit,
      roomCode: gameMode === "join" ? roomCode : null,
    };

    navigate("/tictactoe/game", { state: gameConfig });
  };

  return (
    <div className={`setup-container ${isDarkMode ? "dark" : "light"}`}>
      <h1>Game Setup</h1>

      <div className="setup-section">
        <h2>Game Mode</h2>
        <div className="mode-buttons">
          <button
            className={gameMode === "single" ? "active" : ""}
            onClick={() => setGameMode("single")}
          >
            Single Player
          </button>
          <button
            className={gameMode === "create" ? "active" : ""}
            onClick={() => setGameMode("create")}
          >
            Create Room
          </button>
          <button
            className={gameMode === "join" ? "active" : ""}
            onClick={() => setGameMode("join")}
          >
            Join Room
          </button>
        </div>
      </div>

      {gameMode === "join" ? (
        <div className="setup-section">
          <h2>Room Code</h2>
          <input
            type="text"
            placeholder="Enter room code"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value)}
          />
        </div>
      ) : (
        <>
          <div className="setup-section">
            <h2>Category</h2>
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>

          <div className="setup-section">
            <h2>Time Limit (minutes)</h2>
            <div className="time-selector">
              <button
                onClick={() => setTimeLimit((prev) => Math.max(1, prev - 1))}
                className="time-button"
              >
                -
              </button>
              <span>{timeLimit}</span>
              <button
                onClick={() => setTimeLimit((prev) => Math.min(10, prev + 1))}
                className="time-button"
              >
                +
              </button>
            </div>
          </div>
        </>
      )}

      <button
        className="start-button"
        onClick={handleStartGame}
        disabled={gameMode === "join" && !roomCode}
      >
        Start Game
      </button>
    </div>
  );
};

export default TicTacToeSetup;
