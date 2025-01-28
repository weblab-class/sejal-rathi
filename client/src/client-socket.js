import socketIOClient from "socket.io-client";
import { post } from "./utilities";

// In production, connect to the same origin
const SOCKET_SERVER = import.meta.env.PROD ? "" : "http://localhost:3000";

let socket = null;
let initializePromise = null;

export const initiateSocket = async () => {
  try {
    // If already initializing, return the existing promise
    if (initializePromise) {
      return initializePromise;
    }

    // If socket exists and is connected, return it
    if (socket?.connected) {
      return socket;
    }

    // Create new initialization promise
    initializePromise = new Promise((resolve, reject) => {
      try {
        socket = socketIOClient(SOCKET_SERVER, {
          withCredentials: true,
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
        });

        socket.on("connect", async () => {
          try {
            await post("/api/initsocket", { socketid: socket.id });
            resolve(socket);
          } catch (err) {
            console.error("Failed to initialize socket:", err);
            socket.disconnect();
            socket = null;
            reject(err);
          }
        });

        socket.on("connect_error", (error) => {
          console.error("Socket connection error:", error);
          reject(error);
        });

        socket.on("disconnect", (reason) => {
          console.log("Socket disconnected:", reason);
          if (reason === "io server disconnect") {
            // Server disconnected us, try to reconnect
            socket.connect();
          }
        });

        socket.on("reconnect", (attemptNumber) => {
          console.log("Socket reconnected after", attemptNumber, "attempts");
        });

        socket.on("reconnect_error", (error) => {
          console.error("Socket reconnection error:", error);
        });
      } catch (error) {
        console.error("Socket setup error:", error);
        reject(error);
      }
    });

    return await initializePromise;
  } catch (error) {
    console.error("Socket initialization error:", error);
    initializePromise = null;
    return null;
  }
};

export const getSocket = () => {
  if (!socket?.connected) {
    // If socket doesn't exist or isn't connected, try to initialize
    initiateSocket().catch((err) => {
      console.error("Failed to get socket:", err);
    });
  }
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  initializePromise = null;
};

// Export the socket instance directly
export { socket };

export default {
  socket,
  initiateSocket,
  getSocket,
  disconnectSocket,
};
