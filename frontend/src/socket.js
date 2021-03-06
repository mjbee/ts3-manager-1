import io from "socket.io-client";
import Vue from "vue";
import store from "./store";
import router from "./router";

// Socket connection to the backend
const socket = io(process.env.VUE_APP_WEBSOCKET_URI, {
  autoConnect: false
});

// When a connection error occurs logout and redirect to login page
const handleSocketError = err => {
  Vue.prototype.$toast.error(err.message);

  // Do not clear token to make reconnection possible
  store.commit("isConnected", false);

  router.push({name: "login"});
};

socket.on("error", handleSocketError);
socket.on("connect_error", handleSocketError);

// Try to reconnect when the frontend is still logged in. 
socket.on("connect", () => {
  if(!store.state.query.loggedOut) {
    socket.emit("teamspeak-reconnect", {
      token: store.state.query.token,
      serverId: store.state.query.serverId
    })
  }
})

export default socket;
