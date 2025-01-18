const mongoose = require("mongoose");

const GameRoomSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
  },
  players: [
    {
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
      name: String,
      isHost: {
        type: Boolean,
        default: false,
      },
    },
  ],
  category: {
    type: String,
    default: "easy",
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 3600, // Document will be deleted after 1 hour
  },
});

// Add index for room code lookups
GameRoomSchema.index({ code: 1 });

// Add index for TTL (time to live)
GameRoomSchema.index({ createdAt: 1 }, { expireAfterSeconds: 3600 });

module.exports = mongoose.model("GameRoom", GameRoomSchema);
