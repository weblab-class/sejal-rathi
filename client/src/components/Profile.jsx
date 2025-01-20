import React, { useState, useEffect } from "react";
import { useTheme } from "./context/ThemeContext";
import { get } from "../utilities";
import "./Profile.css";

const calculateWinRate = (gamesWon, gamesPlayed) => {
  if (gamesPlayed === 0) {
    return 0;
  }
  return Math.round((gamesWon / gamesPlayed) * 100);
};

const Profile = () => {
  const { isDarkMode } = useTheme();
  const [userStats, setUserStats] = useState({
    tictactoe: {
      gamesPlayed: 0,
      gamesWon: 0,
      winStreak: 0,
      currentWinStreak: 0,
    },
    connections: {
      gamesPlayed: 0,
      gamesWon: 0,
      streak: 0,
      longestStreak: 0,
      averageAttempts: 0,
    },
  });
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const checkLoginAndFetchStats = async () => {
      try {
        // First check if user is logged in
        const userInfo = await get("/api/whoami");
        console.log("User info from whoami:", userInfo);

        // Check if userInfo has any properties (empty object means not logged in)
        const loggedIn = userInfo.name && userInfo.name !== "Guest";
        console.log("Is logged in?", loggedIn);
        setIsLoggedIn(loggedIn);

        if (!loggedIn) {
          return; // Exit early if not logged in
        }

        // Only try to fetch stats if logged in
        const data = await get("/api/user/stats");
        console.log("Received stats data:", data);

        if (data.stats) {
          setUserStats({
            tictactoe: {
              gamesPlayed: data.stats.tictactoe.gamesPlayed || 0,
              gamesWon: data.stats.tictactoe.gamesWon || 0,
              winStreak: data.stats.tictactoe.winStreak || 0,
              currentWinStreak: data.stats.tictactoe.currentWinStreak || 0,
            },
            connections: {
              gamesPlayed: data.stats.connections.gamesPlayed || 0,
              gamesWon: data.stats.connections.gamesWon || 0,
              streak: data.stats.connections.streak || 0,
              longestStreak: data.stats.connections.longestStreak || 0,
              averageAttempts: data.stats.connections.averageAttempts || 0,
            },
          });
        }
      } catch (error) {
        console.error("Error:", error);
        setIsLoggedIn(false);
      }
    };

    checkLoginAndFetchStats();
  }, []);

  if (isLoggedIn) {
    return (
      <div className={`profile-container ${isDarkMode ? "dark" : "light"}`}>
        <h1>Profile</h1>
        <div className="profile-content">
          <div className="profile-box">
            <div className="stat-item">
              <div className="stat-info">
                <h2>Your Statistics</h2>
                <div className="stats-section">
                  <h3>Tic Tac Toe</h3>
                  <p>Games Played: {userStats.tictactoe.gamesPlayed}</p>
                  <p>Games Won: {userStats.tictactoe.gamesWon}</p>
                  <p>Win Rate: {calculateWinRate(userStats.tictactoe.gamesWon, userStats.tictactoe.gamesPlayed)}%</p>
                  <p>Current Win Streak: {userStats.tictactoe.currentWinStreak}</p>
                  <p>Longest Win Streak: {userStats.tictactoe.winStreak}</p>
                </div>

                <div className="stats-section">
                  <h3>Connections</h3>
                  <p>Games Played: {userStats.connections.gamesPlayed}</p>
                  <p>Games Won: {userStats.connections.gamesWon}</p>
                  <p>Win Rate: {calculateWinRate(userStats.connections.gamesWon, userStats.connections.gamesPlayed)}%</p>
                  <p>Current Streak: {userStats.connections.streak}</p>
                  <p>Longest Streak: {userStats.connections.longestStreak}</p>
                  <p>Average Attempts: {userStats.connections.averageAttempts.toFixed(1)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  } else {
    return (
      <div className={`profile-container ${isDarkMode ? "dark" : "light"}`}>
        <h1>Profile</h1>
        <div className="profile-content">
          <div className="profile-box">
            <div className="stat-item">
              <div className="stat-info">
                <h2>Please log in to view statistics.</h2>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
};

export default Profile;
