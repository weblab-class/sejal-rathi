import React from "react";
import { useTheme } from "./context/ThemeContext";
import "./Profile.css";

const Profile = () => {
  const { isDarkMode } = useTheme();

  return (
    <div className={`profile-container ${isDarkMode ? "dark" : "light"}`}>
      <h1>Profile</h1>
      <div className="profile-content">
        <div className="profile-box">
          <div className="stat-item">
            <div className="stat-info">
              <h3>Games Played</h3>
              <p className="stat-value">42</p>
            </div>
          </div>

          <div className="divider"></div>

          <div className="stat-item">
            <div className="stat-info">
              <h3>Win Rate</h3>
              <p className="stat-value">75%</p>
            </div>
          </div>

          <div className="divider"></div>

          <div className="stat-item">
            <div className="stat-info">
              <h3>Average Time</h3>
              <p className="stat-value">2:30</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
