import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./Nerdle.css";

const WORD_LENGTH = 5;
const ROWS = 6;

const Nerdle = () => {
  const navigate = useNavigate();
  const [board, setBoard] = useState(
    Array(ROWS)
      .fill()
      .map(() => Array(WORD_LENGTH).fill(""))
  );
  const [currentRow, setCurrentRow] = useState(0);
  const [currentCol, setCurrentCol] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [solution, setSolution] = useState("");
  const [keyStates, setKeyStates] = useState({});
  const [gameWon, setGameWon] = useState(false);
  const [boardStates, setBoardStates] = useState(
    Array(ROWS)
      .fill()
      .map(() => Array(WORD_LENGTH).fill(""))
  );

  const initializeGame = () => {
    const randomNumber = Math.floor(10000 + Math.random() * 90000).toString();
    setSolution(randomNumber);
    setBoard(
      Array(ROWS)
        .fill()
        .map(() => Array(WORD_LENGTH).fill(""))
    );
    setBoardStates(
      Array(ROWS)
        .fill()
        .map(() => Array(WORD_LENGTH).fill(""))
    );
    setCurrentRow(0);
    setCurrentCol(0);
    setGameOver(false);
    setGameWon(false);
    setKeyStates({});
  };

  useEffect(() => {
    initializeGame();
  }, []);

  const getKeyState = (key) => {
    return keyStates[key] || "";
  };

  const updateKeyStates = (guess) => {
    const newKeyStates = { ...keyStates };
    const solutionArray = solution.split("");
    const guessArray = guess.split("");

    // If it's a winning guess, mark all digits as correct
    if (guess === solution) {
      guessArray.forEach((digit) => {
        newKeyStates[digit] = "correct";
      });
      setKeyStates(newKeyStates);
      return;
    }

    // First pass: mark exact matches
    guessArray.forEach((digit, i) => {
      if (digit === solutionArray[i]) {
        newKeyStates[digit] = "correct";
      }
    });

    // Second pass: mark partial matches
    guessArray.forEach((digit, i) => {
      if (digit !== solutionArray[i] && solutionArray.includes(digit)) {
        // Only mark as present if we haven't already marked it as correct
        if (newKeyStates[digit] !== "correct") {
          newKeyStates[digit] = "present";
        }
      } else if (!newKeyStates[digit]) {
        newKeyStates[digit] = "absent";
      }
    });

    setKeyStates(newKeyStates);
  };

  const calculateTileStates = (row) => {
    const newBoardStates = [...boardStates];
    const guessArray = board[row];
    const solutionArray = solution.split("");
    const states = Array(WORD_LENGTH).fill("");
    const guess = guessArray.join("");

    // If it's a winning guess, all tiles should be green
    if (guess === solution) {
      newBoardStates[row] = Array(WORD_LENGTH).fill("correct");
      setBoardStates(newBoardStates);
      return;
    }

    // First pass: mark exact matches
    guessArray.forEach((digit, i) => {
      if (digit === solutionArray[i]) {
        states[i] = "correct";
        solutionArray[i] = null;
      }
    });

    // Second pass: mark partial matches
    guessArray.forEach((digit, i) => {
      if (states[i]) return; // Skip if already marked

      const solutionIndex = solutionArray.indexOf(digit);
      if (solutionIndex !== -1) {
        states[i] = "present";
        solutionArray[solutionIndex] = null;
      } else {
        states[i] = "absent";
      }
    });

    newBoardStates[row] = states;
    setBoardStates(newBoardStates);
  };

  const handleKeyPress = (key) => {
    if (gameOver) return;

    if (key === "ENTER") {
      if (currentCol === WORD_LENGTH) {
        const guess = board[currentRow].join("");
        updateKeyStates(guess);
        calculateTileStates(currentRow);

        if (guess === solution) {
          setGameWon(true);
          setGameOver(true);
        } else {
          setCurrentRow(currentRow + 1);
          setCurrentCol(0);
          if (currentRow + 1 === ROWS) {
            setGameOver(true);
          }
        }
      }
    } else if (key === "BACKSPACE") {
      if (currentCol > 0) {
        const newBoard = [...board];
        newBoard[currentRow][currentCol - 1] = "";
        setBoard(newBoard);
        setCurrentCol(currentCol - 1);
      }
    } else if (currentCol < WORD_LENGTH) {
      // Only update if it's a number key
      if (/^[0-9]$/.test(key)) {
        const newBoard = [...board];
        newBoard[currentRow][currentCol] = key;
        setBoard(newBoard);
        setCurrentCol(currentCol + 1);
      }
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Prevent default to avoid double input
      e.preventDefault();

      if (e.key === "Enter") {
        handleKeyPress("ENTER");
      } else if (e.key === "Backspace") {
        handleKeyPress("BACKSPACE");
      } else if (/^[0-9]$/.test(e.key)) {
        handleKeyPress(e.key);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentRow, currentCol, board, gameOver]);

  const renderBoard = () => {
    return (
      <div className="board">
        {board.map((row, rowIndex) => (
          <div key={rowIndex} className="row">
            {row.map((digit, colIndex) => (
              <div key={colIndex} className={`tile ${boardStates[rowIndex][colIndex]}`}>
                {digit}
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  };

  const renderKeyboard = () => {
    const rows = [
      ["7", "8", "9"],
      ["4", "5", "6"],
      ["1", "2", "3"],
      ["ENTER", "0", "BACKSPACE"],
    ];

    return (
      <div className="keyboard">
        {rows.map((row, i) => (
          <div key={i} className="keyboard-row">
            {row.map((key) => (
              <button
                key={key}
                className={`key ${getKeyState(key)} ${key.length > 1 ? "wide-key" : ""}`}
                onClick={() => handleKeyPress(key)}
              >
                {key === "BACKSPACE" ? "⌫" : key}
              </button>
            ))}
          </div>
        ))}
      </div>
    );
  };

  const renderGameStatus = () => {
    if (!gameOver) return null;

    return (
      <div className="game-status">
        <p className="nerdle-status-message">
          {gameWon ? "Congratulations!" : `Game Over! The correct answer was ${solution}`}
        </p>
        <button className="play-again" onClick={initializeGame}>
          Play Again
        </button>
      </div>
    );
  };

  return (
    <div className="nerdle-container">
      <div className="back-button-container">
        <button className="back-button" onClick={() => navigate("/games")}>
          ↩
        </button>
      </div>
      {renderBoard()}
      {renderGameStatus()}
      {renderKeyboard()}
    </div>
  );
};

export default Nerdle;
