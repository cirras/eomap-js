# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- Font rendering issues in system dialogs when running as a snap package.

## [1.3.0] - 2025-07-27

### Changed

- Application window's minimum size is now 400x270.
- Better placement of unusually-sized animated walls in the palette.
- Warp keys are now optional in the entity editor.
- Warp keys now have a minimum value of 2 in the entity editor. Key 1 is unrepresentable in EMF
  files due to the way door data is encoded.

### Fixed

- Move and Zoom tools didn't work with touch input.
- `Open`, `Save`, and `Save As` keyboard shortcuts no longer trigger the default browser behavior
  when the actions are disabled.
- Warp keys were incorrectly offset by 1 in the entity editor.

## [1.2.1] - 2024-01-15

### Fixed

- Copy-pasted NPC and item spawns had incorrect map coordinates.

## [1.2.0] - 2024-01-11

### Added

- Entity tool context menu with `Copy`/`Paste`/`Clear` actions.

## [1.1.2] - 2023-11-08

### Added

- Detection of unsupported 0.4.x EMFs.

## [1.1.1] - 2023-06-30

### Fixed

- Fix bug where fill tool would use the wrong map graphic.

## [1.1.0] - 2023-06-29

### Added

- `Grid Lines` layer. (Thanks [@ethanmoffat](https://github.com/ethanmoffat))
- Shift+Click to draw straight lines.

## [1.0.9] - 2023-01-15

### Fixed

- Fix issue where numbers on EO integer size boundaries would not be encoded properly.
- Fix bug where maps containing legacy "door key" entities could be opened, but not saved.

## [1.0.8] - 2022-11-07

### Changed

- Accurate detection of animated tiles. (>250 width)
- Accurate detection of animated walls. (>120 width)

## [1.0.7] - 2022-10-29

### Changed

- Draw operations can no longer begin outside of the editor viewport.
- Graceful handling for cases where pointer capture is lost while using a tool.
- Graceful handling for cases where pointer capture is lost while resizing the palette.

### Fixed

- Fix bug where menu items would be disabled unexpectedly if the window was maximized, minimized, and then restored.
- Fix bug where the wrong pointer button could trigger a tool in specific situations where multiple buttons were held down.
- Fix pointer capture errors that could occur when moving the `Move` and `Zoom` tools within the editor viewport.

## [1.0.6] - 2022-10-28

### Added

- Shortcut keys to switch between tools.
- Support for obscure OS/2 `BITMAPCOREHEADER2` bitmaps.
- Support for bitmaps with `BI_RLE24` compression.
- Support for bitmaps with `BI_HUFFMAN1D` compression.
- Support for bitmaps with undefined color channels.

### Changed

- Bitmaps with palatte indices that are not present in the palette will now display those pixels as black.
- `Move` and `Zoom` tools now continue to work when the mouse leaves the editor viewport.

### Fixed

- Fix issue where the `Space`+`Click` shortcut for the Hand tool would misbehave if a button or input had focus.
- Remove ugly focus ring that would appear if a key was pressed while the palette had focus.

## [1.0.5] - 2022-10-22

### Added

- Support for bitmaps with `BI_RLE4` compression.
- Support for bitmaps with `BI_RLE8` compression.
- Support for bitmaps with `BI_ALPHABITFIELDS` compression.
- Support for bitmaps with unusually-sized bitfield masks.
- Support for bitmaps with non-paletted pixel data and superfluous color tables.

## [1.0.4] - 2022-10-15

### Fixed

- Fix issue where unusually-large Top tiles were drawn at the incorrect position.

## [1.0.3] - 2022-09-19

### Added

- Support for obscure Windows 2.x `BITMAPCOREHEADER` bitmaps.
- Support for 1-bit, 2-bit, and 4-bit bitmaps.

### Changed

- More robust validation in the bitmap decoder.

### Fixed

- Fix issue where Down Walls were rendered below Overlays on the same tile.
- Fix issue where `BITMAPINFOHEADER` dimensions were erroneously read as unsigned integers.

## [1.0.2] - 2022-08-25

### Added

- Support for jumbo-sized (larger than 1024x1024) resources.

### Fixed

- Exit menu item. (Windows)
- Prevent the texture cache from breaking when an asset can't fit into an empty cache page.
- Prevent an error triggered by creating a new map while GFX is loading.

## [1.0.1] - 2022-08-21

### Added

- Menu item to clear recent files.
- Menu item to show release notes.
- Menu item to close window. (Linux)
- Menu item to quit application. (Linux)

### Fixed

- Allow menu items to be triggered by repeating keyboard events.
- Prevent cursor flickering when resizing the palette.

## [1.0.0] - 2022-08-08

### Added

- Desktop app for Windows, Linux, and macOS.
- Web app available at [https://eomap.dev](https://eomap.dev)

[Unreleased]: https://github.com/cirras/eomap-js/compare/v1.3.0...HEAD
[1.3.0]: https://github.com/cirras/eomap-js/compare/v1.2.1...v1.3.0
[1.2.1]: https://github.com/cirras/eomap-js/compare/v1.2.0...v1.2.1
[1.2.0]: https://github.com/cirras/eomap-js/compare/v1.1.2...v1.2.0
[1.1.2]: https://github.com/cirras/eomap-js/compare/v1.1.1...v1.1.2
[1.1.1]: https://github.com/cirras/eomap-js/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/cirras/eomap-js/compare/v1.0.9...v1.1.0
[1.0.9]: https://github.com/cirras/eomap-js/compare/v1.0.8...v1.0.9
[1.0.8]: https://github.com/cirras/eomap-js/compare/v1.0.7...v1.0.8
[1.0.7]: https://github.com/cirras/eomap-js/compare/v1.0.6...v1.0.7
[1.0.6]: https://github.com/cirras/eomap-js/compare/v1.0.5...v1.0.6
[1.0.5]: https://github.com/cirras/eomap-js/compare/v1.0.4...v1.0.5
[1.0.4]: https://github.com/cirras/eomap-js/compare/v1.0.3...v1.0.4
[1.0.3]: https://github.com/cirras/eomap-js/compare/v1.0.2...v1.0.3
[1.0.2]: https://github.com/cirras/eomap-js/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/cirras/eomap-js/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/cirras/eomap-js/releases/tag/v1.0.0
