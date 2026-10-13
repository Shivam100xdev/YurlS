const express = require('express');
const session = require('express-session');
const path = require('path');
require('dotenv').config();

const app = express();

// --------------------------------------------------
// Middleware
// --------------------------------------------------

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --------------------------------------------------
// Session
// --------------------------------------------------

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,

    cookie: {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000
    }
  })
);

// --------------------------------------------------
// Static frontend
// --------------------------------------------------

app.use(express.static(path.join(__dirname, '..', 'public')));

// --------------------------------------------------
// Routes
// --------------------------------------------------

const authRouter = require('./routes/auth');
const convertRouter = require('./routes/convert');

app.use('/auth', authRouter);
app.use('/api', convertRouter);

// --------------------------------------------------
// Health check
// --------------------------------------------------

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    server: 'running',
    spotify: !!req.session.spotify
  });
});

// --------------------------------------------------
// Server
// --------------------------------------------------

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(
    `YouTube -> Spotify converter running on http://localhost:${PORT}`
  );
});