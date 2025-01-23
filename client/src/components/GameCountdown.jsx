import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { getSocket } from "../client-socket";
import "./GameCountdown.css";

const GameCountdown = ({ gameCode, category, initialQuestions, playerSymbol }) => {
  const [count, setCount] = useState(3);
  const navigate = useNavigate();
  const questionsRef = useRef(initialQuestions);
  const countdownStarted = useRef(false);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    let mounted = true;
    let countdownInterval;

    const startCountdown = () => {
      if (!mounted || countdownStarted.current) return;
      
      console.log("Starting countdown with:", {
        questions: questionsRef.current,
        symbol: playerSymbol
      });
      countdownStarted.current = true;

      countdownInterval = setInterval(() => {
        setCount((prev) => {
          console.log("Countdown:", prev);
          if (prev <= 1) {
            clearInterval(countdownInterval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    };

    // If we already have questions from props, we can start right away
    if (initialQuestions && !countdownStarted.current) {
      console.log("Using initial questions:", initialQuestions);
      questionsRef.current = initialQuestions;
      startCountdown();
    }

    socket.on("questions:received", ({ questions, board }) => {
      if (!mounted) return;
      console.log("Questions received in countdown:", { questions, board });
      questionsRef.current = { questions, board };
      if (!countdownStarted.current) {
        startCountdown();
      }
    });

    socket.on("countdown:start", () => {
      if (!mounted || !questionsRef.current) {
        console.log("Cannot start countdown - no questions yet");
        return;
      }
      startCountdown();
    });

    return () => {
      mounted = false;
      if (countdownInterval) {
        clearInterval(countdownInterval);
      }
      socket.off("countdown:start");
      socket.off("questions:received");
    };
  }, [initialQuestions, playerSymbol]);

  useEffect(() => {
    if (count === 0 && questionsRef.current) {
      console.log("Navigating to game with:", {
        questions: questionsRef.current.questions,
        board: questionsRef.current.board,
        symbol: playerSymbol
      });
      navigate(`/tictactoe/game/${gameCode}`, {
        state: {
          mode: "two-player",
          gameCode,
          category,
          questions: questionsRef.current.questions,
          board: questionsRef.current.board,
          symbol: playerSymbol
        },
        replace: true
      });
    }
  }, [count, navigate, gameCode, category, playerSymbol]);

  return (
    <div className="countdown-container">
      <div className="countdown-overlay">
        <div className="countdown-number">{count}</div>
        <div className="countdown-text">
          {questionsRef.current ? "Game starting in..." : "Loading questions..."}
        </div>
      </div>
      <div className="player-info">
        You are Player {playerSymbol}
      </div>
    </div>
  );
};

export default GameCountdown;
