/**
 * CSS Variable Graph Builder
 *
 * Implement the functions below to pass the TDD test suite.
 */


/**
 * Parses CSS text and extracts CSS variables defined under different selectors.
 *
 * @param {string} cssText - The raw CSS style sheet content.
 * @returns {Array<{selector: string, variables: Object<string, string>}>}
 *          An array of rules containing the selector and its declared variables.
 *
 * @example
 * input:
 *   :root {
 *     --primary: #3498db;
 *     --accent: var(--primary);
 *   }
 * output:
 *   [
 *     {
 *       selector: ':root',
 *       variables: {
 *         '--primary': '#3498db',
 *         '--accent': 'var(--primary)'
 *       }
 *     }
 *   ]
 */
export function parseCSS(cssText) {
  const blockRegex = /(?<selector>[^{]+)\{(?<block>[^}]+)\}/g
  const varRegex = /(?<prop>--[\w-]+)\s*:\s*(?<val>[^;]+?)\s*;/g
  return [...cssText.matchAll(blockRegex)].map((blockMatch) => {
    const selector = blockMatch.groups.selector.trim()
    const variables = [...blockMatch.groups.block.matchAll(varRegex)].reduce(
      (acc, varMatch) => {
        acc[varMatch.groups.prop] = varMatch.groups.val
        return acc
      },
      {},
    )
    return { selector, variables }
  })
}

/**
 * Constructs a dependency graph from the parsed CSS rules.
 * Each node in the graph represents a variable definition under a specific selector scope.
 * Edges represent custom properties referenced via `var()` functions.
 *
 * @param {Array<{selector: string, variables: Object<string, string>}>} parsedRules
 * @returns {Object<string, {
 *   id: string,
 *   name: string,
 *   value: string,
 *   selector: string,
 *   dependencies: Array<string>
 * }>} The dependency graph mapping a node ID (e.g. "selector:--name") to its node details.
 */
export function buildDependencyGraph(parsedRules) {
  return parsedRules.reduce((acc, rule) => {
    for (const [prop, value] of Object.entries(rule.variables)) {
      const nodeId = `${rule.selector}:${prop}`
      acc[nodeId] = {
        id: nodeId,
        name: prop,
        value,
        selector: rule.selector,
        dependencies: extractDeps(value),
      }
    }

    return acc
  }, {})
}

function extractDeps(value) {
  return [...value.matchAll(/var\(\s*(?<varName>--[\w-]+)/g)].map(
    (m) => m.groups.varName,
  )
}

/**
 * Detects any circular dependencies in the graph.
 *
 * @param {Object} graph - The dependency graph constructed by buildDependencyGraph.
 * @returns {Array<Array<string>>} An array of cycles, where each cycle is a list of node IDs forming a loop.
 *
 * @example
 * [ [ ':root:--var-a', ':root:--var-b', ':root:--var-c', ':root:--var-a' ] ]
 */
export function detectCycles(graph) {
  const colors = {} // 0 - unvisited, 1 - visiting, 2 - visited
  const cycles = []
  const currentPath = []

  function dfs(nodeId) {
    colors[nodeId] = 1
    currentPath.push(nodeId)

    const node = graph[nodeId]

    for (const depName of node.dependencies) {
      const targetId = `${node.selector}:${depName}`

      if (!graph[targetId]) continue

      if (colors[targetId] === 1) {
        const cycleStartIndex = currentPath.indexOf(targetId)
        const cycle = [...currentPath.slice(cycleStartIndex), targetId]
        cycles.push(cycle)
      } else if (!colors[targetId]) {
        dfs(targetId)
      }
    }

    currentPath.pop()
    colors[nodeId] = 2
  }

  for (const nodeId of Object.keys(graph)) {
    if (!colors[nodeId]) dfs(nodeId)
  }

  return cycles
}

/**
 * Resolves the computed values of variables under a given DOM element scope.
 *
 * Variables are inherited from ancestors. For this simulation, we pass an inheritance path (scope path)
 * e.g., [':root', '.card', '.btn'] representing an element nesting hierarchy.
 *
 * @param {Object} graph - The dependency graph.
 * @param {Array<string>} scopePath - The selector path from root to child, e.g. [':root', '.card']
 * @returns {Object<string, string>} A map of variable names to their resolved computed values in that scope.
 */
export function resolveVariables(graph, scopePath) {
 // 1. Find all cycles in the graph
  const cycles = detectCycles(graph);
  const cyclicNodeIds = new Set(cycles.flat());
  // 2. Build active declarations map for the given scopePath
  const activeDecls = {};
  for (const selector of scopePath) {
    // Find all nodes in the graph that match this selector
    for (const node of Object.values(graph)) {
      if (selector.startsWith(node.selector)) {
        activeDecls[node.name] = node;
      }
    }
  }
  // Helper to resolve a specific variable name in this scope
  const resolvedCache = {}; // Optional: avoid re-computing the same variable

  function resolveVarName(varName, isTopLevel = false) {
    const node = activeDecls[varName];
    if (!node) {
      return null; // Undefined
    }
    if (!isTopLevel && cyclicNodeIds.has(node.id)) {
      return null; // A reference to a cyclic node is invalid
    }
    if (resolvedCache[varName] !== undefined) {
      return resolvedCache[varName];
    }
    // Resolve the value string of this node
    const result = resolveValueString(node.value);
    resolvedCache[varName] = result;
    return result;
  }
  // Helper to resolve all var() occurrences in a value string
  function resolveValueString(valueStr) {
    let current = valueStr;
    const innermostVarRegex = /var\(\s*(?<varName>--[\w-]+)\s*(?:,\s*(?<fallback>[^()]+))?\)/g;
    while (innermostVarRegex.test(current)) {
      current = current.replace(innermostVarRegex, (match, varName, fallback) => {
        const resolved = resolveVarName(varName);
        if (resolved === null) {
          return fallback ? fallback.trim() : "";
        }
        return resolved;
      });

      // Reset regex index for the next iteration of the while loop
      innermostVarRegex.lastIndex = 0;
    }

    return current.trim();
  }
  // 3. Resolve all active variables in the scope
  const result = {};
  for (const varName of Object.keys(activeDecls)) {
    const resolved = resolveVarName(varName, true);
    result[varName] = resolved === null ? "" : resolved;
  }

  return result;
}
