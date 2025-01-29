import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { getSocket } from "../client-socket";
import "./GameCountdown.css";

const GameCountdown = ({ gameCode, category, initialState, playerSymbol }) => {
  const [count, setCount] = useState(3);
  const navigate = useNavigate();
  const gameStateRef = useRef(initialState);
  const countdownStarted = useRef(false);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    let mounted = true;
    let countdownInterval;

    const startCountdown = () => {
      if (!mounted || countdownStarted.current) return;

      countdownStarted.current = true;

      countdownInterval = setInterval(() => {
        setCount((prev) => {
          if (prev <= 1) {
            clearInterval(countdownInterval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    };

    // If we already have game state from props, we can start right away
    if (initialState && !countdownStarted.current) {
      gameStateRef.current = initialState;
      startCountdown();
    }

    socket.on("game:update", ({ board, currentPlayer, winner }) => {
      if (!mounted) return;
      gameStateRef.current = { board, currentPlayer, winner };
    });

    return () => {
      mounted = false;
      if (countdownInterval) {
        clearInterval(countdownInterval);
      }
      socket.off("game:update");
    };
  }, [initialState, playerSymbol]);

  useEffect(() => {
    if (count === 0 && gameStateRef.current) {
      navigate(`/tictactoe/game/${gameCode}`, {
        state: {
          mode: "two-player",
          gameCode,
          category,
          gameState: gameStateRef.current,
          symbol: playerSymbol,
        },
        replace: true,
      });
    }
  }, [count, navigate, gameCode, category, playerSymbol]);

  return (
    <div className="countdown-container">
      <div className="countdown-overlay">
        <div className="countdown-number">{count}</div>
        <div className="countdown-text">
          {gameStateRef.current ? "Game starting in..." : "Loading game state..."}
        </div>
      </div>
    </div>
  );
};

export default GameCountdown;
