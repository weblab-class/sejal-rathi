import React, { useState, useEffect } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import jwt_decode from "jwt-decode";
import { googleLogout } from "@react-oauth/google";

import Navbar from "./Navbar";
import Home from "./Home";
import GameSelect from "./GameSelect";
import TicTacToeSetup from "./TicTacToeSetup";
import TicTacToe from "./TicTacToe";
import Settings from "./Settings";
import Profile from "./Profile";
import NotFound from "./pages/NotFound.jsx";

import { ThemeProvider } from "./context/ThemeContext";
import { SoundProvider } from "./context/SoundContext";

import "../utilities.css";
import "./pages/App.css";
import { socket } from "../client-socket";
import { get, post } from "../utilities";

const App = () => {
  const [userId, setUserId] = useState(undefined);
  const navigate = useNavigate();

  useEffect(() => {
    get("/api/whoami").then((user) => {
      if (user._id) {
        setUserId(user._id);
      }
    });
  }, []);

  const handleLogin = (credentialResponse) => {
    const userToken = credentialResponse.credential;
    const decodedCredential = jwt_decode(userToken);
    console.log(`Logged in as ${decodedCredential.name}`);
    post("/api/login", { token: userToken }).then((user) => {
      setUserId(user._id);
      post("/api/initsocket", { socketid: socket.id });
      navigate("/games");
    });
  };

  const handleLogout = () => {
    setUserId(undefined);
    post("/api/logout");
    googleLogout();
    navigate("/");
  };

  return (
    <ThemeProvider>
      <SoundProvider>
        <div>
          <Navbar userId={userId} handleLogin={handleLogin} handleLogout={handleLogout} />
          <Routes>
            <Route path="/" element={<Home userId={userId} handleLogin={handleLogin} />} />
            <Route path="/games" element={<GameSelect />} />
            <Route path="/tictactoe/setup" element={<TicTacToeSetup />} />
            <Route path="/tictactoe/game" element={<TicTacToe />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </SoundProvider>
    </ThemeProvider>
  );
};

export default App;
