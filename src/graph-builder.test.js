import { describe, test, expect } from 'vitest';
import { parseCSS, buildDependencyGraph, detectCycles, resolveVariables } from './graph-builder.js';

describe('Phase 1: parseCSS', () => {
  test('extracts simple variables from :root', () => {
    const css = `
      :root {
        --primary-color: #3498db;
        --accent-color: var(--primary-color);
      }
    `;
    const result = parseCSS(css);
    expect(result).toHaveLength(1);
    expect(result[0].selector).toBe(':root');
    expect(result[0].variables).toEqual({
      '--primary-color': '#3498db',
      '--accent-color': 'var(--primary-color)'
    });
  });

  test('extracts variables with fallback values and whitespace styles', () => {
    const css = `
      :root {
        --bg-color:   var(--theme-bg, #ffffff)   ;
        --text-color: var(--theme-text, var(--primary-color, black));
      }
    `;
    const result = parseCSS(css);
    expect(result).toHaveLength(1);
    expect(result[0].variables['--bg-color']).toBe('var(--theme-bg, #ffffff)');
    expect(result[0].variables['--text-color']).toBe('var(--theme-text, var(--primary-color, black))');
  });

  test('handles multiple selectors and ignores non-variable properties', () => {
    const css = `
      :root {
        --main-size: 14px;
        color: red;
      }
      .container {
        padding: 10px;
        --local-size: var(--main-size);
      }
    `;
    const result = parseCSS(css);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      selector: ':root',
      variables: { '--main-size': '14px' }
    });
    expect(result[1]).toEqual({
      selector: '.container',
      variables: { '--local-size': 'var(--main-size)' }
    });
  });
});

describe('Phase 2: buildDependencyGraph', () => {
  test('constructs nodes and edges correctly', () => {
    const parsedRules = [
      {
        selector: ':root',
        variables: {
          '--primary-color': '#3498db',
          '--accent-color': 'var(--primary-color)'
        }
      }
    ];
    const graph = buildDependencyGraph(parsedRules);

    expect(graph[':root:--primary-color']).toBeDefined();
    expect(graph[':root:--accent-color']).toBeDefined();
    expect(graph[':root:--primary-color'].dependencies).toEqual([]);
    expect(graph[':root:--accent-color'].dependencies).toEqual(['--primary-color']);
  });

  test('extracts dependencies inside nested fallback var() functions', () => {
    const parsedRules = [
      {
        selector: ':root',
        variables: {
          '--bg-color': 'var(--theme-bg, #ffffff)',
          '--text-color': 'var(--theme-text, var(--primary-color, black))'
        }
      }
    ];
    const graph = buildDependencyGraph(parsedRules);

    expect(graph[':root:--bg-color'].dependencies).toEqual(['--theme-bg']);
    expect(graph[':root:--text-color'].dependencies).toContain('--theme-text');
    expect(graph[':root:--text-color'].dependencies).toContain('--primary-color');
    expect(graph[':root:--text-color'].dependencies).toHaveLength(2);
  });
});

describe('Phase 3: detectCycles', () => {
  test('detects direct cycle between two variables', () => {
    const parsedRules = [
      {
        selector: ':root',
        variables: {
          '--a': 'var(--b)',
          '--b': 'var(--a)'
        }
      }
    ];
    const graph = buildDependencyGraph(parsedRules);
    const cycles = detectCycles(graph);

    expect(cycles).toHaveLength(1);
    const cycle = cycles[0];
    expect(cycle).toContain(':root:--a');
    expect(cycle).toContain(':root:--b');
  });

  test('detects circular dependencies of length 3', () => {
    const parsedRules = [
      {
        selector: ':root',
        variables: {
          '--var-a': 'var(--var-b)',
          '--var-b': 'var(--var-c)',
          '--var-c': 'var(--var-a)'
        }
      }
    ];
    const graph = buildDependencyGraph(parsedRules);
    const cycles = detectCycles(graph);

    expect(cycles).toHaveLength(1);
    const cycle = cycles[0];
    expect(cycle).toContain(':root:--var-a');
    expect(cycle).toContain(':root:--var-b');
    expect(cycle).toContain(':root:--var-c');
  });
});

describe('Phase 4: resolveVariables', () => {
  test('resolves basic and inherited variables with specificities', () => {
    const parsedRules = [
      {
        selector: ':root',
        variables: {
          '--font-size': '16px',
          '--padding': 'var(--spacing)'
        }
      },
      {
        selector: '.card',
        variables: {
          '--spacing': '12px',
          '--card-font-size': 'var(--font-size)'
        }
      },
      {
        selector: '.card-active',
        variables: {
          '--spacing': '16px'
        }
      }
    ];
    const graph = buildDependencyGraph(parsedRules);

    // Resolve at root scope
    const rootRes = resolveVariables(graph, [':root']);
    expect(rootRes['--font-size']).toBe('16px');
    expect(rootRes['--padding']).toBe(''); // --spacing is undefined in :root

    // Resolve at .card scope
    const cardRes = resolveVariables(graph, [':root', '.card']);
    expect(cardRes['--font-size']).toBe('16px');
    expect(cardRes['--spacing']).toBe('12px');
    expect(cardRes['--padding']).toBe('12px');
    expect(cardRes['--card-font-size']).toBe('16px');

    // Resolve at .card-active scope
    const activeRes = resolveVariables(graph, [':root', '.card', '.card-active']);
    expect(activeRes['--spacing']).toBe('16px');
    expect(activeRes['--padding']).toBe('16px');
  });

  test('handles fallback values for undefined and cyclic variables', () => {
    const parsedRules = [
      {
        selector: ':root',
        variables: {
          '--theme-text': 'var(--color-primary, red)',
          '--theme-bg': 'var(--color-bg, var(--color-fallback, blue))',
          '--cyclical-1': 'var(--cyclical-2, green)',
          '--cyclical-2': 'var(--cyclical-1, yellow)'
        }
      }
    ];
    const graph = buildDependencyGraph(parsedRules);
    const res = resolveVariables(graph, [':root']);

    expect(res['--theme-text']).toBe('red');
    expect(res['--theme-bg']).toBe('blue');
    expect(res['--cyclical-1']).toBe('green');
    expect(res['--cyclical-2']).toBe('yellow');
  });

  test('cross-file resolution mimicking React components nesting', () => {
    const rulesTheme = [
      { selector: ':root', variables: { '--primary-color': '#3498db', '--bg-color': '#ffffff' } },
      { selector: '.theme-dark', variables: { '--bg-color': '#1e1e1e' } }
    ];
    const rulesCard = [
      { selector: '.card', variables: { '--card-bg': 'var(--bg-color)', '--card-padding': '20px', '--card-text': 'var(--text-color, #333)' } }
    ];
    const rulesButton = [
      { selector: '.btn', variables: { '--btn-bg': 'var(--primary-color)', '--btn-padding': 'var(--card-padding, 10px)' } },
      { selector: '.btn-secondary', variables: { '--btn-bg': 'var(--card-bg, #eee)' } }
    ];

    const allRules = [...rulesTheme, ...rulesCard, ...rulesButton];
    const graph = buildDependencyGraph(allRules);

    const scopePath = [':root', '.theme-dark', '.card', '.btn-secondary'];
    const resolved = resolveVariables(graph, scopePath);

    expect(resolved['--bg-color']).toBe('#1e1e1e');
    expect(resolved['--card-bg']).toBe('#1e1e1e');
    expect(resolved['--card-text']).toBe('#333');
    expect(resolved['--btn-bg']).toBe('#1e1e1e');
    expect(resolved['--btn-padding']).toBe('20px');
  });
});
