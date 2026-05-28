const express = require("express");
const path = require("path");
const generateRoute = require("./routes/generate");

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(express.static(path.join(__dirname, "..", "..", "public")));
  app.use("/api/generate", generateRoute);
  return app;
}

module.exports = { createApp };
