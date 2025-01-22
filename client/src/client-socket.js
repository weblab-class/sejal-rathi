import socketIOClient from "socket.io-client";
import { post } from "./utilities";

// In production, connect to the same origin
const SOCKET_SERVER = import.meta.env.PROD ? "" : "http://localhost:3000";

let socket = null;

export const initiateSocket = async () => {
  try {
    if (socket) {
      return socket;
    }

    socket = socketIOClient(SOCKET_SERVER, {
      withCredentials: true
    });

    await new Promise((resolve, reject) => {
      socket.on("connect", async () => {
        try {
          await post("/api/initsocket", { socketid: socket.id });
          resolve();
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
    });

    return socket;
  } catch (error) {
    console.error("Socket initialization error:", error);
    return null;
  }
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export const getSocket = () => socket;

// Export the socket instance directly
export { socket };

export default {
  socket,
  initiateSocket,
  disconnectSocket,
  getSocket,
};
