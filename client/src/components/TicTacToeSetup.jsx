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
  const [mode, setMode] = useState("");
  const [loading, setLoading] = useState(false);

  const categories = [
    { value: "easy", label: "Easy" },
    { value: "difficult", label: "Difficult" },
    { value: "hard", label: "Hard" },
    { value: "calculus", label: "Calculus" },
    { value: "word", label: "Word Problems" },
  ];

  const handleModeSelect = (selectedMode) => {
    setMode(selectedMode);
    if (selectedMode === "single-player") {
      navigate("/tictactoe/category-select");
    }
  };

  const handleCreateRoom = async () => {
    try {
      setLoading(true);
      console.log("Creating room with category:", selectedCategory);
      
      const response = await post("/api/gameroom/create", { category: selectedCategory });
      console.log("Room creation response:", response);
      
      if (!response.gameCode) {
        throw new Error("No game code received from server");
      }

      navigate(`/tictactoe/waiting/${response.gameCode}`, {
        state: {
          category: selectedCategory,
          isHost: true
        }
      });
    } catch (err) {
      console.error("Error creating room:", err);
      setError(err.message || "Failed to create room");
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = async () => {
    if (joinCode.trim()) {
      try {
        const formattedCode = joinCode.trim().toUpperCase();
        const response = await post("/api/gameroom/join", {
          gameCode: formattedCode,
        });

        if (response.success) {
          setError("");
          navigate(`/tictactoe/waiting/${formattedCode}`, {
            state: {
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
    navigate("/tictactoe/category-select");
  };

  const handleNerdle = () => {
    navigate("/nerdle");
  };

  return (
    <div className={`setup-container ${isDarkMode ? "dark" : "light"}`}>
      <h1>Game Setup</h1>
      <div className="setup-box">
        <div className="category-selection">
          <h2>Select Category</h2>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="category-select"
          >
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>

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

          <button className="setup-button" onClick={() => handleModeSelect("single-player")}>
            Single Player
          </button>

          <button className="setup-button" onClick={handleNerdle}>
            Nerdle
          </button>
        </div>
      </div>
    </div>
  );
};

export default TicTacToeSetup;
