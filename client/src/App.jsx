import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Nerdle from "./components/Nerdle";
import TicTacToe from "./components/TicTacToe";
import TicTacToeSetup from "./components/TicTacToeSetup";
import TicTacToeWaitingRoom from "./components/TicTacToeWaitingRoom";

const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<TicTacToeSetup />} />
        <Route path="/nerdle" element={<Nerdle />} />
        <Route path="/tictactoe/setup" element={<TicTacToeSetup />} />
        <Route path="/tictactoe/waiting/:gameCode" element={<TicTacToeWaitingRoom />} />
        <Route path="/tictactoe/game/:gameCode" element={<TicTacToe />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
