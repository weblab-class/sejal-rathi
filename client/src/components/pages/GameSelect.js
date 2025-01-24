import React from "react";
import { useNavigate } from "react-router-dom";
import "./GameSelect.css";

const GameSelect = () => {
  const navigate = useNavigate();

  const handleTicTacToe = () => {
    navigate("/tictactoe/setup");
  };

  const handleNerdle = () => {
    navigate("/nerdle");
  };

  return (
    <div className="GameSelect-container">
      <h1>Choose Your Game</h1>
      <div className="GameSelect-options">
        <div className="GameSelect-option">
          <h2>TicTacToe</h2>
          <p>Play the classic game with a mathematical twist!</p>
          <button onClick={handleTicTacToe}>Play TicTacToe</button>
        </div>
        
        <div className="GameSelect-option">
          <h2>Nerdle</h2>
          <p>Can you guess the 4-digit number in 6 tries?</p>
          <button onClick={handleNerdle}>Play Nerdle</button>
        </div>
      </div>
    </div>
  );
};

export default GameSelect;
