import React from "react";
import { Navigate } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import { useTheme } from "./context/ThemeContext";
import "./Home.css";

const Home = ({ userId, handleLogin }) => {
  const { isDarkMode } = useTheme();

  if (userId) {
    return <Navigate to="/games" replace />;
  }

  return (
    <div className={`home-container ${isDarkMode ? 'dark' : 'light'}`}>
      <div className="content">
        <h1>x factor puzzles</h1>
        <div className="auth-section">
          <GoogleLogin
            onSuccess={handleLogin}
            onError={(err) => console.log(err)}
            size="large"
            text="signin_with"
            useOneTap
            type="standard"
          />
          <button
            className="guest-button"
            onClick={() => handleLogin({ credential: "guest" })}
          >
            Play as Guest
          </button>
        </div>
      </div>
    </div>
  );
};

export default Home;
