const path = require("node:path");

const mode = process.env.NODE_ENV || "development";
const dev = mode === "development";

module.exports = {
  mode,
  target: "electron-main",
  devtool: dev ? "eval-source-map" : "source-map",
  entry: "./src/electron/main/index.js",
  output: {
    globalObject: "this",
    filename: "main.js",
    path: path.resolve(__dirname, "../../dist/electron"),
    publicPath: "",
  },
};
