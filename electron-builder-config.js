module.exports = {
  appId: "dev.eomap.app",
  directories: {
    output: "dist/electron",
  },
  files: ["dist/electron/**/*"],
  fileAssociations: [
    {
      ext: "emf",
      name: "Endless Map File",
      description: "Endless Map File",
    },
  ],
  publish: [
    {
      provider: "github",
      owner: "cirras",
      repo: "eomap-js",
      releaseType: "release",
    },
  ],
  snap: {
    base: "core22",
    publish: {
      provider: "snapStore",
      repo: "eomap-js",
      channels: ["stable"],
    },
  },
  win: {
    executableName: "eomap-js",
  },
  mac: {
    category: "public.app-category.developer-tools",
    hardenedRuntime: true,
  },
  nsis: {
    oneClick: false,
    shortcutName: "Endless Map Editor",
    uninstallDisplayName: "Endless Map Editor",
  },
};
