import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { get } from "../utilities";
import "./Profile.css";

const Profile = ({ userId }) => {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!userId) {
      navigate("/");
      return;
    }

    const loadStats = async () => {
      try {
        const userStats = await get("/api/stats");
        setStats(userStats);
        setLoading(false);
      } catch (err) {
        console.error("Failed to load stats:", err);
        setError("Failed to load stats. Please try again later.");
        setLoading(false);
      }
    };

    loadStats();
  }, [userId, navigate]);

  if (loading) {
    return <div className="profile-container">Loading...</div>;
  }

  if (error) {
    return <div className="profile-container error">{error}</div>;
  }

  if (!stats) {
    return <div className="profile-container">No stats available.</div>;
  }

  return (
    <div className="profile-container">
      <h1>Profile</h1>
      
      <div className="stats-section">
        <h2>Tic Tac Toe Stats</h2>
        <div className="stats-grid">
          <div className="stat-card">
            <h3>Games Played</h3>
            <p>{stats.tictactoe?.gamesPlayed || 0}</p>
          </div>
          <div className="stat-card">
            <h3>Games Won</h3>
            <p>{stats.tictactoe?.gamesWon || 0}</p>
          </div>
          <div className="stat-card">
            <h3>Win Rate</h3>
            <p>
              {stats.tictactoe?.gamesPlayed
                ? Math.round((stats.tictactoe.gamesWon / stats.tictactoe.gamesPlayed) * 100)
                : 0}
              %
            </p>
          </div>
        </div>
      </div>

      <div className="stats-section">
        <h2>Math-nections Stats</h2>
        <div className="stats-grid">
          <div className="stat-card">
            <h3>Games Played</h3>
            <p>{stats.connections?.gamesPlayed || 0}</p>
          </div>
          <div className="stat-card">
            <h3>Games Won</h3>
            <p>{stats.connections?.gamesWon || 0}</p>
          </div>
          <div className="stat-card">
            <h3>Win Rate</h3>
            <p>
              {stats.connections?.gamesPlayed
                ? Math.round((stats.connections.gamesWon / stats.connections.gamesPlayed) * 100)
                : 0}
              %
            </p>
          </div>
        </div>
      </div>

      <div className="stats-section">
        <h2>Nerdle Stats</h2>
        <div className="stats-grid">
          <div className="stat-card">
            <h3>Games Played</h3>
            <p>{stats.nerdle?.gamesPlayed || 0}</p>
          </div>
          <div className="stat-card">
            <h3>Games Won</h3>
            <p>{stats.nerdle?.gamesWon || 0}</p>
          </div>
          <div className="stat-card">
            <h3>Win Rate</h3>
            <p>
              {stats.nerdle?.gamesPlayed
                ? Math.round((stats.nerdle.gamesWon / stats.nerdle.gamesPlayed) * 100)
                : 0}
              %
            </p>
          </div>
          <div className="stat-card">
            <h3>Current Streak</h3>
            <p>{stats.nerdle?.streak || 0}</p>
          </div>
          <div className="stat-card">
            <h3>Longest Streak</h3>
            <p>{stats.nerdle?.longestStreak || 0}</p>
          </div>
          <div className="stat-card">
            <h3>Avg. Guesses</h3>
            <p>{stats.nerdle?.averageGuesses?.toFixed(1) || "0.0"}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
