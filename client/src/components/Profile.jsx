import React, { useState, useEffect } from "react";
import { useTheme } from "./context/ThemeContext";
import { get } from "../utilities";
import "./Profile.css";

const Profile = () => {
  const { isDarkMode } = useTheme();
  const [userStats, setUserStats] = useState({
    gamesPlayed: 0,
    winRate: 0,
    winStreak: 0,
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

        if (data.stats && data.stats.tictactoe) {
          const stats = data.stats.tictactoe;
          console.log("TicTacToe stats:", stats);
          const totalGames = stats.gamesPlayed;
          const winRate = totalGames > 0 ? Math.round((stats.gamesWon / totalGames) * 100) : 0;

          setUserStats({
            gamesPlayed: totalGames,
            winRate: winRate,
            winStreak: stats.winStreak,
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
                <h3>Games Played</h3>
                <p className="stat-value">{userStats.gamesPlayed}</p>
              </div>
            </div>

            <div className="divider"></div>

            <div className="stat-item">
              <div className="stat-info">
                <h3>Win Rate</h3>
                <p className="stat-value">{userStats.winRate}%</p>
              </div>
            </div>

            <div className="divider"></div>

            <div className="stat-item">
              <div className="stat-info">
                <h3>Best Win Streak</h3>
                <p className="stat-value">{userStats.winStreak}</p>
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
