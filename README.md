# MATLAB Live Script Editor

A Visual Studio Code extension for editing, executing, and saving MATLAB Live Script (.mlx) files as native VS Code notebooks.

## Features

- **Native Notebook Experience**: Opens .mlx files as VS Code notebooks with seamless code and markdown cell editing
- **Full Round-Trip Editing**: Edit cells in VS Code and save back to valid .mlx files that MATLAB can still open
- **Persistent MATLAB Execution**: Run MATLAB code cells with a persistent session (CLI backend or Python engine)
- **Cached Output Display**: View figures, text, and variable outputs from .mlx files immediately on open
- **Live Execution Outputs**: Capture figures as PNG, text output, and variable displays during execution
- **Custom Styled Renderer**: Professional output styling with variable tables, matrix displays, and figure zoom-on-click
- **Output Status Indicators**: Status bar badges show whether outputs are "Live" (just executed) or "Cached" (from file)
- **Cross-Platform MATLAB Detection**: Auto-detects MATLAB installations on macOS, Linux, and Windows
- **Modern Format Support**: Compatible with MATLAB R2025a+ Live Script format

## Installation

1. Install the extension from the VS Code Marketplace or build from source
2. Ensure MATLAB is installed on your system (optional for viewing/editing, required for execution)
3. Open any `.mlx` file in VS Code

The extension will automatically register as the default editor for `.mlx` files.

## Getting Started

### Opening a Live Script

1. Open a `.mlx` file in VS Code (File > Open or drag-and-drop)
2. The file opens as a notebook with code and markdown cells
3. Cached outputs from the original .mlx file display automatically

### Running Code Cells

1. Click the play button next to a code cell, or press `Ctrl+Enter` (Windows/Linux) / `Cmd+Enter` (macOS)
2. The extension launches a persistent MATLAB session on first execution
3. Live outputs (figures, text, variables) appear below the cell
4. Status bar shows "Live" badge for freshly executed outputs
5. Save the notebook (`Ctrl+S` / `Cmd+S`) to write changes back to the .mlx file

### Editing Cells

- **Code Cells**: Edit MATLAB code directly in the cell editor
- **Markdown Cells**: Write formatted text, headings, and lists
- **Add Cells**: Use the `+Code` or `+Markdown` buttons in the notebook toolbar
- **Reorder Cells**: Drag cells up/down using the cell handles

## Configuration

Configure the extension via VS Code settings (`Preferences > Settings` or `settings.json`):

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `mlx-notebook.executionBackend` | string | `"cli"` | MATLAB execution backend: `"cli"` (MATLAB command-line) or `"python-engine"` (MATLAB Engine for Python) |
| `mlx-notebook.matlabPath` | string | `""` | Custom path to MATLAB executable. Leave empty for auto-detection. |

### Example Configuration

```json
{
  "mlx-notebook.executionBackend": "cli",
  "mlx-notebook.matlabPath": "/Applications/MATLAB_R2025a.app/bin/matlab"
}
```

## Requirements

- **VS Code**: Version 1.75 or higher
- **MATLAB**: Any recent version (R2025a+ recommended for full format compatibility)
  - Required for code execution
  - Not required for viewing or editing .mlx files
- **Python** (optional): Required only if using `"python-engine"` execution backend
  - Install MATLAB Engine for Python: [MathWorks Documentation](https://www.mathworks.com/help/matlab/matlab_external/install-the-matlab-engine-for-python.html)

## Supported Formats

- MATLAB Live Script (.mlx) files from MATLAB R2025a and later
- Round-trip editing preserves:
  - Code and markdown cells
  - Cell execution order
  - Cached outputs (figures, text, variables)
  - Live Script metadata

## Known Limitations

- **LaTeX Rendering**: Inline LaTeX equations in markdown cells are not rendered; they display as raw code
- **No Debugger Integration**: MATLAB debugger breakpoints and step-through debugging are not supported
- **Static Figure Captures**: Figures are captured as static PNG images; interactive MATLAB figure tools are not available
- **Limited Output Types**: Complex output types (apps, animations, interactive plots) may not display correctly
- **Python Engine Limitations**: The `python-engine` backend requires additional setup and may have performance overhead
- **Workspace Persistence**: MATLAB workspace variables persist across cell executions but are lost when VS Code restarts

## License

MIT License

Copyright (c) 2026 J.C. Vaught

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

---

**Repository**: https://github.com/j-vaught/vscode-mlx-notebook

**Author**: J.C. Vaught

**Email**: jvaught@sc.edu
