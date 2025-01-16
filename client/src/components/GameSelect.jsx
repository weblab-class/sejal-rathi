import React from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "./context/ThemeContext";
import "./GameSelect.css";

const GameSelect = () => {
  const navigate = useNavigate();
  const { isDarkMode } = useTheme();

  const games = [
    {
      id: "tictactoe",
      title: "tic-tac-toe",
      description: "Race to get 3 in a row by solving questions!",
      color: "#E8EAF6",
      path: "/tictactoe/setup",
    },
    {
      id: "mathnections",
      title: "math-nections",
      description: "Identify the four categories among these 16 numbers!",
      color: "#FCE4EC",
      path: "/mathnections",
    },
    {
      id: "nerdle",
      title: "nerdle",
      description:
        "Find the 5 digit numerical solution in just 6 guesses using facts about the solution!",
      color: "#E8F5E9",
      path: "/nerdle",
    },
  ];

  return (
    <div className={`games-container ${isDarkMode ? "dark" : "light"}`}>
      <div className="games-grid">
        {games.map((game) => (
          <div
            key={game.id}
            className="game-circle"
            style={{ backgroundColor: game.color }}
            onClick={() => navigate(game.path)}
          >
            <h2>{game.title}</h2>
            <p>{game.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default GameSelect;
