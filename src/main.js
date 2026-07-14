import { Network, DataSet } from 'vis-network/standalone';
import * as graphBuilder from './graph-builder.js';

// Hardcoded copies of CSS files to guarantee it works as default/fallback
const cssFallbacks = {
  "01-simple": `:root {
  --primary-color: #3498db;
  --accent-color: var(--primary-color);
}`,
  "02-fallback": `:root {
  --bg-color: var(--theme-bg, #ffffff);
  --text-color: var(--theme-text, var(--primary-color, black));
}`,
  "03-cycles": `:root {
  --var-a: var(--var-b);
  --var-b: var(--var-c);
  --var-c: var(--var-a);
}`,
  "04-nesting": `:root {
  --font-size: 16px;
  --padding: var(--spacing);
}

.card {
  --spacing: 12px;
  --card-font-size: var(--font-size);
}

.card-active {
  --spacing: 16px;
}`,
  "05-react-components/Theme.css": `:root {
  --primary-color: #3498db;
  --bg-color: #ffffff;
}

.theme-dark {
  --bg-color: #1e1e1e;
}`,
  "05-react-components/Card.css": `.card {
  --card-bg: var(--bg-color);
  --card-padding: 20px;
  --card-text: var(--text-color, #333);
}`,
  "05-react-components/Button.css": `.btn {
  --btn-bg: var(--primary-color);
  --btn-padding: var(--card-padding, 10px);
}

.btn-secondary {
  --btn-bg: var(--card-bg, #eee);
}`
};

let currentScenario = '01-simple';
let currentReactSubfile = 'Theme.css';
let visNetworkInstance = null;
let computedGraph = null;
let selectedNodeId = null;

// Default DOM scopes for each scenario
const defaultScopePaths = {
  '01-simple': [':root'],
  '02-fallback': [':root'],
  '03-cycles': [':root'],
  '04-nesting': [':root', '.card', '.card-active'],
  '05-react-components': [':root', '.theme-dark', '.card', '.btn-secondary']
};

let activeScopePath = [...defaultScopePaths[currentScenario]];

// Initialize UI
window.addEventListener('DOMContentLoaded', () => {
  loadScenario(currentScenario);

  document.getElementById('css-textarea').addEventListener('input', (e) => {
    updateVisualization(e.target.value);
  });

  // Hook scenario tabs
  document.getElementById('scenario-tabs').addEventListener('click', (e) => {
    const tab = e.target.closest('.tab');
    if (!tab) return;

    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    currentScenario = tab.dataset.scenario;
    activeScopePath = [...defaultScopePaths[currentScenario]];
    loadScenario(currentScenario);
  });

  // Hook subfile tabs for React Components
  document.getElementById('subfile-tabs').addEventListener('click', (e) => {
    const tab = e.target.closest('.file-subtab');
    if (!tab) return;

    document.querySelectorAll('.file-subtab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    currentReactSubfile = tab.dataset.file;
    loadScenario('05-react-components');
  });
});

// Load Scenario CSS into Textarea
async function loadScenario(scenario) {
  const textarea = document.getElementById('css-textarea');
  const subfileTabs = document.getElementById('subfile-tabs');

  if (scenario === '05-react-components') {
    subfileTabs.style.display = 'flex';

    if (currentReactSubfile === 'Combined') {
      // Concat all three files
      textarea.value = `/* COMBINED CSS FROM COMPONENT STYLESHEETS */\n\n` +
        `/* --- Theme.css --- */\n${await fetchCSS('05-react-components/Theme.css')}\n\n` +
        `/* --- Card.css --- */\n${await fetchCSS('05-react-components/Card.css')}\n\n` +
        `/* --- Button.css --- */\n${await fetchCSS('05-react-components/Button.css')}`;
      textarea.disabled = true; // Readonly combined view
    } else {
      textarea.value = await fetchCSS(`05-react-components/${currentReactSubfile}`);
      textarea.disabled = false;
    }
  } else {
    subfileTabs.style.display = 'none';
    textarea.value = await fetchCSS(scenario);
    textarea.disabled = false;
  }

  renderScopeBadges();
  updateVisualization(textarea.value);
}

// Fetch helper with fallback to embedded string
async function fetchCSS(filename) {
  try {
    const baseUrl = import.meta.env.BASE_URL;
    const path = filename.includes('/') ? `${baseUrl}css-examples/${filename}` : `${baseUrl}css-examples/${filename}.css`;
    const res = await fetch(path + '?raw');
    if (!res.ok) throw new Error();
    return await res.text();
  } catch (e) {
    // Fallback to static embedded database
    const key = filename.replace('.css', '');
    return cssFallbacks[key] || '';
  }
}

// Render badges for scoping
function renderScopeBadges() {
  const container = document.getElementById('scope-path-badges');
  container.innerHTML = '';

  const selectors = defaultScopePaths[currentScenario] || [':root'];

  selectors.forEach((sel) => {
    const badge = document.createElement('span');
    badge.className = 'scope-badge';
    badge.innerText = sel;

    const isActive = activeScopePath.includes(sel);
    if (isActive) {
      badge.classList.add('active');
    }

    badge.addEventListener('click', () => {
      if (activeScopePath.includes(sel)) {
        if (activeScopePath.length > 1) {
          activeScopePath = activeScopePath.filter(x => x !== sel);
        }
      } else {
        if (sel === ':root') {
          activeScopePath.unshift(':root');
        } else {
          activeScopePath.push(sel);
        }
      }
      renderScopeBadges();
      const currentCss = document.getElementById('css-textarea').value;
      updateVisualization(currentCss);
    });

    container.appendChild(badge);
  });
}

// Parse and build the visual network graph
function updateVisualization(cssText) {
  const errorOverlay = document.getElementById('build-error-screen');
  const errorTitle = document.getElementById('build-error-title');
  const errorMessage = document.getElementById('build-error-message');

  try {
    let parsed;
    if (currentScenario === '05-react-components' && currentReactSubfile !== 'Combined') {
      parsed = graphBuilder.parseCSS(cssText);
    } else if (currentScenario === '05-react-components' && currentReactSubfile === 'Combined') {
      const parsedTheme = graphBuilder.parseCSS(cssFallbacks['05-react-components/Theme.css']);
      const parsedCard = graphBuilder.parseCSS(cssFallbacks['05-react-components/Card.css']);
      const parsedButton = graphBuilder.parseCSS(cssFallbacks['05-react-components/Button.css']);
      parsed = [...parsedTheme, ...parsedCard, ...parsedButton];
    } else {
      parsed = graphBuilder.parseCSS(cssText);
    }

    computedGraph = graphBuilder.buildDependencyGraph(parsed);

    let cycles = [];
    try {
      cycles = graphBuilder.detectCycles(computedGraph) || [];
    } catch (e) {
      console.warn("Cycle detection failed or not implemented:", e);
    }

    let resolvedVals = {};
    try {
      resolvedVals = graphBuilder.resolveVariables(computedGraph, activeScopePath) || {};
    } catch (e) {
      console.warn("Variable resolution failed or not implemented:", e);
    }

    errorOverlay.style.display = 'none';
    drawNetwork(computedGraph, cycles, resolvedVals);

    if (selectedNodeId) {
      inspectNode(selectedNodeId, resolvedVals);
    }
  } catch (err) {
    errorOverlay.style.display = 'flex';
    errorTitle.innerText = "Error in graph-builder.js";
    errorMessage.innerText = err.message + "\n\n" + (err.stack ? err.stack.split('\n')[1] : '');
  }
}

function drawNetwork(graph, cycles, resolvedVals) {
  const container = document.getElementById('network-canvas');

  const nodesArray = [];
  const edgesArray = [];
  const nodeIds = Object.keys(graph);
  const cyclicalNodes = new Set(cycles.flat());

  nodeIds.forEach(id => {
    const node = graph[id];
    const hasValue = resolvedVals[node.name] !== undefined && resolvedVals[node.name] !== "";
    const isCyclic = cyclicalNodes.has(id);

    let color = {
      background: '#1e293b',
      border: 'rgba(255, 255, 255, 0.3)',
      highlight: { background: '#2563eb', border: '#60a5fa' },
      hover: { background: '#334155', border: 'rgba(255, 255, 255, 0.5)' }
    };

    if (isCyclic) {
      color = {
        background: 'rgba(239, 68, 68, 0.2)',
        border: '#ef4444',
        highlight: { background: 'rgba(239, 68, 68, 0.4)', border: '#f87171' },
        hover: { background: 'rgba(239, 68, 68, 0.35)', border: '#ef4444' }
      };
    } else if (hasValue) {
      color = {
        background: 'rgba(16, 185, 129, 0.1)',
        border: '#10b981',
        highlight: { background: 'rgba(16, 185, 129, 0.3)', border: '#34d399' },
        hover: { background: 'rgba(16, 185, 129, 0.25)', border: '#10b981' }
      };
    }

    nodesArray.push({
      id: id,
      label: `${node.name}\n(${node.selector})`,
      color: color,
      font: { color: '#f8fafc', face: 'Outfit', size: 12 },
      shape: 'box',
      margin: 10,
      borderWidth: 2,
      shadow: true
    });

    if (node.dependencies) {
      node.dependencies.forEach(dep => {
        let depNodeId = findDependencyNodeId(dep, node.selector, graph);

        edgesArray.push({
          from: id,
          to: depNodeId || `ghost:${dep}`,
          color: isCyclic ? { color: '#ef4444' } : { color: 'rgba(255, 255, 255, 0.25)' },
          width: isCyclic ? 2 : 1,
          dashes: !depNodeId
        });

        if (!depNodeId && !nodesArray.find(n => n.id === `ghost:${dep}`)) {
          nodesArray.push({
            id: `ghost:${dep}`,
            label: `${dep}\n(Not Declared)`,
            color: {
              background: 'rgba(245, 158, 11, 0.1)',
              border: '#f59e0b',
              highlight: { background: 'rgba(245, 158, 11, 0.3)', border: '#fbbf24' },
              hover: { background: 'rgba(245, 158, 11, 0.25)', border: '#f59e0b' }
            },
            font: { color: '#f8fafc', face: 'Outfit', size: 12 },
            shape: 'ellipse',
            borderWidth: 1,
            shadow: false
          });
        }
      });
    }
  });

  const data = {
    nodes: new DataSet(nodesArray),
    edges: new DataSet(edgesArray)
  };

  const options = {
    physics: {
      enabled: true,
      solver: 'forceAtlas2Based',
      forceAtlas2Based: {
        gravitationalConstant: -150,
        centralGravity: 0.01,
        springLength: 180,
        springConstant: 0.08
      }
    },
    interaction: {
      hover: true,
      selectConnectedEdges: true
    },
    edges: {
      arrowStrikethrough: false,
      arrows: 'to'
    }
  };

  if (visNetworkInstance) {
    visNetworkInstance.destroy();
  }

  visNetworkInstance = new Network(container, data, options);

  visNetworkInstance.on('selectNode', (params) => {
    if (params.nodes.length > 0) {
      selectedNodeId = params.nodes[0];
      inspectNode(selectedNodeId, resolvedVals);
    }
  });

  visNetworkInstance.on('deselectNode', () => {
    selectedNodeId = null;
    clearInspector();
  });

  if (selectedNodeId && graph[selectedNodeId]) {
    inspectNode(selectedNodeId, resolvedVals);
  } else {
    clearInspector();
  }
}

function findDependencyNodeId(depName, selector, graph) {
  const sameScopeId = `${selector}:${depName}`;
  if (graph[sameScopeId]) return sameScopeId;

  for (let i = activeScopePath.length - 1; i >= 0; i--) {
    const s = activeScopePath[i];
    const id = `${s}:${depName}`;
    if (graph[id]) return id;
  }

  const keys = Object.keys(graph);
  const match = keys.find(k => graph[k].name === depName);
  return match || null;
}

function inspectNode(nodeId, resolvedVals) {
  if (nodeId.startsWith('ghost:')) {
    const name = nodeId.replace('ghost:', '');
    document.getElementById('inspect-node-name').innerText = name;
    document.getElementById('inspect-node-selector').innerText = 'N/A';
    document.getElementById('inspect-node-raw').innerText = 'Undefined';
    const resVal = document.getElementById('inspect-node-resolved');
    resVal.innerText = 'Unresolved (using fallback or empty)';
    resVal.className = 'inspector-val warning';
    return;
  }

  const node = computedGraph[nodeId];
  if (!node) return;

  document.getElementById('inspect-node-name').innerText = node.name;
  document.getElementById('inspect-node-selector').innerText = node.selector;
  document.getElementById('inspect-node-raw').innerText = node.value;

  const resVal = document.getElementById('inspect-node-resolved');
  const resolved = resolvedVals[node.name];

  if (resolved === undefined || resolved === "") {
    resVal.innerText = 'Unresolved / Empty';
    resVal.className = 'inspector-val warning';
  } else {
    resVal.innerText = resolved;
    resVal.className = 'inspector-val success';
  }
}

function clearInspector() {
  document.getElementById('inspect-node-name').innerText = '-';
  document.getElementById('inspect-node-selector').innerText = '-';
  document.getElementById('inspect-node-raw').innerText = '-';
  const resVal = document.getElementById('inspect-node-resolved');
  resVal.innerText = '-';
  resVal.className = 'inspector-val';
}
