import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Engine purity (PRD §0.4 rule 1, CLAUDE.md rule 9): no React, DOM, fetch or Node fs/net/http in /engine.
// Test files are dev-only and exempt; they may use Node (this one does).

const ENGINE_DIR = dirname(fileURLToPath(import.meta.url));

const FORBIDDEN_MODULE =
  /^(react|react-dom)(\/.*)?$|^node:|^(fs|fs\/promises|net|http|https|http2|tls|dgram|child_process)$/;

const FORBIDDEN_GLOBALS: [string, RegExp][] = [
  ['window', /\bwindow\s*\./],
  ['document', /\bdocument\s*\./],
  ['fetch', /\bfetch\s*\(/],
  ['localStorage', /\blocalStorage\b/],
  ['sessionStorage', /\bsessionStorage\b/],
  ['indexedDB', /\bindexedDB\b/],
  ['XMLHttpRequest', /\bXMLHttpRequest\b/],
  ['navigator', /\bnavigator\s*\./],
  ['WebSocket', /\bWebSocket\b/],
];

/** Blanks out comments and string contents so `"window"` as a room/opening name is not a hit. */
function stripCommentsAndStrings(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/.*$/gm, ' ')
    .replace(/(['"`])(?:\\.|(?!\1)[^\\])*\1/g, '""');
}

function findViolations(source: string): string[] {
  const violations: string[] = [];
  const specifiers = [
    ...source.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g),
    ...source.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g),
    ...source.matchAll(/^\s*import\s+['"]([^'"]+)['"]/gm),
    ...source.matchAll(/\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g),
  ].map((m) => m[1]!);
  for (const spec of specifiers) {
    if (FORBIDDEN_MODULE.test(spec)) violations.push(`imports "${spec}"`);
  }
  const code = stripCommentsAndStrings(source);
  for (const [name, pattern] of FORBIDDEN_GLOBALS) {
    if (pattern.test(code)) violations.push(`uses ${name}`);
  }
  return violations;
}

function engineSourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : engineSourceFiles(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

describe('engine purity', () => {
  it('flags forbidden imports and globals', () => {
    expect(findViolations(`import React from 'react';`)).toEqual(['imports "react"']);
    expect(findViolations(`import { createRoot } from 'react-dom/client';`)).toEqual([
      'imports "react-dom/client"',
    ]);
    expect(findViolations(`import { readFile } from 'node:fs/promises';`)).toEqual([
      'imports "node:fs/promises"',
    ]);
    expect(findViolations(`import * as http from 'http';`)).toEqual(['imports "http"']);
    expect(findViolations(`const fs = require('fs');`)).toEqual(['imports "fs"']);
    expect(findViolations(`await import('net');`)).toEqual(['imports "net"']);
    expect(findViolations(`const r = await fetch(url);`)).toEqual(['uses fetch']);
    expect(findViolations(`document.body.append(el);`)).toEqual(['uses document']);
    expect(findViolations(`window.addEventListener('x', f);`)).toEqual(['uses window']);
    expect(findViolations(`localStorage.setItem('k', v);`)).toEqual(['uses localStorage']);
  });

  it('allows plain engine code that mentions windows and documents as data', () => {
    const source = `
      import { roomArea } from './geometry/area';
      // A window is an opening hosted on a wall; fetch nothing here.
      const kind = 'window';
      const doc = { document: 'plan', window: kind };
      export const openingKinds = ['door', "window"] as const;
    `;
    expect(findViolations(source)).toEqual([]);
  });

  it('holds for every /engine source file', () => {
    const files = engineSourceFiles(ENGINE_DIR);
    expect(files.length).toBeGreaterThan(0);
    const report = files.flatMap((file) =>
      findViolations(readFileSync(file, 'utf8')).map((v) => `${relative(ENGINE_DIR, file)}: ${v}`),
    );
    expect(report).toEqual([]);
  });
});
