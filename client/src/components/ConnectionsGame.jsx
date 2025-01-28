import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./ConnectionsGame.css";
import { post } from "../utilities";

const ConnectionsGame = () => {
  // State for managing the game
  const [gameStarted, setGameStarted] = useState(false);
  const [selectedNumbers, setSelectedNumbers] = useState([]);
  const [displayedNumbers, setDisplayedNumbers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [solvedCategories, setSolvedCategories] = useState([]);
  const [attempts, setAttempts] = useState(4);
  const [message, setMessage] = useState("");
  const [gameOver, setGameOver] = useState(false);
  const [gameWon, setGameWon] = useState(false);
  const [usedAttempts, setUsedAttempts] = useState(0);
  const [difficulty, setDifficulty] = useState("medium");
  const [error, setError] = useState(null);

  const categoryColors = {
    1: "yellow", // Level 1
    2: "green", // Level 2
    3: "blue", // Level 3
    4: "pink", // Level 4
  };

  // Function to update user statistics
  const updateStats = async (won, attempts) => {
    try {
      await post("/api/stats/connections", {
        won,
        attempts,
      });
    } catch (err) {
      console.error("Error updating stats:", err);
    }
  };

  // Function to handle game completion
  const handleGameComplete = async (won) => {
    setGameOver(true);
    setGameWon(won);
    setMessage("");
    
    try {
      await post("/api/stats/connections", {
        won,
        attempts: 5 - attempts, // 5 is max attempts, so 5 - attempts = used attempts
      });
    } catch (err) {
      console.error("Failed to update stats:", err);
    }
  };

  // Function to start a new game
  const startGame = async () => {
    try {
      const response = await fetch(`/api/categories/random?difficulty=${difficulty}`);
      const { categories: categoriesByLevel, levelCounts } = await response.json();

      // Keep track of all used numbers across categories
      const usedNumbers = new Set();
      const selectedCategories = [];

      // Try to find valid categories for each level
      for (const [level, count] of Object.entries(levelCounts)) {
        const levelCategories = categoriesByLevel[level];
        let categoriesFoundForLevel = 0;

        // Try each category in this level until we find enough valid ones
        for (const category of levelCategories) {
          if (categoriesFoundForLevel >= count) break;

          const categoryNumbers = generateRandomWords(category, usedNumbers);
          if (categoryNumbers) {
            selectedCategories.push({
              ...category,
              selectedNumbers: categoryNumbers.map((num) => ({
                value: num,
                categoryId: category._id,
                categoryName: category.name,
                color: category.color,
                selected: false,
              })),
            });
            categoriesFoundForLevel++;
          }
        }

        if (categoriesFoundForLevel < count) {
          throw new Error(`Could not find enough valid categories for level ${level}`);
        }
      }

      // Flatten all numbers into a single array
      const allNumbers = selectedCategories.flatMap((cat) => cat.selectedNumbers);

      // Verify we have exactly 16 numbers
      if (allNumbers.length !== 16) {
        throw new Error("Incorrect number of numbers generated");
      }

      // Shuffle the numbers
      const shuffledNumbers = shuffleArray(allNumbers);
      setDisplayedNumbers(shuffledNumbers);
      setCategories(selectedCategories);
      setGameStarted(true);
      setAttempts(4);
      setSolvedCategories([]);
      setSelectedNumbers([]);
      setMessage("Select four numbers that you think belong together!");
    } catch (error) {
      console.error("Error starting game:", error);
      setError("Failed to load game data");
    }
  };

  // Function to play again
  const playAgain = () => {
    setGameOver(false);
    setGameWon(false);
    setUsedAttempts(0);
    setError(null);
    setGameStarted(false); // Return to difficulty selection
  };

  // Function to display categories at game end
  const renderCategoryReveal = () => {
    // Group categories by level
    const categoriesByLevel = {};
    categories.forEach((cat) => {
      if (!categoriesByLevel[cat.level]) {
        categoriesByLevel[cat.level] = [];
      }
      categoriesByLevel[cat.level].push(cat);
    });

    return (
      <div className="category-reveal">
        {Object.entries(categoriesByLevel)
          .sort(([levelA], [levelB]) => levelA - levelB)
          .map(([level, cats]) => (
            <div key={level} className="level-categories">
              <h3>Level {level}</h3>
              {cats.map((category, index) => (
                <div key={index} className={`revealed-category revealed-${category.level}`}>
                  <span className="category-name">{category.name}:</span>
                  <span className="category-numbers">
                    {displayedNumbers
                      .filter((num) => num.categoryId === category._id)
                      .map((num) => num.value)
                      .join(", ")}
                  </span>
                </div>
              ))}
            </div>
          ))}
      </div>
    );
  };

  // Function to rearrange numbers based on solved/unsolved status
  const rearrangeNumbers = (numbers, revealAll = false) => {
    if (revealAll) {
      // Group numbers by category and sort by level
      return numbers.sort((a, b) => {
        const catA = categories.find((cat) => cat._id === a.categoryId);
        const catB = categories.find((cat) => cat._id === b.categoryId);
        return catA.level - catB.level || categories.indexOf(catA) - categories.indexOf(catB);
      });
    } else {
      // During gameplay, keep solved categories at top
      const solved = [];
      const unsolved = [];

      // First, group all numbers by their category
      const categoryGroups = {};
      numbers.forEach((num) => {
        if (!categoryGroups[num.categoryId]) {
          categoryGroups[num.categoryId] = [];
        }
        categoryGroups[num.categoryId].push(num);
      });

      // Add solved category groups to solved array
      solvedCategories.forEach((categoryId) => {
        if (categoryGroups[categoryId]) {
          solved.push(...categoryGroups[categoryId]);
        }
      });

      // Add remaining numbers to unsolved array
      numbers.forEach((num) => {
        if (!solvedCategories.includes(num.categoryId)) {
          unsolved.push(num);
        }
      });

      // Shuffle unsolved numbers
      const shuffledUnsolved = [...unsolved].sort(() => Math.random() - 0.5);

      return [...solved, ...shuffledUnsolved];
    }
  };

  // Function to render solved categories
  const renderSolvedCategories = () => {
    const solvedCats = categories.filter((cat) =>
      displayedNumbers.some((num) => num.categoryId === cat._id && num.solved)
    );

    return solvedCats.map((category) => {
      // Get the actual numbers for this category that were in the game
      const categoryNumbers = displayedNumbers
        .filter((num) => num.categoryId === category._id)
        .map((num) => num.value)
        .sort((a, b) => a - b) // Sort numbers in ascending order
        .join(", ");

      return (
        <div key={category._id} className={`category-row level-${category.level}`}>
          <div className="category-title">{category.name}</div>
          <div className="category-subtitle">{categoryNumbers}</div>
        </div>
      );
    });
  };

  // Function to render remaining numbers
  const renderRemainingNumbers = () => {
    return (
      <div className="numbers-grid">
        {displayedNumbers.map(
          (number, index) =>
            !number.solved && (
              <button
                key={`${number.value}-${index}`}
                className={`number-cell ${number.selected ? "selected" : ""}`}
                onClick={() => handleNumberClick(index)}
                disabled={gameOver}
              >
                {number.value}
              </button>
            )
        )}
      </div>
    );
  };

  // Render a solved category block
  const renderSolvedCategory = (categoryId) => {
    const category = categories.find((cat) => cat._id === categoryId);
    const categoryNumbers = displayedNumbers
      .filter((num) => num.categoryId === categoryId)
      .sort((a, b) => a.value - b.value);

    return (
      <div key={categoryId} className={`category-row level-${category.level}`}>
        <div className="category-title">{category.name.toUpperCase()}</div>
        <div className="category-subtitle">
          {categoryNumbers.map((num) => num.value).join(", ")}
        </div>
      </div>
    );
  };

  // Handle number selection
  const handleNumberClick = (index) => {
    const clickedNumber = displayedNumbers[index];

    if (!clickedNumber) {
      console.error("No number found at index:", index);
      return;
    }

    if (clickedNumber.solved) {
      setMessage("That number is part of a solved category!");
      return;
    }

    if (selectedNumbers.length >= 4 && !clickedNumber.selected) {
      setMessage("You can only select 4 numbers at a time!");
      return;
    }

    // Create new arrays to maintain state immutability
    const newDisplayedNumbers = displayedNumbers.map((num, i) =>
      i === index ? { ...num, selected: !num.selected } : num
    );

    const newSelectedNumbers = clickedNumber.selected
      ? selectedNumbers.filter((num) => num.value !== clickedNumber.value)
      : [...selectedNumbers, clickedNumber];

    // Update state
    setDisplayedNumbers(newDisplayedNumbers);
    setSelectedNumbers(newSelectedNumbers);

    // Update message
    if (newSelectedNumbers.length === 4) {
      setMessage("Press Submit to check your answer!");
    } else {
      setMessage(`Select ${4 - newSelectedNumbers.length} more numbers.`);
    }
  };

  // Function to render the game grid
  const renderGrid = () => {
    return (
      <div className="number-grid">
        {displayedNumbers.map((number, index) => (
          <button
            key={`${number.value}-${index}`}
            className={`number-cell ${number.selected ? "selected" : ""} ${
              number.solved ? `solved-${number.categoryLevel}` : ""
            } ${number.revealed ? "revealed" : ""}`}
            onClick={() => handleNumberClick(index)}
            disabled={gameOver || number.solved}
          >
            {number.value}
          </button>
        ))}
      </div>
    );
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
      const newDisplayedNumbers = displayedNumbers.map((num) => {
        if (selectedNumbers.some((selected) => selected.value === num.value)) {
          return { ...num, solved: true, selected: false };
        }
        return { ...num, selected: false };
      });

      // Sort numbers: solved categories at the top, grouped by category
      const sortedNumbers = [...newDisplayedNumbers].sort((a, b) => {
        // First sort by solved status
        if (a.solved && !b.solved) return -1;
        if (!a.solved && b.solved) return 1;

        // Then group by category
        if (a.solved && b.solved) {
          return a.categoryId.localeCompare(b.categoryId);
        }

        return 0;
      });

      setDisplayedNumbers(sortedNumbers);
      setSelectedNumbers([]);
      setMessage("Correct! Keep going!");

      // Check if game is won
      if (solvedCategories.length + 1 === categories.length) {
        handleGameComplete(true);
      }
    } else {
      setAttempts(attempts - 1);
      setUsedAttempts(usedAttempts + 1);

      // Count how many numbers are from each category
      const categoryCount = new Map();
      selectedNumbers.forEach((num) => {
        const count = categoryCount.get(num.categoryId) || 0;
        categoryCount.set(num.categoryId, count + 1);
      });

      // Find if any category has exactly 3 matches
      let almostCategory = null;
      for (const [categoryId, count] of categoryCount) {
        if (count === 3) {
          almostCategory = categories.find((cat) => cat._id === categoryId);
          break;
        }
      }

      if (attempts <= 1) {
        // Game over, reveal all categories
        const newDisplayedNumbers = displayedNumbers.map((num) => ({
          ...num,
          selected: false,
          revealed: !num.solved,
        }));

        // Sort numbers by category
        const sortedNumbers = [...newDisplayedNumbers].sort((a, b) => {
          // First sort by solved status
          if (a.solved && !b.solved) return -1;
          if (!a.solved && b.solved) return 1;

          // Then group by category
          return a.categoryId.localeCompare(b.categoryId);
        });

        setDisplayedNumbers(sortedNumbers);
        setMessage("");
        handleGameComplete(false);
      } else {
        // Clear selections and update message
        const newDisplayedNumbers = displayedNumbers.map((num) => ({
          ...num,
          selected: false,
        }));
        setDisplayedNumbers(newDisplayedNumbers);
        setSelectedNumbers([]);

        if (almostCategory) {
          setMessage(
            `So close! You are one away from a category. ${attempts - 1} attempts remaining.`
          );
        } else {
          setMessage(`Incorrect! ${attempts - 1} attempts remaining.`);
        }
      }
    }
  };

  const handleSubmit = () => {
    checkSelection();
  };

  const generateRandomWords = (category, usedNumbers = new Set()) => {
    if (!category || !category.sampleNumbers) return [];

    let selectedNumbers = [];

    // Special handling for sequence categories
    if (category.name.toLowerCase().includes("sequence")) {
      console.log("found sequence", category.name);
      // For sequence categories, select 4 consecutive elements that don't overlap
      const numbers = [...category.sampleNumbers];
      console.log("Available numbers:", numbers);

      // Try different starting points until we find 4 consecutive numbers that don't overlap
      let validSequenceFound = false;
      let attempts = 0;
      const maxAttempts = numbers.length - 3; // Maximum possible starting positions

      while (!validSequenceFound && attempts < maxAttempts) {
        const startIndex = Math.floor(Math.random() * (numbers.length - 3));
        const potentialSequence = numbers.slice(startIndex, startIndex + 4);

        // Check if any number in the sequence is already used
        const hasOverlap = potentialSequence.some((num) => usedNumbers.has(num));

        if (!hasOverlap) {
          selectedNumbers = potentialSequence;
          validSequenceFound = true;
          // Add these numbers to used set
          potentialSequence.forEach((num) => usedNumbers.add(num));
        }

        attempts++;
      }

      if (!validSequenceFound) {
        console.log("Could not find non-overlapping sequence");
        return null; // Signal that we need to try a different category
      }

      console.log("Selected sequence:", selectedNumbers);
    } else {
      // For non-sequence categories, randomly select 4 non-overlapping numbers
      const numbers = [...category.sampleNumbers];
      let attempts = 0;
      const maxAttempts = numbers.length * 2; // Reasonable number of attempts

      while (selectedNumbers.length < 4 && attempts < maxAttempts) {
        const randomIndex = Math.floor(Math.random() * numbers.length);
        const number = numbers[randomIndex];

        if (!usedNumbers.has(number)) {
          selectedNumbers.push(number);
          usedNumbers.add(number);
          numbers.splice(randomIndex, 1); // Remove the used number
        }

        attempts++;
      }

      if (selectedNumbers.length < 4) {
        console.log("Could not find enough non-overlapping numbers");
        return null; // Signal that we need to try a different category
      }
    }

    return selectedNumbers;
  };

  const shuffleArray = (array) => {
    return [...array].sort(() => Math.random() - 0.5);
  };

  const navigate = useNavigate();

  if (!gameStarted) {
    return (
      <div className="connections-setup">
        <h1>Math-nections</h1>
        <div className="setup-content">
          <h2>Select Difficulty</h2>
          <div className="difficulty-options">
            {["easy", "medium", "hard"].map((level) => (
              <button
                key={level}
                className={`difficulty-button ${difficulty === level ? "selected" : ""}`}
                onClick={() => setDifficulty(level)}
              >
                {level.charAt(0).toUpperCase() + level.slice(1)}
              </button>
            ))}
          </div>
          <button className="start-game-button" onClick={startGame}>
            Start Game
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="connections-game">
      <button className="back-button" onClick={() => navigate("/games")}>
        ↩
      </button>
      <div className="game-content">
        <div className="game-header">
          <h1>Mathnections</h1>
          {gameOver && (
            <div className="game-over">
              <h2>{gameWon ? "Congratulations!" : "Game Over!"}</h2>
              <button onClick={playAgain} className="play-again-button">
                Play Again
              </button>
            </div>
          )}
        </div>

        {error && <div className="error-message">{error}</div>}
        {message && <div className="message">{message}</div>}

        <div className="game-board">
          {renderSolvedCategories()}
          {renderRemainingNumbers()}

          {selectedNumbers.length > 0 && !gameOver && (
            <button
              className="submit-button"
              onClick={handleSubmit}
              disabled={selectedNumbers.length !== 4}
            >
              Submit
            </button>
          )}

          {!gameOver && (
            <div className="attempts-counter">
              <span className="attempts-label">Attempts remaining:</span>
              {[...Array(4)].map((_, i) => (
                <span key={i} className={`attempt-dot ${i >= attempts ? "used" : ""}`}>
                  ●
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConnectionsGame;
