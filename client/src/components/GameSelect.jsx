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
      colorDark: "#9DDFF2",
      colorLight: "#00B5E8",
      path: "/tictactoe/setup",
    },
    {
      id: "mathnections",
      title: "math-nections",
      description: "Identify the four categories among these 16 numbers!",
      colorDark: "#F9CFF2",
      colorLight: "#DC6AC9",
      path: "/connections",
    },
    {
      id: "nerdle",
      title: "nerdle",
      description:
        "Find the 5 digit numerical solution in just 6 guesses using facts about the solution!",
      colorDark: "#9EE2B4",
      colorLight: "#75D092",
      path: "/nerdle",
    },
  ];

  return (
    <div className={`games-container ${isDarkMode ? "dark" : "light"}`}>
      <h1>Choose a Game!</h1>
      <div className="games-grid">
        {games.map((game) => (
          <div
            key={game.id}
            className={`game-circle ${isDarkMode ? "dark" : "light"}`}
            style={{
              backgroundColor: isDarkMode ? game.colorDark : game.colorLight,
            }}
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
