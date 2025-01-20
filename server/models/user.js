const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  name: String,
  googleid: String,
  settings: {
    darkMode: { type: Boolean, default: false },
    soundEnabled: { type: Boolean, default: true },
  },
  stats: {
    tictactoe: {
      gamesPlayed: { type: Number, default: 0 },
      gamesWon: { type: Number, default: 0 },
      gamesLost: { type: Number, default: 0 },
      gamesTied: { type: Number, default: 0 },
      winStreak: { type: Number, default: 0 },
      currentWinStreak: { type: Number, default: 0 },
    },
    connections: {
      gamesPlayed: { type: Number, default: 0 },
      gamesWon: { type: Number, default: 0 },
      streak: { type: Number, default: 0 },
      longestStreak: { type: Number, default: 0 },
      averageAttempts: { type: Number, default: 0 },
    },
  },
});

// compile model from schema
module.exports = mongoose.model("user", UserSchema);
