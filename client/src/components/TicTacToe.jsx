import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { get, post } from "../utilities";
import { getSocket } from "../client-socket";
import { useTheme } from "./context/ThemeContext";
import "./TicTacToe.css";

const TicTacToe = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const [userId, setUserId] = useState(null);

  const { category = "easy", mode = "two-player", timeLimit = 5, gameCode } = location.state || {};

  const [board, setBoard] = useState(
    Array(9)
      .fill()
      .map(() => ({ value: "", solved: false, player: null }))
  );
  const [playerSymbol, setPlayerSymbol] = useState(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState(null);
  const [timeLeft, setTimeLeft] = useState(timeLimit * 60);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [opponent, setOpponent] = useState(null);
  const [selectedCell, setSelectedCell] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [showResult, setShowResult] = useState(null);

  const { isDarkMode } = useTheme();

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    // Join the game room
    if (mode === "two-player" && gameCode) {
      socket.emit("game:join", { gameCode, user: { _id: socket.id } });
    }

    // Socket event listeners
    socket.on("game:joined", ({ symbol }) => {
      setPlayerSymbol(symbol);
      console.log("Joined as player:", symbol);
      if (symbol === "X") {
        setGameStarted(false); // Host waits for player 2
      }
    });

    socket.on("game:start", async ({ players }) => {
      console.log("Game starting, players:", players);
      const opponentPlayer = players.find((p) => p.socket !== socket.id);
      if (opponentPlayer) {
        setOpponent(opponentPlayer);
      }

      // If player X, fetch questions during countdown
      if (playerSymbol === "X") {
        try {
          console.log("Fetching questions for category:", category);
          setLoading(true);
          const fetchedQuestions = await get("/api/questions/" + category);
          console.log("Fetched questions:", fetchedQuestions);

          if (fetchedQuestions && fetchedQuestions.length > 0) {
            setQuestions(fetchedQuestions);
            const newBoard = Array(9).fill().map((_, index) => ({
              value: fetchedQuestions[index].question,
              answer: fetchedQuestions[index].answer,
              solved: false,
              player: null,
            }));
            setBoard(newBoard);
            
            // Share questions with other player
            socket.emit("questions:share", { 
              gameCode, 
              questions: fetchedQuestions,
              board: newBoard
            });
          } else {
            throw new Error("No questions received from server");
          }
        } catch (err) {
          console.error("Error fetching questions:", err);
          setError(err.message || "Failed to fetch questions");
        } finally {
          setLoading(false);
        }
      }
    });

    socket.on("questions:received", ({ questions, board }) => {
      console.log("Received questions and board:", { questions, board });
      if (Array.isArray(questions) && Array.isArray(board)) {
        setQuestions(questions);
        setBoard(board);
        setGameStarted(true);
        setLoading(false);
      } else {
        console.error("Invalid questions or board format received");
        setError("Failed to load game data");
      }
    });

    socket.on("cell_claimed", ({ index, symbol }) => {
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
      setGameOver(true);
      setWinner(winner);
    });

    socket.on("player:left", () => {
      setError("Opponent left the game");
      setGameOver(true);
    });

    socket.on("game:error", (error) => {
      console.error("Game error:", error);
      setError(error.message || "An error occurred");
      setTimeout(() => navigate("/tictactoe/setup"), 2000);
    });

    return () => {
      socket.off("game:joined");
      socket.off("game:start");
      socket.off("questions:received");
      socket.off("cell_claimed");
      socket.off("game:over");
      socket.off("player:left");
      socket.off("game:error");
    };
  }, [mode, gameCode, category, playerSymbol, navigate]);

  useEffect(() => {
    // Get current user ID
    get("/api/whoami").then((user) => {
      setUserId(user._id);
    });
  }, []);

  useEffect(() => {
    // Timer for single player mode
    if (mode === "single" && !gameOver && timeLeft > 0) {
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
  }, [mode, gameOver, timeLeft]);

  useEffect(() => {
    if (mode === "single" && !category) {
      navigate("/category-select");
    }
  }, [mode, category, navigate]);

  const updateStats = async (result) => {
    if (userId && !userId.startsWith("guest_")) {
      try {
        await post("/api/stats/tictactoe", { result });
      } catch (err) {
        console.error("Failed to update stats:", err);
      }
    }
  };

  useEffect(() => {
    if (gameOver && !loading) {
      if (mode === "single") {
        if (timeLeft === 0) {
          updateStats("loss");
        } else {
          console.log("reached the win updated stats");
          updateStats("win");
        }
      } else if (mode === "two-player" && winner) {
        if (winner === playerSymbol) {
          updateStats("win");
        } else if (winner === "tie" && gameOver) {
          updateStats("tie");
        } else {
          updateStats("loss");
        }
      }
    }
  }, [gameOver, winner, mode, timeLeft, loading, playerSymbol]);

  const checkAnswer = (question) => {
    const currentQ = questions.find((q) => q.question === question);
    if (!currentQ) return null;

    const userAnswer = prompt(`Solve: ${question}`);
    if (userAnswer === null) return null;

    return String(currentQ.answer).toLowerCase() === String(userAnswer).toLowerCase();
  };

  const handleCellClick = async (index) => {
    if (mode === "single") {
      if (gameOver || board[index].solved) return;

      const cell = board[index];
      const isCorrect = checkAnswer(cell.value);

      if (isCorrect !== null) {
        const newBoard = [...board];
        if (isCorrect) {
          newBoard[index] = {
            ...cell,
            solved: true,
            player: "X",
          };
          setBoard(newBoard);

          if (checkWinner(newBoard)) {
            setGameOver(true);
            setWinner("X");
          }
        }
      }
    } else {
      // Multiplayer mode
      if (!gameStarted || board[index].solved || !playerSymbol) return;

      const cell = board[index];
      const userAnswer = prompt(`Solve: ${cell.value}`);

      if (userAnswer !== null) {
        const socket = getSocket();
        if (!socket) return;

        socket.emit("game:move", {
          gameCode,
          cellIndex: index,
          answer: userAnswer,
          question: cell.value,
          correctAnswer: questions.find((q) => q.question === cell.value).answer,
        });
      }
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

  // For two-player mode, wait for playerSymbol
  if (mode === "two-player" && !playerSymbol) {
    return (
      <div className={`game-container ${isDarkMode ? "dark" : "light"}`}>
        <div className="loading">Waiting for game to start...</div>
      </div>
    );
  }

  return (
    <div className={`game-container ${isDarkMode ? "dark" : "light"}`}>
      <h1>tic-tac-toe</h1>

      <div className="category">category: {category.replace(/([A-Z])/g, " $1").toLowerCase()}</div>

      {mode === "two-player" && gameCode && (
        <div className="waiting">
          {<div className="player-info">You are Player {playerSymbol}</div>}
        </div>
      )}

      {mode === "single" && <div className="timer">Time Left: {formatTime(timeLeft)}</div>}

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
            className={`cell ${cell.solved ? "solved" : ""} ${cell.solved ? cell.player : ""}`}
            onClick={() => handleCellClick(index)}
          >
            {cell.value}
          </div>
        ))}
      </div>

      {currentQuestion && (
        <div className="question-modal">
          <div className="question-content">
            <h3>Answer this question:</h3>
            <p>{currentQuestion.question}</p>
            <input
              type="text"
              placeholder="Your answer..."
              onKeyPress={(e) => {
                if (e.key === "Enter") {
                  handleAnswer(e.target.value);
                  e.target.value = "";
                }
              }}
              autoFocus
            />
          </div>
        </div>
      )}

      {showResult && (
        <div className={`result-message ${showResult.correct ? "correct" : "incorrect"}`}>
          {showResult.message}
        </div>
      )}
    </div>
  );
};

export default TicTacToe;
