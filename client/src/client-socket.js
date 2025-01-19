import socketIOClient from "socket.io-client";
import { get, post } from "./utilities";

const SOCKET_SERVER = "http://localhost:3000";

let socket = null;

export const initiateSocket = async () => {
  try {
    // Don't create a new socket if one already exists
    if (socket) {
      console.log("Socket already exists:", socket.id);
      return socket;
    }

    console.log("Creating new socket connection...");
    socket = socketIOClient(SOCKET_SERVER, {
      withCredentials: true,
      transports: ["websocket", "polling"],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socket.on("connect", () => {
      console.log("Socket connected with ID:", socket.id);
      post("/api/initsocket", { socketid: socket.id })
        .then(() => {
          console.log("Socket initialized successfully with server");
        })
        .catch((err) => {
          console.error("Failed to initialize socket:", err);
          socket.disconnect();
          socket = null;
        });
    });

    socket.on("connect_error", (error) => {
      console.error("Socket connection error:", error);
    });

    socket.on("disconnect", (reason) => {
      console.log("Socket disconnected. Reason:", reason);
    });

    // Add debug listeners for all events
    socket.onAny((eventName, ...args) => {
      console.log(`Socket Event '${eventName}' received:`, args);
    });

    return socket;
  } catch (error) {
    console.error("Error initializing socket:", error);
    return null;
  }
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export { socket };
export const getSocket = () => socket;

export default {
  initiateSocket,
  disconnectSocket,
  getSocket,
  socket,
};
