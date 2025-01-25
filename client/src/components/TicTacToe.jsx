import React, { useState, useEffect } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { get, post } from "../utilities";
import { initiateSocket } from "../client-socket";
import { useTheme } from "./context/ThemeContext";
import "./TicTacToe.css";

const TicTacToe = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { gameCode } = useParams();

  // Extract all state from location
  const { mode, questions, board: initialBoard, symbol } = location.state || {};

  console.log("Game mounted with state:", location.state);

  const { isDarkMode } = useTheme();

  const [userId, setUserId] = useState(null);
  const [modeState, setMode] = useState(gameCode ? "two-player" : "single");
  const [category, setCategory] = useState(location.state?.category || "easy");
  const [timeLimit, setTimeLimit] = useState(5);
  const [questionsState, setQuestions] = useState(questions || []);
  const [board, setBoard] = useState(initialBoard || Array(9).fill(null));
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [selectedCell, setSelectedCell] = useState(null);
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState(null);
  const [playerSymbol] = useState(symbol); // Don't allow symbol to change after mount
  const [gameStarted, setGameStarted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(timeLimit * 60);
  const [loading, setLoading] = useState(true);
  const [currentPlayer, setCurrentPlayer] = useState(null);

  // Load game state on mount
  useEffect(() => {
    const loadGameState = async () => {
      if (modeState === "two-player" && gameCode) {
        try {
          console.log("Loading game state for room:", gameCode);
          console.log("Location state:", location.state);

          // First try to use state from navigation
          if (location.state?.questions && location.state?.board) {
            console.log("Using questions and board from navigation state");
            setQuestions(location.state.questions);
            setBoard(location.state.board);
            setGameStarted(true);
            setLoading(false);
            return;
          }

          // If no navigation state, fetch from server
          const state = await get(`/api/gameroom/${gameCode}`);
          console.log("Received game state from server:", state);

          if (state && !state.error) {
            if (state.questions && state.board) {
              setQuestions(state.questions);
              setBoard(state.board);
              setGameStarted(state.started || false);
              setLoading(false);
            } else {
              console.error("Game state missing questions or board");
              navigate("/tictactoe/setup");
            }
          } else {
            console.error("No existing game state found:", state);
            navigate("/tictactoe/setup");
          }
        } catch (err) {
          console.error("Error loading game state:", err);
          navigate("/tictactoe/setup");
        }
      }
    };

    loadGameState();
  }, [modeState, gameCode, navigate, location.state]);

  // Load questions for single player mode
  useEffect(() => {
    const loadQuestions = async () => {
      if (modeState === "single") {
        try {
          console.log("Loading questions for single player");
          const fetchedQuestions = await get("/api/questions/" + category);

          if (fetchedQuestions && fetchedQuestions.length > 0) {
            setQuestions(fetchedQuestions);
            const newBoard = Array(9)
              .fill()
              .map((_, index) => ({
                value: fetchedQuestions[index].question,
                answer: fetchedQuestions[index].answer,
                solved: false,
                player: null,
              }));
            setBoard(newBoard);
            setGameStarted(true);
            setPlayerSymbol("X"); // Single player is always X
          } else {
            throw new Error("No questions available");
          }
        } catch (err) {
          console.error("Error loading questions:", err);
          setError("Failed to load questions. Please try again.");
        }
      }
    };

    loadQuestions();
  }, [modeState, category]);

  // Socket setup for multiplayer mode
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
            name: userInfo.name 
          } 
        });

        socket.on("game:error", (error) => {
          if (!mounted) return;
          console.error("Game error:", error);
          setError(error.message || "An error occurred");
        });

        socket.on("game:joined", ({ symbol, gameState }) => {
          if (!mounted) return;
          if (gameState) {
            setBoard(gameState.board);
            setCurrentPlayer(gameState.currentPlayer);
            setWinner(gameState.winner);
          }
        });

        socket.on("game:update", ({ board, currentPlayer, winner }) => {
          if (!mounted) return;
          console.log("Game updated:", { board, currentPlayer, winner });
          setBoard(board);
          setCurrentPlayer(currentPlayer);
          if (winner) setWinner(winner);
        });

        socket.on("cell:claimed", ({ index, symbol }) => {
          if (!mounted) return;
          console.log("Cell claimed:", index, "by", symbol);
          setBoard((prevBoard) => {
            const newBoard = [...prevBoard];
            if (newBoard[index]) {
              newBoard[index] = {
                ...newBoard[index],
                solved: true,
                player: symbol,
              };
            }
            return newBoard;
          });
        });

        socket.on("game:over", ({ winner }) => {
          if (!mounted) return;
          setGameOver(true);
          setWinner(winner);
        });

      } catch (err) {
        if (mounted) {
          console.error("Socket initialization error:", err);
          setError("Failed to connect to game server");
        }
      }
    };

    initializeSocket();

    return () => {
      mounted = false;
      if (socketInstance) {
        socketInstance.off("game:error");
        socketInstance.off("game:joined");
        socketInstance.off("game:update");
        socketInstance.off("cell:claimed");
        socketInstance.off("game:over");
      }
    };
  }, [gameCode]);

  // Timer for single player mode
  useEffect(() => {
    if (modeState === "single" && gameStarted && !gameOver && timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            setGameOver(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [modeState, gameStarted, gameOver, timeLeft]);

  const handleCellClick = async (index) => {
    if (!board[index] || board[index].solved || gameOver) return;

    console.log("Cell clicked:", {
      index,
      cellData: board[index],
      playerSymbol,
    });

    const userAnswer = prompt(`Answer this question: ${board[index].value}`);
    if (!userAnswer) return;

    console.log("Submitting answer:", {
      cell: index,
      answer: userAnswer,
      symbol: playerSymbol,
    });

    try {
      const socket = await initiateSocket();
      if (!socket) {
        setError("No connection to game server");
        return;
      }

      socket.emit("claim cell", {
        gameCode,
        index,
        answer: userAnswer,
        symbol: playerSymbol,
      });
    } catch (err) {
      console.error("Error submitting answer:", err);
      setError("Failed to submit answer");
    }
  };

  const checkWinner = (currentBoard) => {
    const winPatterns = [
      [0, 1, 2],
      [3, 4, 5],
      [6, 7, 8], // Rows
      [0, 3, 6],
      [1, 4, 7],
      [2, 5, 8], // Columns
      [0, 4, 8],
      [2, 4, 6], // Diagonals
    ];

    for (const pattern of winPatterns) {
      const [a, b, c] = pattern;
      if (
        currentBoard[a].solved &&
        currentBoard[b].solved &&
        currentBoard[c].solved &&
        currentBoard[a].player === currentBoard[b].player &&
        currentBoard[b].player === currentBoard[c].player
      ) {
        return currentBoard[a].player;
      }
    }
    return null;
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <div className={`game-container ${isDarkMode ? "dark" : "light"}`}>
        <div className="loading">Loading questions...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`game-container ${isDarkMode ? "dark" : "light"}`}>
        <div className="error">{error}</div>
        <button className="play-again" onClick={() => navigate("/tictactoe/setup")}>
          Try Again
        </button>
      </div>
    );
  }

  if (modeState === "two-player" && !playerSymbol && !gameStarted) {
    return (
      <div className={`game-container ${isDarkMode ? "dark" : "light"}`}>
        <div className="loading">Waiting for game to start...</div>
      </div>
    );
  }

  return (
    <div className={`game-container ${isDarkMode ? "dark" : "light"}`}>
      <h1>Tic Tac Toe</h1>
      <div className="category">Category: {category}</div>

      {modeState === "two-player" && (
        <div className="player-info">You are Player {playerSymbol}</div>
      )}

      {modeState === "single" && <div className="timer">Time Left: {formatTime(timeLeft)}</div>}

      <div className="game-status">
        {gameOver && (
          <>
            {timeLeft === 0
              ? "Time's up! Game Over"
              : winner
              ? `Player ${winner} wins!`
              : "Game Over"}
            <div>
              <button className="play-again" onClick={() => navigate("/tictactoe/setup")}>
                Play Again
              </button>
            </div>
          </>
        )}
      </div>

      <div className="tic-game-board">
        {board.map((cell, index) => (
          <div
            key={index}
            className={`cell ${cell?.solved ? "solved" : ""} ${cell?.solved ? cell.player : ""}`}
            onClick={() => handleCellClick(index)}
          >
            {cell?.solved ? (
              <span className={`symbol ${cell.player}`}>{cell.player}</span>
            ) : (
              <span className="question">{cell?.value || "?"}</span>
            )}
          </div>
        ))}
      </div>

      {gameOver && (
        <div className="game-over">
          <h2>Game Over!</h2>
          {winner ? <p>Winner: Player {winner}</p> : <p>It's a draw!</p>}
          <button onClick={() => navigate("/tictactoe/setup")}>Play Again</button>
        </div>
      )}
    </div>
  );
};

export default TicTacToe;
