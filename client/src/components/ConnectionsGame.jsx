import React, { useState, useEffect } from "react";
import "./ConnectionsGame.css";

const ConnectionsGame = () => {
  // State for managing the game
  const [gameStarted, setGameStarted] = useState(false);
  const [selectedNumbers, setSelectedNumbers] = useState([]);
  const [displayedNumbers, setDisplayedNumbers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [solvedCategories, setSolvedCategories] = useState([]);
  const [attempts, setAttempts] = useState(4);
  const [message, setMessage] = useState("");

  const categoryColors = {
    1: "yellow", // Level 1
    2: "green",  // Level 2
    3: "blue",   // Level 3
    4: "pink"    // Level 4
  };

  // Function to start a new game
  const startGame = async () => {
    try {
      // Fetch 4 random categories (one from each level) from the server
      const response = await fetch("/api/categories/random");
      const fetchedCategories = await response.json();

      // Get 4 random numbers from each category
      const numbers = [];
      fetchedCategories.forEach((category) => {
        const randomNumbers = category.sampleNumbers.sort(() => Math.random() - 0.5).slice(0, 4);
        numbers.push(
          ...randomNumbers.map((num) => ({
            value: num,
            categoryId: category._id,
            categoryName: category.name,
            selected: false,
          }))
        );
      });

      // Shuffle all numbers
      const shuffledNumbers = numbers.sort(() => Math.random() - 0.5);

      setCategories(fetchedCategories);
      setDisplayedNumbers(shuffledNumbers);
      setGameStarted(true);
      setAttempts(4);
      setSolvedCategories([]);
      setSelectedNumbers([]);
      setMessage("Select four numbers that you think belong together!");
    } catch (error) {
      console.error("Error starting game:", error);
      setMessage("Error starting game. Please try again.");
    }
  };

  // Handle number selection
  const handleNumberClick = (index) => {
    if (selectedNumbers.length >= 4 && !displayedNumbers[index].selected) {
      setMessage("You can only select 4 numbers at a time!");
      return;
    }

    const newDisplayedNumbers = [...displayedNumbers];
    newDisplayedNumbers[index].selected = !newDisplayedNumbers[index].selected;
    setDisplayedNumbers(newDisplayedNumbers);

    if (newDisplayedNumbers[index].selected) {
      setSelectedNumbers([...selectedNumbers, newDisplayedNumbers[index]]);
    } else {
      setSelectedNumbers(
        selectedNumbers.filter((num) => num.value !== newDisplayedNumbers[index].value)
      );
    }
  };

  // Check if selected numbers form a valid category
  const checkSelection = () => {
    if (selectedNumbers.length !== 4) {
      setMessage("Please select exactly 4 numbers!");
      return;
    }

    // Check if all selected numbers belong to the same category
    const categoryId = selectedNumbers[0].categoryId;
    const isCorrect = selectedNumbers.every((num) => num.categoryId === categoryId);

    if (isCorrect) {
      // Mark category as solved
      setSolvedCategories([...solvedCategories, categoryId]);

      // Update displayed numbers to show they're solved
      const newDisplayedNumbers = displayedNumbers.map((num) =>
        selectedNumbers.some((selected) => selected.value === num.value)
          ? { ...num, solved: true, selected: false }
          : num
      );

      setDisplayedNumbers(newDisplayedNumbers);
      setSelectedNumbers([]);
      setMessage("Correct! Keep going!");

      // Check if game is won
      if (solvedCategories.length + 1 === 4) {
        setMessage("Congratulations! You won!");
        setTimeout(() => {
          setGameStarted(false);
        }, 2000);
      }
    } else {
      setAttempts(attempts - 1);
      if (attempts <= 1) {
        setMessage("Game Over! Out of attempts.");
        setTimeout(() => {
          setGameStarted(false);
        }, 2000);
      } else {
        setMessage(`Incorrect! ${attempts - 1} attempts remaining.`);
        // Deselect all numbers
        const newDisplayedNumbers = displayedNumbers.map((num) => ({
          ...num,
          selected: false,
        }));
        setDisplayedNumbers(newDisplayedNumbers);
        setSelectedNumbers([]);
      }
    }
  };

  return (
    <div className="connections-game">
      <h1>Mathnections</h1>

      {!gameStarted ? (
        <button onClick={startGame} className="start-button">
          Start New Game
        </button>
      ) : (
        <>
          <div className="game-info">
            <p className="message">{message}</p>
            <p className="attempts">Attempts remaining: {attempts}</p>
          </div>

          <div className="number-grid">
            {displayedNumbers.map((num, index) => (
              <button
                key={index}
                className={`number-cell ${num.selected ? "selected" : ""} ${
                  num.solved ? `solved-${categories.find(cat => cat._id === num.categoryId)?.level}` : ""
                }`}
                onClick={() => handleNumberClick(index)}
                disabled={num.solved}
              >
                {num.value}
              </button>
            ))}
          </div>

          {selectedNumbers.length === 4 && (
            <button onClick={checkSelection} className="submit-button">
              Submit Selection
            </button>
          )}

          <div className="solved-categories">
            {solvedCategories.map((categoryId, index) => {
              const category = categories.find((cat) => cat._id === categoryId);
              return (
                <div key={index} className={`solved-category solved-${category?.level}`}>
                  {category?.name}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export default ConnectionsGame;
