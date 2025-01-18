import React, { createContext, useContext, useState, useEffect } from "react";
import { get, post } from "../utilities";

const SoundContext = createContext({
  soundEnabled: true,
  toggleSound: () => {},
});

export const SoundProvider = ({ children }) => {
  const [soundEnabled, setSoundEnabled] = useState(true);

  useEffect(() => {
    // Load settings from server when component mounts
    const loadSettings = async () => {
      try {
        const settings = await get("/api/settings");
        if (settings && settings.soundEnabled !== undefined) {
          setSoundEnabled(settings.soundEnabled);
        }
      } catch (error) {
        console.log("Error loading sound settings:", error);
      }
    };
    loadSettings();
  }, []);

  const toggleSound = async () => {
    try {
      const newSoundEnabled = !soundEnabled;
      setSoundEnabled(newSoundEnabled);
      await post("/api/settings", { soundEnabled: newSoundEnabled });
    } catch (error) {
      console.log("Error updating sound settings:", error);
      // Revert the state if the server update fails
      setSoundEnabled(!newSoundEnabled);
    }
  };

  return (
    <SoundContext.Provider value={{ soundEnabled, toggleSound }}>
      {children}
    </SoundContext.Provider>
  );
};

export const useSound = () => useContext(SoundContext);
