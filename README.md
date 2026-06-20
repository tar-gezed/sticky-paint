# 🎨 StickyPaint

StickyPaint is a feature-rich, retro-futuristic PWA drawing and image-editing web application. It seamlessly merges the classic, nostalgic aesthetic of MS Paint with modern, object-oriented canvas manipulation, layered editing, and fluid UI experiences.

Built with **Angular 21**, **Fabric.js v7**, **Tailwind CSS v4**, and **Angular CDK**, StickyPaint runs entirely in the browser, works offline, and automatically persists your workspace.

👉 **Live Demo:** [https://tar-gezed.github.io/sticky-paint/](https://tar-gezed.github.io/sticky-paint/)  
👉 **GitHub Repository:** [https://github.com/tar-gezed/sticky-paint](https://github.com/tar-gezed/sticky-paint)

---

## ✨ Key Features

### 🖌️ Advanced Drawing Tools
*   **Pencil/Brush Tool:** Freehand drawing with adjustable stroke width and color.
*   **Custom Cursors:** Contextual, pixel-accurate cursors (Pencil, Eraser, Crosshair, and Text caret) to mimic classic editor feel.
*   **Eraser Tool:** Intuitively clear pixels using the dynamic canvas background color.

### 🔳 Dynamic Shapes Engine
Draw shapes with customizable stroke colors, fill colors (including transparency), and stroke thicknesses. Supported shapes:
*   Lines & Directional Arrows
*   Rectangles & Rounded Rectangles
*   Ellipses & Circles
*   Triangles & Right-angled Triangles
*   Diamonds, Pentagons, and Hexagons
*   5-Point Stars & Hearts

### 📑 Layer Manager (Angular CDK)
*   **Layer Reordering:** Drag-and-drop layers to reorder their depth (z-index) seamlessly using `@angular/cdk/drag-drop`.
*   **Real-time Previews:** High-performance, dynamically-generated thumbnail previews of individual layers.
*   **Visibility & Deletion:** Quick-toggle layer visibility or delete layers individually.
*   **Active Object Highlighting:** Highlights active selection layers automatically in the manager.

### 📝 Text Manipulation
*   Place multi-line Textbox layers directly on the canvas.
*   Double-click to edit text inline with rich caret support.
*   Adjust typography dynamically with font-family options (e.g., Outfit, Plus Jakarta Sans, Inter, Monospace) and font-size selectors directly on the ribbon.

### 💾 File Operations & Clipboard
*   **Local Clipboard:** Dedicated local clipboard supporting `Copy`, `Cut`, and `Paste` of canvas objects through JSON serialization.
*   **Drag & Drop:** Drop any local image file (`.png`, `.jpg`, `.svg`, `.webp`) anywhere on the workspace to immediately import it onto your canvas.
*   **Export:** Download your masterpiece as a high-quality `.png` image with a single click.
*   **Persistence:** Auto-saves the canvas structure to `localStorage` to keep your work safe across page reloads.

### 📺 Retro-Futuristic Customizations
*   **CRT Monitor Filter:** Toggle a retro scanline CRT overlay with a subtle flicker effect for nostalgic, old-school CRT screens.
*   **Canvas Grid:** Enable a pixel-accurate grid overlay that scales dynamically with your zoom level.
*   **Workspace Zooming:** Smooth zoom control (from `12.5%` up to `800%`) using a slider, zoom buttons, or keyboard shortcuts.
*   **Interactive Resize Handles:** Click and drag handles on the bottom, right, or corner to dynamically resize your canvas viewport.

---

## 🛠️ Technology Stack

StickyPaint is designed with cutting-edge web tools to ensure high performance and premium design aesthetics:

*   **Angular 21:** Utilizing standalone components and reactive **Signals** for fine-grained state management.
*   **Fabric.js v7.4.0:** Powering the complex object-oriented canvas drawing, scaling, rotation, selection, and serialization engine.
*   **Tailwind CSS v4.0:** Leveraged for modern layouts, custom animations, glassmorphic filters, and the retro UI color palette.
*   **Angular CDK (Drag & Drop):** Implementing smooth, responsive list transitions inside the layers panel.
*   **Service Worker / PWA:** Provides progressive web app capabilities, including offline mode, prompt updates, and app install support.

---

## ⌨️ Keyboard Shortcuts Cheat Sheet

Maximize your speed with built-in hotkeys:

| Action | Shortcut |
| :--- | :--- |
| **Undo** | `Ctrl + Z` |
| **Redo** | `Ctrl + Y` |
| **Copy Object** | `Ctrl + C` |
| **Cut Object** | `Ctrl + X` |
| **Paste Object** | `Ctrl + V` |
| **Delete Selected** | `Delete` / `Backspace` |
| **Reset Zoom (100%)** | `Ctrl + 0` |
| **Select Tool** | `V` |
| **Brush Tool** | `B` |
| **Eraser Tool** | `E` |
| **Text Tool** | `T` |

---

## 🚀 Getting Started

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) installed (recommended version 18+ or 20+).

### Installation
1.  **Clone the repository:**
    ```bash
    git clone https://github.com/tar-gezed/sticky-paint.git
    cd sticky-paint
    ```

2.  **Install project dependencies:**
    ```bash
    npm install
    ```

3.  **Start the local development server:**
    ```bash
    npm start
    ```
    Once running, open [http://localhost:4200/](http://localhost:4200/) in your browser. The application will reload automatically when any source files are modified.

---

## 📦 Building & Deploying

### Build for Production
To generate optimized production build artifacts:
```bash
npm run build
```
This compiles the application and stores the static files in the `dist/sticky-paint/` directory.

### Deploying to GitHub Pages
StickyPaint includes `angular-cli-ghpages` for automatic deployment.

To deploy the production build to your GitHub Pages URL:
```bash
npx angular-cli-ghpages --dir=dist/sticky-paint/browser
```

---

## 📂 Project Structure

```text
sticky-paint/
├── .github/                  # CI/CD configurations
├── public/                   # Static assets, icons, and manifest.webmanifest
├── src/
│   ├── app/
│   │   ├── components/       # Standalone UI Components
│   │   │   ├── ribbon/       # Main top-bar menu, tools, and actions
│   │   │   ├── sidebar/      # Layers manager with cdk-drag-drop
│   │   │   ├── status-bar/   # Bottom info bar with zoom controls
│   │   │   └── workspace/    # Fabric.js Canvas viewport & resize handles
│   │   ├── services/         # State Services
│   │   │   └── paint.ts      # Core canvas state, history, and action logic
│   │   ├── app.ts            # Root application component
│   │   ├── app.html          # Global page layout & help modal dialog
│   │   └── app.config.ts     # PWA Service Worker & global configurations
│   ├── main.ts               # Application bootstrapping entrypoint
│   └── styles.css            # Tailwind CSS v4 entrypoint
├── angular.json              # Angular CLI project configuration
├── package.json              # Project dependencies and script shortcuts
└── tsconfig.json             # TypeScript compiler settings
```

---

## 📄 License

This project is licensed under the MIT License. Feel free to use, modify, and distribute it as you see fit. Made with 🩵 by [tar-gezed](https://github.com/tar-gezed).
