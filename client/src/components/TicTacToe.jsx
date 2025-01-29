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
  const {
    mode: initialMode,
    questions,
    board: initialBoard,
    symbol,
    category: initialCategory,
    timeLimit,
  } = location.state || {};

  const { isDarkMode } = useTheme();

  const [userId, setUserId] = useState(null);
  const [modeState, setMode] = useState(
    initialMode || (gameCode === "single" ? "single" : "two-player")
  );
  const [category, setCategory] = useState(initialCategory || "easy_arithmetic");
  const [timeLeft, setTimeLeft] = useState((timeLimit || 5) * 60);
  const [questionsState, setQuestions] = useState(questions || []);
  const [board, setBoard] = useState(initialBoard || Array(9).fill(null));
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [selectedCell, setSelectedCell] = useState(null);
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState(null);
  const [playerSymbol] = useState(symbol || "X"); // Single player is always X
  const [gameStarted, setGameStarted] = useState(location.state?.gameStarted || false);
  const [loading, setLoading] = useState(true);
  const [currentPlayer, setCurrentPlayer] = useState("X"); // Set initial player for single player
  const [feedback, setFeedback] = useState(null);
  const [lastClickedCell, setLastClickedCell] = useState(null);
  const [showModal, setShowModal] = useState(false);

  // Load user ID on mount
  useEffect(() => {
    const getUser = async () => {
      try {
        const user = await get("/api/whoami");
        if (user._id) {
          setUserId(user._id);
        }
      } catch (err) {
        console.error("Error getting user:", err);
      }
    };
    getUser();
  }, []);

  // Load questions for single player mode
  useEffect(() => {
    const loadQuestions = async () => {
      if (modeState === "single") {
        try {
          // Make sure we have a category before making the request
          if (!category) {
            console.error("No category selected");
            setError("No category selected");
            setLoading(false);
            return;
          }

          // Log the exact request we're about to make
          const requestUrl = `/api/questions?category=${encodeURIComponent(category)}`;

          const fetchedQuestions = await get(requestUrl);

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
            setLoading(false);
          } else {
            console.error("No questions returned from API");
            throw new Error("No questions available");
          }
        } catch (err) {
          console.error("Error loading questions:", err);
          console.error("Error details:", {
            message: err.message,
            response: err.response,
            status: err.response?.status,
          });
          setError("Failed to load questions. Please try again.");
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };

    if (gameStarted) {
      loadQuestions();
    }
  }, [modeState, category, gameStarted]);

  // Load game state on mount
  useEffect(() => {
    const loadGameState = async () => {
      if (modeState === "two-player" && gameCode) {
        try {
          // First try to use state from navigation
          if (location.state?.questions && location.state?.board) {
            setQuestions(location.state.questions);
            setBoard(location.state.board);
            setGameStarted(true);
            setLoading(false);
            return;
          }

          // If no navigation state, fetch from server
          const state = await get(`/api/gameroom/${gameCode}`);

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

  // Update stats for single player mode
  const updateStats = async (won) => {
    try {
      const user = await get("/api/whoami");
      if (!user._id) {
        console.error("User not logged in");
        return;
      }

      await post("/api/stats/tictactoesingle", {
        won,
        userId: userId,
      });
    } catch (err) {
      console.error("Failed to update stats:", err);
    }
  };

  // Timer for single player mode
  useEffect(() => {
    if (modeState === "single" && gameStarted && !gameOver && timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            setGameOver(true);
            setWinner(null); // No winner if time runs out
            // Update stats for loss due to timeout
            updateStats(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [modeState, gameStarted, gameOver, timeLeft]);

  // Handle cell click for both single and multiplayer modes
  const handleCellClick = async (index) => {
    if (!board[index] || board[index].solved || gameOver) return;

    setSelectedCell(index);
    setCurrentQuestion(board[index]);

    if (modeState === "single") {
      setShowModal(true);
    } else if (modeState === "two-player" && gameCode) {
      const userAnswer = prompt(`Answer this question: ${board[index].value}`);
      if (!userAnswer) return;

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
    }
  };

  // Handle answer submission for single player mode
  const handleAnswerSubmit = async (e) => {
    e.preventDefault();
    const userAnswer = answer.trim().toLowerCase();
    const index = selectedCell;

    // Close modal immediately
    setShowModal(false);
    setAnswer("");

    // Check if answer is correct
    if (userAnswer === currentQuestion.answer.toString()) {
      // Update board
      const newBoard = [...board];
      newBoard[index] = {
        ...newBoard[index],
        solved: true,
        player: "X",
      };
      setBoard(newBoard);
      setFeedback({ correct: true, index });
      // Clear feedback after 1 second
      setTimeout(() => setFeedback(null), 1000);

      // Check for winner (3 in a row)
      const lines = [
        [0, 1, 2], // Rows
        [3, 4, 5],
        [6, 7, 8],
        [0, 3, 6], // Columns
        [1, 4, 7],
        [2, 5, 8],
        [0, 4, 8], // Diagonals
        [2, 4, 6],
      ];

      for (const [a, b, c] of lines) {
        if (newBoard[a]?.solved && newBoard[b]?.solved && newBoard[c]?.solved) {
          setGameOver(true);
          setWinner("X");
          // Update stats for win
          await updateStats(true);
          return;
        }
      }
    } else {
      setFeedback({ correct: false, index });
      // Clear feedback after 1 second
      setTimeout(() => setFeedback(null), 1000);
    }
  };

  const handleModalClose = () => {
    setShowModal(false);
    setAnswer("");
    setCurrentQuestion(null);
    setSelectedCell(null);
  };

  // Socket setup for multiplayer mode
  useEffect(() => {
    let mounted = true;
    let socketInstance = null;

    const initializeSocket = async () => {
      if (modeState !== "two-player" || !gameCode) return;

      try {
        // Get user info first
        const userInfo = await get("/api/whoami");
        if (!userInfo || !userInfo._id) {
          throw new Error("Not logged in");
        }

        const socket = await initiateSocket();
        if (!socket || !mounted) return;

        socketInstance = socket;
        socket.emit("join room", {
          gameCode,
          user: {
            _id: userInfo._id,
            name: userInfo.name,
          },
        });

        socket.on("answer:correct", ({ index }) => {
          if (!mounted) return;
          setFeedback({ correct: true, index });
          setTimeout(() => setFeedback(null), 1000);
        });

        socket.on("answer:incorrect", ({ index }) => {
          if (!mounted) return;
          setFeedback({ correct: false, index });
          setTimeout(() => setFeedback(null), 1000);
        });

        socket.on("game:error", (error) => {
          if (!mounted) return;
          console.error("Game error:", error);
          setError(error.message || "An error occurred");
        });

        socket.on("cell:claimed", ({ index, symbol }) => {
          if (!mounted) return;
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

        socket.on("game:joined", ({ symbol, gameState }) => {
          if (!mounted) return;
          if (gameState) {
            setBoard(gameState.board);
            setCurrentPlayer(gameState.currentPlayer);
            setWinner(gameState.winner);
            if (gameState.gameOver) {
              setGameOver(true);
            }
          }
        });

        socket.on("game:update", ({ board, currentPlayer, winner }) => {
          if (!mounted) return;
          if (board) setBoard(board);
          if (currentPlayer) setCurrentPlayer(currentPlayer);
          if (winner) setWinner(winner);
        });

        socket.on("game:over", ({ winner, gameOver, board }) => {
          if (!mounted) return;
          setWinner(winner);
          setGameOver(gameOver);
          if (board) setBoard(board);
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
        socketInstance.off("answer:correct");
        socketInstance.off("answer:incorrect");
        socketInstance.off("game:error");
        socketInstance.off("game:joined");
        socketInstance.off("game:update");
        socketInstance.off("cell:claimed");
        socketInstance.off("game:over");
      }
    };
  }, [gameCode, modeState]);

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

  const renderCategorySelect = () => {
    return (
      <div className="category-select-container">
        <h2>Select Category</h2>
        <div className="category-buttons">
          <button className="category-button" onClick={() => setCategory("easy_arithmetic")}>
            Easy Arithmetic
          </button>
          <button className="category-button" onClick={() => setCategory("hard_arithmetic")}>
            Hard Arithmetic
          </button>
          <button className="category-button" onClick={() => setCategory("science")}>
            Science
          </button>
          <button className="category-button" onClick={() => setCategory("history")}>
            History
          </button>
          <button className="category-button" onClick={() => setCategory("literature")}>
            Literature
          </button>
        </div>
      </div>
    );
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
      <div className="tic-back-button-container">
        <button className="tic-back-button" onClick={() => navigate("/games")}>
          ↩
        </button>
      </div>
      <h1>Num-Tac-Toe</h1>
      <div className="category">Category: {category}</div>

      {modeState === "two-player" && (
        <div className="player-info">You are Player {playerSymbol}</div>
      )}

      {modeState === "single" && <div className="timer">Time Left: {formatTime(timeLeft)}</div>}

      <div className="game-status">
        {gameOver && (
          <>
            {timeLeft === 0
              ? "Time's up! Game Over :("
              : winner
              ? winner === "tie"
                ? "It's a tie!"
                : `Player ${winner} wins!`
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
            {feedback?.index === index && (
              <div className={`feedback-icon ${feedback.correct ? "correct" : "incorrect"}`}>
                {feedback.correct ? "✓" : "✗"}
              </div>
            )}
          </div>
        ))}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={handleModalClose}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="question-text">{currentQuestion.value}</div>
            <form onSubmit={handleAnswerSubmit}>
              <input
                type="text"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Enter your answer..."
                autoFocus
              />
              <div className="modal-buttons">
                <button type="submit">Submit</button>
                <button type="button" onClick={handleModalClose}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {gameOver && (
        <div className="game-over">
          <h2>Game Over!</h2>
        </div>
      )}
    </div>
  );
};

export default TicTacToe;
