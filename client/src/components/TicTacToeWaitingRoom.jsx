import React, { useState, useEffect } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { get } from "../utilities";
import { getSocket } from "../client-socket";
import GameCountdown from "./GameCountdown";
import "./TicTacToeWaitingRoom.css";

const TicTacToeWaitingRoom = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { gameCode } = useParams();
  const { isHost } = location.state || {};

  const [error, setError] = useState("");
  const [players, setPlayers] = useState([]);
  const [showCountdown, setShowCountdown] = useState(false);
  const [category, setCategory] = useState(location.state?.category || "easy");
  const [gameQuestions, setGameQuestions] = useState(null);
  const [playerSymbol, setPlayerSymbol] = useState(null);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) {
      setError("No socket connection available");
      return;
    }

    let mounted = true;

    socket.emit("join room", { gameCode, user: { _id: socket.id } });

    socket.on("game:error", (error) => {
      if (!mounted) return;
      console.error("Game error:", error);
      setError(error.message || "An error occurred");
      setTimeout(() => navigate("/tictactoe/setup"), 2000);
    });

    socket.on("game:joined", ({ symbol }) => {
      if (!mounted) return;
      console.log("Joined as player:", symbol);
      setPlayerSymbol(symbol);
    });

    socket.on("player joined", (data) => {
      if (!mounted) return;
      console.log("Player joined:", data);
      setPlayers(data.players || []);
    });

    socket.on("questions:received", ({ questions, board }) => {
      if (!mounted) return;
      console.log("Questions received in waiting room:", { questions, board });
      setGameQuestions({ questions, board });
    });

    socket.on("game:start", () => {
      if (!mounted) return;
      console.log("Game starting with:", {
        questions: gameQuestions,
        symbol: playerSymbol
      });
      setShowCountdown(true);
    });

    return () => {
      mounted = false;
      socket.off("game:error");
      socket.off("game:joined");
      socket.off("player joined");
      socket.off("game:start");
      socket.off("questions:received");
    };
  }, [gameCode, navigate]);

  const handleStartGame = () => {
    const socket = getSocket();
    if (!socket) return;

    console.log("Starting game with category:", category);
    socket.emit("start game", {
      gameCode,
      category
    });
  };

  if (error) {
    return (
      <div className="tictactoe-waiting">
        <div className="error-message">{error}</div>
      </div>
    );
  }

  if (showCountdown) {
    return <GameCountdown 
      gameCode={gameCode} 
      category={category}
      initialQuestions={gameQuestions}
      playerSymbol={playerSymbol}
    />;
  }

  return (
    <div className="tictactoe-waiting">
      <h2>Game Code: {gameCode}</h2>
      {playerSymbol && (
        <div className="player-info">
          You are Player {playerSymbol}
        </div>
      )}
      <div className="player-list">
        <h3>Players ({players.length}/2):</h3>
        {players.map((player, index) => (
          <div key={index} className="player-item">
            Player {index + 1} ({player.symbol})
            {player.isHost ? " (Host)" : ""}
          </div>
        ))}
      </div>

      {isHost && (
        <div className="category-selection">
          <h3>Category:</h3>
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
      )}

      {players.length < 2 ? (
        <div className="waiting-message">
          Waiting for opponent to join...
        </div>
      ) : isHost ? (
        <button className="start-button" onClick={handleStartGame}>
          Start Game
        </button>
      ) : (
        <div className="waiting-message">
          Waiting for host to start the game...
        </div>
      )}
    </div>
  );
};

export default TicTacToeWaitingRoom;
