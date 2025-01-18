import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "./context/ThemeContext";
import { post } from "../utilities";
import "./TicTacToeSetup.css";

const TicTacToeSetup = () => {
  const navigate = useNavigate();
  const { isDarkMode } = useTheme();
  const [joinCode, setJoinCode] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("easy");
  const [error, setError] = useState("");

  const categories = [
    { value: "easy", label: "Easy" },
    { value: "difficult", label: "Difficult" },
    { value: "hard", label: "Hard" },
    { value: "calculus", label: "Calculus" },
    { value: "word", label: "Word Problems" },
  ];

  const handleCreateRoom = async () => {
    try {
      const response = await post("/api/gameroom/create", { category: selectedCategory });
      console.log("Create room response:", response);

      if (response && response.gameCode) {
        navigate("/tictactoe/waiting", {
          state: {
            gameCode: response.gameCode,
            category: selectedCategory,
            isHost: true,
          },
        });
      } else {
        setError("Failed to create room - no game code received");
      }
    } catch (err) {
      console.error("Error creating room:", err);
      setError(err.response?.data?.error || "Could not create room");
    }
  };

  const handleJoinRoom = async () => {
    if (joinCode.trim()) {
      try {
        const response = await post("/api/gameroom/join", {
          gameCode: joinCode.trim().toUpperCase(),
        });

        if (response.success) {
          setError("");
          navigate("/tictactoe/waiting", {
            state: {
              gameCode: joinCode.trim().toUpperCase(),
              category: selectedCategory,
              isHost: false,
            },
          });
        }
      } catch (err) {
        console.error("Error joining room:", err);
        setError(err.response?.data?.error || "Could not join room");
      }
    }
  };

  const handleSinglePlayer = () => {
    navigate("/tictactoe/game", {
      state: {
        mode: "single",
        category: selectedCategory,
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
              onChange={(e) => {
                setJoinCode(e.target.value);
                setError(""); // Clear error when input changes
              }}
              className={`room-code-input ${error ? "error" : ""}`}
            />
            {error && <div className="error-message">{error}</div>}
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
