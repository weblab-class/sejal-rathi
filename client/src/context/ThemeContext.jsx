import React, { createContext, useContext, useState, useEffect } from "react";
import { get, post } from "../utilities";

const ThemeContext = createContext({
  isDarkMode: false,
  toggleDarkMode: () => {},
});

export const ThemeProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    // Load theme from server when component mounts
    const loadTheme = async () => {
      try {
        const response = await get("/api/settings");
        if (response.settings && response.settings.darkMode !== undefined) {
          setIsDarkMode(response.settings.darkMode);
          // Apply theme to body
          document.body.classList.toggle("dark", response.settings.darkMode);
        }
      } catch (error) {
        console.log("Error loading theme:", error);
      }
    };
    loadTheme();
  }, []);

  const toggleDarkMode = async () => {
    try {
      const newDarkMode = !isDarkMode;
      setIsDarkMode(newDarkMode);
      document.body.classList.toggle("dark", newDarkMode);
      await post("/api/settings", { darkMode: newDarkMode });
    } catch (error) {
      console.log("Error updating theme:", error);
      // Revert on error
      setIsDarkMode(!newDarkMode);
      document.body.classList.toggle("dark", !newDarkMode);
    }
  };

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleDarkMode }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
