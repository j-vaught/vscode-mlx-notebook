# Changelog

All notable changes to the vscode-mlx-notebook extension are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.9.0] - Upcoming

### Added
- Split suspension script into granular notebook cells for improved modularity
- Auto-change directory to notebook location on execution
- Extract and manage helper functions within notebooks

### Fixed
- Remove duplicate image outputs causing double-rendered figures
- Fix cached output loading and improve UI/UX responsiveness
- Wait for path initialization before accepting commands

## [0.3.x] - Incremental Fixes

### Fixed
- Rewrite CLI backend to use persistent MATLAB process for better session management
- Filter MATLAB startup warnings from cell output
- Fix MATLAB auto-detect to search mounted volumes correctly
- Fix empty CDATA parsing in MLX files
- Add round-trip tests to ensure file format integrity

### Added
- Add MATLAB R2025a fixtures
- Expand round-trip tests to cover 70 test cases
- Add .m to .mlx converter tool
- Add full car suspension simulation test fixtures
- Support for 7-DOF full car suspension simulation

## [0.2.0] - 2024

### Added
- Major rewrite: Convert read-only viewer to full editor with MATLAB execution
- Full cell execution capability with persistent MATLAB backend
- Notebook controller registration
- Custom output renderer with styled tables and cached output badge
- Support for executing cells and saving results

### Fixed
- Fix parsing against real .mlx files
- Add no-op notebook controller to suppress kernel picker prompt

## [0.1.0] - Initial Release

### Added
- Initial implementation of MLX notebook viewer
- Read-only support for MATLAB Live Script (.mlx) files
- Custom output rendering for MATLAB outputs
- Registration of read-only notebook controller
