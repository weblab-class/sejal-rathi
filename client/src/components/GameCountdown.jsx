import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getSocket } from "../client-socket";
import "./GameCountdown.css";

const GameCountdown = ({ gameCode, category, playerSymbol }) => {
  const [count, setCount] = useState(3);
  const [questionsReady, setQuestionsReady] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    // Listen for questions being ready
    socket.on("questions:received", () => {
      console.log("Questions received in countdown");
      setQuestionsReady(true);
    });

    return () => {
      socket.off("questions:received");
    };
  }, []);

  useEffect(() => {
    // Start countdown only after questions are ready for player O
    // or immediately for player X who will fetch questions
    if (playerSymbol === "O" && !questionsReady) {
      return;
    }

    const timer = setInterval(() => {
      setCount((prevCount) => {
        if (prevCount === 1) {
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
  }, [navigate, gameCode, category, playerSymbol, questionsReady]);

  return (
    <div className="countdown-container">
      <div className="countdown-overlay">
        <div className="countdown-number">{count}</div>
        <div className="countdown-text">
          {playerSymbol === "O" && !questionsReady 
            ? "Waiting for questions..." 
            : "Game Starting..."}
        </div>
      </div>
    </div>
  );
};

export default GameCountdown;
