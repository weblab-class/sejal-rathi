/*
|--------------------------------------------------------------------------
| server.js -- The core of your server
|--------------------------------------------------------------------------
|
| This file defines how your server starts up. Think of it as the main() of your server.
| At a high level, this file does the following things:
| - Connect to the database
| - Sets up server middleware (i.e. addons that enable things like json parsing, user login)
| - Hooks up all the backend routes specified in api.js
| - Fowards frontend routes that should be handled by the React router
| - Sets up error handling in case something goes wrong when handling a request
| - Actually starts the webserver
*/

// validator runs some basic checks to make sure you've set everything up correctly
// this is a tool provided by staff, so you don't need to worry about it
const validator = require("./validator");
validator.checkSetup();

//allow us to use process.ENV
require("dotenv").config();

//import libraries needed for the webserver to work!
const express = require("express");
const http = require("http");
const path = require("path");
const session = require("express-session");
const mongoose = require("mongoose");
const cors = require("cors");
const socketManager = require("./server-socket");

const api = require("./api");
const auth = require("./auth");

// Server configuration
const app = express();
const server = http.createServer(app);

// Allow requests from your deployed frontend domain and localhost during development
app.use(
  cors({
    origin: [
      "https://x-factor-puzzles.onrender.com",
      "http://localhost:5173",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  })
);

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || "session-secret",
  resave: false,
  saveUninitialized: false,
  proxy: true,
  cookie: {
    sameSite: process.env.NODE_ENV === "production" ? 'none' : 'lax',
    secure: process.env.NODE_ENV === "production",
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
});

// Trust first proxy
app.set('trust proxy', 1);

// Use session middleware
app.use(sessionMiddleware);

// Populate user
app.use(auth.populateCurrentUser);

// API routes
app.use("/api", api);
app.use("/auth", auth.router);

// Initialize socket with session support
socketManager.init(server, sessionMiddleware);

// Serve static files
const reactPath = path.resolve(__dirname, "..", "client", "dist");
app.use(express.static(reactPath));

// Handle React routing
app.get("*", (req, res) => {
  res.sendFile(path.join(reactPath, "index.html"));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Server error:", err);
  res.status(500).json({
    error: "Internal Server Error",
    message: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

// MongoDB connection
mongoose
  .connect(process.env.MONGO_SRV, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    dbName: "Cluster0",
  })
  .then(() => {
    console.log("Connected to MongoDB");
    const port = process.env.PORT || 3000;
    server.listen(port, () => {
      console.log(`Server running on port: ${port}`);
    });
  })
  .catch((err) => {
    console.error("Error connecting to MongoDB:", err);
    process.exit(1);
  });

// any server errors cause this function to run
app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status === 500) {
    // 500 means Internal Server Error
    console.log("The server errored when processing a request!");
    console.log(err);
  }

  res.status(status);
  res.send({
    status: status,
    message: err.message,
  });
});
