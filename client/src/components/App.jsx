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
import ProtectedRoute from "./ProtectedRoute";

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
            <Route 
              path="/games" 
              element={
                <ProtectedRoute>
                  <GameSelect />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/nerdle" 
              element={
                <ProtectedRoute>
                  <Nerdle />
                </ProtectedRoute>
              } 
            />
            {/* TicTacToe Routes */}
            <Route
              path="/tictactoe/setup"
              element={
                <ProtectedRoute>
                  <TicTacToeSetup />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tictactoe/category-select"
              element={
                <ProtectedRoute>
                  <CategorySelect />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tictactoe/waiting/:gameCode"
              element={
                <ProtectedRoute>
                  <TicTacToeWaitingRoom />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tictactoe/game/single"
              element={
                <ProtectedRoute>
                  <TicTacToe />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tictactoe/game/:gameCode"
              element={
                <ProtectedRoute>
                  <TicTacToe />
                </ProtectedRoute>
              }
            />
            <Route
              path="/connections"
              element={
                <ProtectedRoute>
                  <ConnectionsGame />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </SoundProvider>
    </ThemeProvider>
  );
};

export default App;
