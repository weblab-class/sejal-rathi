import React, { createContext, useContext, useState, useEffect } from "react";
import { get, post } from "../../utilities";

const ThemeContext = createContext({
  isDarkMode: false,
  toggleTheme: () => {},
});

export const ThemeProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Load settings from server on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const { user } = await get("/api/whoami");
        setIsAuthenticated(Boolean(user?._id));
        
        if (user?._id) {
          const { settings } = await get("/api/settings");
          if (settings) {
            setIsDarkMode(settings.darkMode);
          }
        }
      } catch (error) {
        console.log("Error loading settings:", error);
      }
    };
    loadSettings();
  }, []);

  const toggleTheme = async () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    
    if (isAuthenticated) {
      try {
        await post("/api/settings", { darkMode: newMode });
      } catch (error) {
        console.log("Error saving theme setting");
      }
    }
  };

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
