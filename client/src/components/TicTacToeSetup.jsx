import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "./context/ThemeContext";
import "./TicTacToeSetup.css";

const TicTacToeSetup = () => {
  const navigate = useNavigate();
  const { isDarkMode } = useTheme();
  const [joinCode, setJoinCode] = useState("");

  const handleCreateRoom = () => {
    const gameCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    navigate("/tictactoe/waiting", {
      state: {
        gameCode: gameCode,
      },
    });
  };

  const handleJoinRoom = () => {
    if (joinCode.trim()) {
      navigate("/tictactoe/game", {
        state: {
          mode: "two-player",
          gameCode: joinCode.trim().toUpperCase(),
        },
      });
    }
  };

  const handleSinglePlayer = () => {
    navigate("/tictactoe/game", {
      state: {
        mode: "single",
      },
    });
  };

  return (
    <div className={`setup-container ${isDarkMode ? "dark" : "light"}`}>
      <h1>Game Setup</h1>
      <div className="setup-box">
        <div className="setup-options">
          <button className="setup-button" onClick={handleCreateRoom}>
            Create a Room
          </button>

          <div className="join-room">
            <input
              type="text"
              placeholder="Enter Room Code"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              className="room-code-input"
            />
            <button className="setup-button" onClick={handleJoinRoom}>
              Join Room
            </button>
          </div>

          <button className="setup-button" onClick={handleSinglePlayer}>
            Single Player
          </button>
        </div>
      </div>
    </div>
  );
};

export default TicTacToeSetup;
