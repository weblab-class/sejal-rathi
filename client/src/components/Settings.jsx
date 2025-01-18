import React, { useState, useEffect } from "react";
import { get, post } from "../utilities";
import "./Settings.css";

const Settings = ({ userId }) => {
  const [settings, setSettings] = useState({
    darkMode: false,
    soundEnabled: true,
  });

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await get("/api/settings");
        if (response.settings) {
          setSettings(response.settings);
        }
      } catch (error) {
        console.log("Error loading settings:", error);
      }
    };
    
    if (userId) {
      loadSettings();
    }
  }, [userId]);

  const updateSetting = async (key, value) => {
    try {
      const newSettings = {
        ...settings,
        [key]: value,
      };
      setSettings(newSettings);
      const response = await post("/api/settings", { [key]: value });
      if (!response.settings) {
        setSettings(settings);
      }
    } catch (error) {
      console.log(`Error updating ${key}:`, error);
      setSettings(settings);
    }
  };

  if (!userId) {
    return <div>Please log in to view settings</div>;
  }

  return (
    <div className={`settings-container ${settings.darkMode ? "dark" : "light"}`}>
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
                checked={settings.darkMode}
                onChange={(e) => updateSetting("darkMode", e.target.checked)}
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
                checked={settings.soundEnabled}
                onChange={(e) => updateSetting("soundEnabled", e.target.checked)}
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
