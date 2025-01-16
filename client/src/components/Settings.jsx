import React from "react";
import { useTheme } from "./context/ThemeContext";
import { useSound } from "./context/SoundContext";
import "./Settings.css";

const Settings = () => {
  const { isDarkMode, toggleTheme } = useTheme();
  const { isSoundEnabled, toggleSound } = useSound();

  return (
    <div className={`settings-container ${isDarkMode ? "dark" : "light"}`}>
      <h1>Settings</h1>
      <div className="settings-content">
        <div className="settings-box">
          <div className="setting-item">
            <div className="setting-info">
              <h3>Dark Mode</h3>
              <p>Switch between light and dark themes</p>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={isDarkMode}
                onChange={toggleTheme}
              />
              <span className="slider round"></span>
            </label>
          </div>

          <div className="divider"></div>

          <div className="setting-item">
            <div className="setting-info">
              <h3>Sound Effects</h3>
              <p>Toggle game sounds and effects</p>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={isSoundEnabled}
                onChange={toggleSound}
              />
              <span className="slider round"></span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
