import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTheme } from "./context/ThemeContext";
import { socket } from "../client-socket";
import { get, post } from "../utilities";
import "./TicTacToeWaitingRoom.css";

const REFRESH_INTERVAL = 3000; // Check every 3 seconds

const TicTacToeWaitingRoom = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isDarkMode } = useTheme();
  const { gameCode, isHost } = location.state || {};
  const [category, setCategory] = useState("easy");
  const [isGameReady, setIsGameReady] = useState(false);
  const [error, setError] = useState("");
  const [players, setPlayers] = useState([]);

  const checkRoom = async () => {
    try {
      const room = await get("/api/gameroom/" + gameCode);
      setPlayers(room.players);
      setIsGameReady(room.players.length === 2);
      setCategory(room.category || "easy");
    } catch (err) {
      console.log("Error checking room:", err);
      setError(err.response?.data?.error || "Room not found");
      // Navigate back to setup after a delay
      setTimeout(() => {
        navigate("/tictactoe/setup");
      }, 2000);
    }
  };

  // Initial room check
  useEffect(() => {
    checkRoom();
  }, [gameCode]);

  // Set up periodic room check
  useEffect(() => {
    const intervalId = setInterval(checkRoom, REFRESH_INTERVAL);

    // Cleanup interval on unmount
    return () => clearInterval(intervalId);
  }, [gameCode]);

  // Socket event handlers
  useEffect(() => {
    socket.on("player_joined", (data) => {
      setPlayers(data.players);
      setIsGameReady(data.players.length === 2);
      // Trigger an immediate room check when a player joins
      checkRoom();
    });

    socket.on("player_left", (data) => {
      setPlayers(data.players);
      setIsGameReady(false);
      // Trigger an immediate room check when a player leaves
      checkRoom();
    });

    socket.on("game_started", (data) => {
      navigate("/tictactoe", {
        state: {
          mode: "two-player",
          gameCode: gameCode,
          category: data.category,
        },
      });
    });

    return () => {
      // Leave the room
      post("/api/gameroom/" + gameCode + "/leave")
        .catch(console.error);

      socket.off("player_joined");
      socket.off("player_left");
      socket.off("game_started");
    };
  }, [gameCode, navigate]);

  const handleStartGame = () => {
    socket.emit("start_game", { gameCode, category });
  };

  if (error) {
    return (
      <div className={`waiting-room-container ${isDarkMode ? "dark" : "light"}`}>
        <div className="waiting-room-box">
          <div className="error-message">{error}</div>
          <p>Redirecting to setup...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`waiting-room-container ${isDarkMode ? "dark" : "light"}`}>
      <h1>Waiting Room</h1>
      <div className="waiting-room-box">
        <div className="room-code-display">
          <h2>Room Code</h2>
          <div className="code">{gameCode}</div>
          <p>Share this code with your opponent</p>
        </div>

        <div className="players-list">
          <h2>Players</h2>
          {players.map((player, index) => (
            <div key={index} className="player-item">
              {player.name} {player.isHost ? "(Host)" : ""}
            </div>
          ))}
        </div>

        <div className="category-selection">
          <h2>Select Category</h2>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="category-select"
            disabled={!isHost}
          >
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>

        <div className="status-message">
          {!isGameReady 
            ? "Waiting for opponent to join..."
            : isHost 
              ? "Both players are ready! You can start the game."
              : "Waiting for host to start the game..."
          }
        </div>

        {(isHost && isGameReady) && (
          <button className="start-button" onClick={handleStartGame}>
            Start Game
          </button>
        )}
      </div>
    </div>
  );
};

export default TicTacToeWaitingRoom;
