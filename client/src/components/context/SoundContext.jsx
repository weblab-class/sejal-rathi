import React, { createContext, useContext, useState, useEffect } from "react";
import { get, post } from "../../utilities";

const SoundContext = createContext({
  isSoundEnabled: true,
  toggleSound: () => {},
});

export const SoundProvider = ({ children }) => {
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);
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
            setIsSoundEnabled(settings.soundEnabled);
          }
        }
      } catch (error) {
        console.log("Error loading settings:", error);
      }
    };
    loadSettings();
  }, []);

  const toggleSound = async () => {
    const newState = !isSoundEnabled;
    setIsSoundEnabled(newState);
    
    if (isAuthenticated) {
      try {
        await post("/api/settings", { soundEnabled: newState });
      } catch (error) {
        console.log("Error saving sound setting");
      }
    }
  };

  return (
    <SoundContext.Provider value={{ isSoundEnabled, toggleSound }}>
      {children}
    </SoundContext.Provider>
  );
};

export const useSound = () => useContext(SoundContext);
