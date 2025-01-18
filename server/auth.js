const { OAuth2Client } = require("google-auth-library");
const express = require("express");
const User = require("./models/user");
const socketManager = require("./server-socket");

// create a new OAuth client used to verify google sign-in
const CLIENT_ID = "554886635237-ndfve0iffn39ld731eu1tf3fhgg8es02.apps.googleusercontent.com";
const client = new OAuth2Client(CLIENT_ID);

// Create router
const router = express.Router();

// accepts a login token from the frontend, and verifies that it's legit
function verify(token) {
  return client
    .verifyIdToken({
      idToken: token,
      audience: CLIENT_ID,
    })
    .then((ticket) => ticket.getPayload());
}

// gets user from DB, or makes a new account if it doesn't exist yet
function getOrCreateUser(user) {
  // the "sub" field means "subject", which is a unique identifier for each user
  return User.findOne({ googleid: user.sub }).then((existingUser) => {
    if (existingUser) return existingUser;

    const newUser = new User({
      name: user.name,
      googleid: user.sub,
      email: user.email,
    });

    return newUser.save();
  });
}

function login(req, res) {
  verify(req.body.token)
    .then((user) => getOrCreateUser(user))
    .then((user) => {
      // persist user in the session
      req.session.user = user;
      res.send(user);
    })
    .catch((err) => {
      console.log(`Failed to log in: ${err}`);
      res.status(401).send({ err });
    });
}

function logout(req, res) {
  const userSocket = socketManager.getSocketFromUserID(req.session.user?._id);
  if (userSocket) {
    // delete user's socket if they logged out
    socketManager.removeUser(req.session.user, userSocket);
  }

  req.session.user = null;
  res.send({});
}

function populateCurrentUser(req, res, next) {
  // simply populate "req.user" for convenience
  req.user = req.session.user;
  next();
}

function ensureLoggedIn(req, res, next) {
  if (!req.user) {
    return res.status(401).send({ error: "Not logged in" });
  }
  next();
}

// Auth routes
router.post("/login", login);
router.post("/logout", logout);
router.get("/whoami", (req, res) => {
  if (!req.user) {
    // not logged in
    return res.send({});
  }
  res.send(req.user);
});

module.exports = {
  login,
  logout,
  populateCurrentUser,
  ensureLoggedIn,
  router,
};
