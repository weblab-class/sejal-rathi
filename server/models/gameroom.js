const mongoose = require("mongoose");

const GameRoomSchema = new mongoose.Schema({
  gameCode: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  code: {
    type: String,
    sparse: true, // Allow null values and only index non-null values
  },
  category: {
    type: String,
    required: true,
    default: "easy",
  },
  players: [{
    userId: String,
    name: String,
    symbol: String,
    isHost: Boolean,
  }],
  questions: [{
    question: String,
    answer: String,
  }],
  board: [{
    value: String,
    answer: String,
    solved: {
      type: Boolean,
      default: false
    },
    player: String,
  }],
  gameStarted: {
    type: Boolean,
    default: false,
  },
  currentPlayer: {
    type: String,
    default: "X",
  },
  winner: String,
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 3600, // Room expires after 1 hour
  },
});

// Drop old indexes if they exist
GameRoomSchema.pre('save', async function(next) {
  if (this.isNew) {
    try {
      await mongoose.connection.db.collection('gamerooms').dropIndex('code_1');
    } catch (err) {
      // Ignore error if index doesn't exist
      if (err.code !== 27) {
        console.error("Error dropping old index:", err);
      }
    }
  }
  next();
});

// Add new indexes
GameRoomSchema.index({ gameCode: 1 }, { unique: true });
GameRoomSchema.index({ createdAt: 1 }, { expireAfterSeconds: 3600 });

// Add static method to generate unique game code
GameRoomSchema.statics.generateGameCode = async function() {
  let attempts = 0;
  const maxAttempts = 10;
  
  while (attempts < maxAttempts) {
    const gameCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const existingRoom = await this.findOne({ gameCode });
    
    if (!existingRoom) {
      return gameCode;
    }
    
    attempts++;
  }
  
  throw new Error("Could not generate unique game code");
};

module.exports = mongoose.model("gameroom", GameRoomSchema);
