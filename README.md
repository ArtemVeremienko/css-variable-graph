# CSS Variable Graph Builder Sandbox

Welcome to the CSS Variable Graph Builder Sandbox! This interactive workspace contains a completed dependency graph builder and visualizer for CSS custom properties (variables) developed using a Test-Driven Development (TDD) workflow powered by **Vite** and **Vitest**.

---

## Current Status

All four TDD implementation phases have been **fully completed** and **100% verified** against the test suite, with all tests passing successfully.

### Test Results
```text
 RUN  v4.1.10 splendid-lovelace

 ✓ src/graph-builder.test.js (10 tests) 6ms

 Test Files  1 passed (1)
      Tests  10 passed (10)
   Start at  22:57:54
   Duration  172ms (transform 21ms, setup 0ms, import 49ms, tests 5ms, environment 0ms)
```

---

## Features & Enhancements Implemented

### 1. Robust CSS Parsing (`parseCSS`)
Extracts custom property definitions and raw values from rule blocks under different selectors using precise regex patterns. It naturally handles whitespace surrounding keys/values and ignores non-variable properties.

### 2. Directed Dependency Graph (`buildDependencyGraph`)
Constructs a directed graph mapping nodes representing CSS variables (e.g. `:root:--accent-color`) to their declared properties. Identifies references to other variables (including nested fallbacks like `var(--a, var(--b, #000))`) using a recursive inside-out matcher.

### 3. Loop and Cycle Detection (`detectCycles`)
Detects circular references (e.g. `--var-a: var(--var-b); --var-b: var(--var-a)`) using a Depth-First Search (DFS) node coloring algorithm (`0` - unvisited, `1` - visiting, `2` - visited). It correctly reconstructs the exact cyclic paths that form loops.

### 4. Hierarchical Value Resolution (`resolveVariables`)
Computes the final resolved values of CSS variables for a given DOM inheritance path (e.g., `[':root', '.card', '.btn-secondary']`), supporting:
* **Specificities and Overrides**: Variables defined in descendant selectors correctly override parent selectors.
* **Fallback Evaluation**: Undefined or cyclical variables naturally trigger their defined fallback values.
* **Cycle Handling**: Variables participating in cycles are dynamically evaluated as invalid/undefined for references, triggering their fallback paths without causing infinite recursion loops.

---

## Visualizer UI & Layout Enhancements

To make the playground visualizer feel extremely premium and robust, the following visual bugs and layout details were resolved:
1. **Raw CSS Loader (`fetchCSS` ?raw fix)**: Appended `?raw` to the dynamic CSS fetch calls to bypass Vite dev server transpilation, ensuring raw text CSS is loaded for parsing rather than ES module JS code.
2. **Absolute Canvas Positioning**: Replaced standard canvas rendering with `position: absolute` inside a flex container to break infinite canvas height resizing loops. Locked down viewport dimensions using `height: 100vh`, `min-height: 0`, and `overflow: hidden` on the page layout.
3. **Borders-Only Edge Snapping**: Configured custom hidden source arrows to force Vis-network to calculate perimeter intersections on both ends of edges, making directed edges terminate cleanly at node borders rather than starting from the center of the nodes.
4. **Improved Layout Spacing**: Spaced out nodes visually by increasing the physics spring length (`180`) and strengthening the repulsion force (`-150`).
5. **Subtle Hover States**: Created custom hover color transitions for all node states (default, cyclic, resolved, and ghost) to fit within a premium dark-theme dashboard.
6. **Pixel-Perfect Header Titles**: Vertically aligned panel titles and SVG icons using flexbox layouts.

---

## How to Run & Explore

### 1. Install dependencies
```bash
npm install
```

### 2. Run the Unit Tests
To run the Vitest test suite once:
```bash
npm run test
```

To start Vitest in watch mode:
```bash
npx vitest
```

### 3. Start the Interactive Visualizer (Vite Dev Server)
To run the visualizer locally:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser. You can click on the scenario tabs, toggle selectors in the simulated DOM path, and select individual variable nodes to inspect their resolved values under the current scope!

### 4. Build for Production
To bundle the project:
```bash
npm run build
```
This builds static assets into the `dist/` directory.
