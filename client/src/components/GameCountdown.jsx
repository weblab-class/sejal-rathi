import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./GameCountdown.css";

const GameCountdown = ({ gameCode, category }) => {
  const [count, setCount] = useState(3);
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setInterval(() => {
      setCount((prevCount) => {
        if (prevCount === 1) {
          // Clear interval and navigate when count reaches 0
          clearInterval(timer);
          navigate("/tictactoe/game", {
            state: {
              mode: "two-player",
              gameCode: gameCode,
              category: category,
            },
          });
          return 0;
        }
        return prevCount - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [navigate, gameCode, category]);

  return (
    <div className="countdown-container">
      <div className="countdown-overlay">
        <div className="countdown-number">{count}</div>
        <div className="countdown-text">Game Starting...</div>
      </div>
    </div>
  );
};

export default GameCountdown;
