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
          isHost: true,
        },
      });
    } catch (err) {
      console.error("Error creating room:", err);
      setError(err.message || "Failed to create room");
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!joinCode.trim()) {
      setError("Please enter a game code");
      return;
    }

    try {
      setLoading(true);
      setError("");
      const formattedCode = joinCode.trim().toUpperCase();

      // First check if the room exists and if we can join
      const response = await post("/api/gameroom/join", {
        gameCode: formattedCode,
      });

      if (response.success) {
        // If we're reconnecting, we might have a different category
        const category = response.category || "easy";

        navigate(`/tictactoe/waiting/${formattedCode}`, {
          state: {
            isHost: false,
            category,
            reconnecting: response.reconnecting,
          },
        });
      }
    } catch (err) {
      console.error("Error joining room:", err);
      if (err.response?.status === 404) {
        setError("Invalid room code. Please check and try again.");
      } else if (err.response?.status === 400) {
        setError("This room is full. Please try another room or create a new one.");
      } else {
        setError(err.response?.data?.error || "Could not join room. Please try again.");
      }
    } finally {
      setLoading(false);
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
              className={`tic-room-code-input ${error ? "error" : ""}`}
            />
            {error && <div className="tic-error-message">{error}</div>}
            <button className="setup-button" onClick={handleJoinRoom}>
              Join Room
            </button>
          </div>

          <button className="setup-button" onClick={() => handleModeSelect("single-player")}>
            Single Player
          </button>
        </div>
      </div>
    </div>
  );
};

export default TicTacToeSetup;
