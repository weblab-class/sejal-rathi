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
  const [gameOver, setGameOver] = useState(false);
  const [gameWon, setGameWon] = useState(false);
  const [usedAttempts, setUsedAttempts] = useState(0);
  const [difficulty, setDifficulty] = useState("medium");

  const categoryColors = {
    1: "yellow", // Level 1
    2: "green", // Level 2
    3: "blue", // Level 3
    4: "pink", // Level 4
  };

  // Function to update user statistics
  const updateStats = async (won, attempts) => {
    try {
      await fetch("/api/stats/connections", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ won, attempts }),
      });
    } catch (error) {
      console.error("Error updating stats:", error);
    }
  };

  // Function to handle game completion
  const handleGameComplete = (won) => {
    setGameOver(true);
    setGameWon(won);
    updateStats(won, 5 - attempts); // 5 is max attempts, so 5 - attempts = used attempts
  };

  // Function to start a new game
  const startGame = async () => {
    try {
      // Fetch random categories based on difficulty from the server
      const response = await fetch(`/api/categories/random?difficulty=${difficulty}`);
      const fetchedCategories = await response.json();

      // Verify we have the correct number of categories
      const expectedCounts = {
        easy: 4, // 2 level 1 + 2 level 2
        medium: 4, // 1 level 1 + 2 level 2 + 1 level 3
        hard: 4, // 1 each from levels 1-4
      };

      if (fetchedCategories.length !== expectedCounts[difficulty]) {
        throw new Error("Incorrect number of categories received");
      }

      // Create the display numbers from the fetched categories
      const numbers = [];
      fetchedCategories.forEach((category) => {
        const categoryNumbers = category.sampleNumbers.map((num) => ({
          value: num,
          categoryId: category._id,
          categoryName: category.name,
          categoryLevel: category.level,
          selected: false,
        }));
        numbers.push(...categoryNumbers);
      });

      // Verify we have exactly 16 numbers
      if (numbers.length !== 16) {
        throw new Error("Invalid number of squares generated");
      }

      // Shuffle all numbers
      const shuffledNumbers = [...numbers].sort(() => Math.random() - 0.5);

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

  // Render the grid with category groups after game over
  const renderNumberGrid = () => {
    if (!gameOver) {
      // First render solved categories at the top
      const solvedElements = solvedCategories.map((categoryId) => {
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
      });

      // Then render unsolved numbers in the grid
      const unsolvedNumbers = displayedNumbers
        .filter((num) => !solvedCategories.includes(num.categoryId))
        .map((num, index) => (
          <button
            key={`${num.value}-${num.categoryId}`}
            className={`number-cell ${num.selected ? "selected" : ""}`}
            onClick={() => handleNumberClick(displayedNumbers.indexOf(num))}
            disabled={gameOver}
          >
            {num.value}
          </button>
        ));

      return (
        <div className="gameplay-container">
          {solvedElements}
          <div className="gameplay-grid">
            {unsolvedNumbers}
          </div>
        </div>
      );
    } else {
      // Group numbers by category after game over
      const numbersByCategory = {};
      const categoryOrder = categories.sort(
        (a, b) => a.level - b.level || categories.indexOf(a) - categories.indexOf(b)
      );

      displayedNumbers.forEach((num) => {
        if (!numbersByCategory[num.categoryId]) {
          numbersByCategory[num.categoryId] = [];
        }
        numbersByCategory[num.categoryId].push(num);
      });

      return categoryOrder.map((category) => {
        const categoryNumbers = numbersByCategory[category._id] || [];
        const sortedNumbers = categoryNumbers.sort((a, b) => a.value - b.value);
        return (
          <div key={category._id} className={`category-row level-${category.level}`}>
            <div className="category-title">{category.name.toUpperCase()}</div>
            <div className="category-subtitle">
              {sortedNumbers.map((num) => num.value).join(", ")}
            </div>
          </div>
        );
      });
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

    // Check if all selected numbers belong to the same category
    const categoryId = selectedNumbers[0].categoryId;
    const isCorrect = selectedNumbers.every((num) => num.categoryId === categoryId);

    if (isCorrect) {
      // Mark category as solved
      setSolvedCategories([...solvedCategories, categoryId]);

      // Update displayed numbers to show they're solved
      let newDisplayedNumbers = displayedNumbers.map((num) =>
        selectedNumbers.some((selected) => selected.value === num.value)
          ? { ...num, solved: true, selected: false }
          : num
      );

      // Rearrange numbers to move solved ones to top
      newDisplayedNumbers = rearrangeNumbers(newDisplayedNumbers);

      // Verify we still have 16 numbers
      if (newDisplayedNumbers.length !== 16) {
        console.error("Invalid number of squares after rearrangement");
        newDisplayedNumbers = newDisplayedNumbers.slice(0, 16);
      }

      setDisplayedNumbers(newDisplayedNumbers);
      setSelectedNumbers([]);
      setMessage("Correct! Keep going!");

      // Check if game is won
      if (solvedCategories.length + 1 === categories.length) {
        setMessage("Congratulations! You won!");
        handleGameComplete(true);
      }
    } else {
      setAttempts(attempts - 1);
      setUsedAttempts(usedAttempts + 1);

      // Show "one away" message if they had 3 from the same category
      if (almostCategory) {
        // Find the one number that wasn't from this category
        const wrongNumber = selectedNumbers.find((num) => num.categoryId !== almostCategory._id);
        const correctNumbers = displayedNumbers
          .filter((num) => num.categoryId === almostCategory._id && !selectedNumbers.includes(num))
          .map((num) => num.value);

        setMessage(`So close! You are one away from a category`);
      }

      if (attempts <= 1) {
        // First, just mark numbers as revealed without rearranging
        let newDisplayedNumbers = displayedNumbers.map((num) => ({
          ...num,
          selected: false,
          revealed: !num.solved,
        }));

        setDisplayedNumbers(newDisplayedNumbers);
        setMessage("Game Over! Revealing categories...");

        // Wait a brief moment before rearranging to allow reveal animation
        setTimeout(() => {
          // Now rearrange by level
          newDisplayedNumbers = rearrangeNumbers(newDisplayedNumbers, true);
          setDisplayedNumbers(newDisplayedNumbers);
          setMessage("Game Over! Here are the correct categories:");
          handleGameComplete(false);
        }, 500);
      } else {
        if (!almostCategory) {
          setMessage(`Incorrect! ${attempts - 1} attempts remaining.`);
        }
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

  // Function to start a new game
  const playAgain = () => {
    setGameOver(false);
    setGameWon(false);
    setUsedAttempts(0);
    startGame();
  };

  return (
    <div className="connections-game">
      <h1>Mathnections</h1>

      {!gameStarted ? (
        <div className="game-start">
          <div className="difficulty-select">
            <h2>Select Difficulty</h2>
            <div className="difficulty-buttons">
              <button
                className={`difficulty-button ${difficulty === "easy" ? "selected" : ""}`}
                onClick={() => setDifficulty("easy")}
              >
                Easy
              </button>
              <button
                className={`difficulty-button ${difficulty === "medium" ? "selected" : ""}`}
                onClick={() => setDifficulty("medium")}
              >
                Medium
              </button>
              <button
                className={`difficulty-button ${difficulty === "hard" ? "selected" : ""}`}
                onClick={() => setDifficulty("hard")}
              >
                Hard
              </button>
            </div>
            <p className="difficulty-description">
              {difficulty === "easy" && "2 Level 1 + 2 Level 2 categories"}
              {difficulty === "medium" && "1 Level 1 + 2 Level 2 + 1 Level 3 categories"}
              {difficulty === "hard" && "1 category from each level (1-4)"}
            </p>
          </div>
          <button onClick={startGame} className="start-button">
            Start New Game
          </button>
        </div>
      ) : (
        <>
          <div className="game-info">
            <p className="attempts">Attempts remaining: {attempts}</p>
          </div>

          <div className={`number-grid ${gameOver ? "game-over" : ""}`}>{renderNumberGrid()}</div>

          <div className="message">{message}</div>

          {selectedNumbers.length === 4 && !gameOver && (
            <button onClick={checkSelection} className="submit-button">
              Submit
            </button>
          )}

          {gameOver && (
            <>
              {!gameWon}
              <button onClick={playAgain} className="play-again-button">
                Play Again
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default ConnectionsGame;
