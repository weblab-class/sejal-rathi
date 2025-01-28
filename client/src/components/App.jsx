import React, { useState, useEffect } from "react";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import jwt_decode from "jwt-decode";
import { googleLogout } from "@react-oauth/google";

import Navbar from "./Navbar";
import Home from "./Home";
import GameSelect from "./GameSelect";
import TicTacToeSetup from "./TicTacToeSetup";
import TicTacToeWaitingRoom from "./TicTacToeWaitingRoom";
import TicTacToe from "./TicTacToe";
import Profile from "./Profile";
import NotFound from "./pages/NotFound.jsx";
import ConnectionsGame from "./ConnectionsGame";
import CategorySelect from "./CategorySelect";
import Nerdle from "./Nerdle";

import { ThemeProvider } from "./context/ThemeContext";
import { SoundProvider } from "./context/SoundContext";

import "../utilities.css";
import "./pages/App.css";
import { initiateSocket, disconnectSocket } from "../client-socket";
import { get, post } from "../utilities";

const App = () => {
  const [userId, setUserId] = useState(undefined);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const initAuth = async () => {
      try {
        const user = await get("/api/whoami");
        if (user._id) {
          setUserId(user._id);
          // Only initialize socket if user is logged in
          await initiateSocket();
        }
      } catch (error) {
        console.log("Error initializing auth:", error);
      }
    };

    initAuth();

    return () => {
      disconnectSocket();
    };
  }, []);

  const handleLogin = async (credentialResponse) => {
    const token = credentialResponse.credential;
    try {
      const user = await post("/auth/login", { token });
      setUserId(user._id);
      // Initialize socket after successful login
      await initiateSocket();
      navigate("/games");
    } catch (error) {
      console.log("Error logging in:", error);
    }
  };

  const handleLogout = () => {
    setUserId(undefined);
    post("/api/logout");
    disconnectSocket();
    googleLogout();
    navigate("/");
  };

  return (
    <ThemeProvider>
      <SoundProvider>
        <div>
          {location.pathname !== "/" && (
            <Navbar userId={userId} handleLogin={handleLogin} handleLogout={handleLogout} />
          )}
          <Routes>
            <Route path="/" element={<Home userId={userId} handleLogin={handleLogin} />} />
            <Route path="/games" element={<GameSelect />} />
            <Route path="/nerdle" element={<Nerdle />} />
            {/* TicTacToe Routes */}
            <Route
              path="/tictactoe/setup"
              element={<TicTacToeSetup />}
            />
            <Route
              path="/tictactoe/category-select"
              element={<CategorySelect />}
            />
            <Route
              path="/tictactoe/waiting/:gameCode"
              element={<TicTacToeWaitingRoom />}
            />
            <Route
              path="/tictactoe/game/:gameCode"
              element={<TicTacToe />}
            />
            <Route
              path="/tictactoe/game"
              element={<TicTacToe />}
            />
            <Route path="/profile" element={<Profile userId={userId} />} />
            <Route path="/connections" element={<ConnectionsGame />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </SoundProvider>
    </ThemeProvider>
  );
};

export default App;
