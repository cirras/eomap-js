const path = require("node:path");

const mode = process.env.NODE_ENV || "development";
const dev = mode === "development";

module.exports = {
  mode,
  target: "electron-preload",
  devtool: dev ? "eval-source-map" : "source-map",
  entry: "./src/electron/main/preload.js",
  output: {
    globalObject: "this",
    filename: "preload.js",
    path: path.resolve(__dirname, "../../dist/electron"),
    publicPath: "",
  },
};
