import React, { useState, useEffect } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { get } from "../utilities";
import { initiateSocket } from "../client-socket";
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
  const [category, setCategory] = useState(location.state?.category || "easy_arithmetic");
  const [gameQuestions, setGameQuestions] = useState(null);
  const [playerSymbol, setPlayerSymbol] = useState(null);
  const [gameState, setGameState] = useState(null);

  useEffect(() => {
    let mounted = true;
    let socketInstance = null;

    const initializeSocket = async () => {
      try {
        // Get user info first
        const userInfo = await get("/api/whoami");
        if (!userInfo || !userInfo._id) {
          throw new Error("Not logged in");
        }

        const socket = await initiateSocket();
        if (!socket || !mounted) return;

        socketInstance = socket;
        console.log("Joining game room:", gameCode, "as user:", userInfo._id);
        socket.emit("join room", {
          gameCode,
          user: {
            _id: userInfo._id,
            name: userInfo.name,
          },
        });

        socket.on("game:error", (error) => {
          if (!mounted) return;
          console.error("Game error:", error);
          setError(error.message || "An error occurred");
          setTimeout(() => navigate("/tictactoe/setup"), 2000);
        });

        socket.on("game:joined", ({ symbol, isHost, gameState }) => {
          if (!mounted) return;
          console.log("Joined as player:", symbol, "Game state:", gameState);
          setPlayerSymbol(symbol);
          if (gameState) {
            // If game has already started, redirect to game
            navigate(`/tictactoe/game/${gameCode}`);
          }
        });

        socket.on("player joined", (data) => {
          if (!mounted) return;
          console.log("Player joined:", data);
          setPlayers(data.players || []);
        });

        socket.on("player:reconnected", (data) => {
          if (!mounted) return;
          console.log("Player reconnected:", data);
          setPlayers((prev) =>
            prev.map((p) => (p.socketId === data.userId ? { ...p, connected: true } : p))
          );
        });

        socket.on("player:disconnected", (data) => {
          if (!mounted) return;
          console.log("Player disconnected:", data);
          setPlayers((prev) =>
            prev.map((p) => (p.socketId === data.socketId ? { ...p, connected: false } : p))
          );
        });

        socket.on("game:start", ({ board, currentPlayer, category }) => {
          if (!mounted) return;
          console.log("Game starting with:", { board, currentPlayer, category });
          setGameState({ board, currentPlayer });
          setShowCountdown(true);
        });

        socket.on("game:update", ({ board, currentPlayer, winner }) => {
          if (!mounted) return;
          console.log("Game updated:", { board, currentPlayer, winner });
          setGameState({ board, currentPlayer, winner });
        });

        socket.on("questions:received", ({ questions, board }) => {
          if (!mounted) return;
          console.log("Questions received in waiting room:", { questions, board });
          setGameQuestions({ questions, board });
        });

        // Handle socket reconnection
        socket.on("reconnect", () => {
          if (!mounted) return;
          console.log("Socket reconnected, rejoining room");
          socket.emit("join room", {
            gameCode,
            user: {
              _id: userInfo._id,
              name: userInfo.name,
            },
          });
        });

        socket.on("questions:received", ({ questions, board }) => {
          if (!mounted) return;
          console.log("Questions received in waiting room:", { questions, board });
          setGameQuestions({ questions, board });
        });
      } catch (err) {
        if (mounted) {
          console.error("Socket initialization error:", err);
          setError("Failed to connect to game server. Please try again.");
          setTimeout(() => navigate("/tictactoe/setup"), 2000);
        }
      }
    };

    // Also check game state directly from API
    const checkGameState = async () => {
      try {
        const gameData = await get("/api/game", { gameCode });
        if (gameData && gameData.gameStarted) {
          navigate(`/tictactoe/game/${gameCode}`);
        }
      } catch (err) {
        console.error("Error checking game state:", err);
      }
    };

    checkGameState();
    initializeSocket();

    return () => {
      mounted = false;
      if (socketInstance) {
        socketInstance.off("game:error");
        socketInstance.off("game:joined");
        socketInstance.off("player joined");
        socketInstance.off("game:start");
        socketInstance.off("game:update");
        socketInstance.off("player:reconnected");
        socketInstance.off("player:disconnected");
        socketInstance.off("reconnect");
        socketInstance.off("questions:received");
      }
    };
  }, [gameCode, navigate]);

  const handleStartGame = async () => {
    try {
      const socket = await initiateSocket();
      if (!socket) {
        setError("No connection to game server");
        return;
      }

      console.log("Starting game with category:", category);
      socket.emit("start game", {
        gameCode,
        category,
      });
    } catch (err) {
      console.error("Error starting game:", err);
      setError("Failed to start game. Please try again.");
    }
  };

  if (error) {
    return (
      <div className="tictactoe-waiting">
        <div className="tic-error-message">{error}</div>
      </div>
    );
  }

  if (showCountdown) {
    return (
      <GameCountdown
        gameCode={gameCode}
        category={category}
        initialState={gameState}
        playerSymbol={playerSymbol}
      />
    );
  }

  return (
    <div className="tictactoe-waiting">
      <h1>Tic Tac Toe Waiting Room</h1>
      <h2>Game Code: {gameCode}</h2>
      {playerSymbol && <div className="tic-player-info">You are Player {playerSymbol}</div>}
      <div className="player-list">
        <h3>Players ({players.length}/2):</h3>
        {players.map((player) => (
          <div key={player.socketId} className="tic-player-item">
            <span className="player-name">
              {player.name} {player.isHost ? "(Host)" : ""}
            </span>
            <span className="player-status">
              {player.symbol}
              {!player.connected && " (Disconnected)"}
            </span>
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
            <option value="easy_arithmetic">Easy Arithmetic</option>
            <option value="medium_arithmetic">Medium Arithmetic</option>
            <option value="difficult_arithmetic">Difficult Arithmetic</option>
            <option value="word_problems">Word Problems</option>
          </select>
        </div>
      )}

      {players.length < 2 ? (
        <div className="waiting-message">Waiting for opponent to join...</div>
      ) : isHost ? (
        players.every((player) => player.connected) ? (
          <button className="start-button" onClick={handleStartGame}>
            Start Game
          </button>
        ) : (
          <div className="waiting-message">Waiting for all players to connect...</div>
        )
      ) : (
        <div className="waiting-message">Waiting for host to start the game...</div>
      )}
    </div>
  );
};

export default TicTacToeWaitingRoom;
