import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { GoogleOAuthProvider } from "@react-oauth/google";

import App from "./components/App";
import Home from "./components/Home";
import GameSelect from "./components/GameSelect";
import TicTacToe from "./components/TicTacToe";
import TicTacToeSetup from "./components/TicTacToeSetup";
import Settings from "./components/Settings";
import Profile from "./components/Profile";

//TODO: REPLACE WITH YOUR OWN CLIENT_ID
const GOOGLE_CLIENT_ID = "554886635237-ndfve0iffn39ld731eu1tf3fhgg8es02.apps.googleusercontent.com";

const router = (
  <BrowserRouter>
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <Routes>
        <Route path="/" element={<App />}>
          <Route index element={<Home />} />
          <Route path="games" element={<GameSelect />} />
          <Route path="tictactoe">
            <Route index element={<TicTacToeSetup />} />
            <Route path="play" element={<TicTacToe />} />
          </Route>
          <Route path="settings" element={<Settings />} />
          <Route path="profile" element={<Profile />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </GoogleOAuthProvider>
  </BrowserRouter>
);

const root = createRoot(document.getElementById("root"));
root.render(router);
