# Third-party notices

Code ported from other projects, with its licence notice kept as required. Only permissive licences (MIT / Apache-2.0 / BSD / Boost); never GPL or unlicensed code (CLAUDE.md rule 15).

## CADCraft — DXF tag reader/writer

- **Source:** https://github.com/storytold/cadcraft at commit `3b7eb1bb7bcbb5dd9a4f71ac1997f0e31105f2e82`. Files: `crates/dxf/src/lib.rs`, `crates/dxf/src/codepage.rs` and test cases from `crates/dxf/src/*.rs` and `crates/dxf/tests/*.rs`.
- **Ported to:** `engine/dxf/tags.ts`, `engine/dxf/codepage.ts`, `engine/dxf/tags.test.ts`, `engine/dxf/codepage.test.ts` (P1.2, ADR 0001 item C1, D-16). Each file's header names its source and what changed.
- **Licence:** CADCraft is dual-licensed MIT OR Apache-2.0; we use it under the MIT licence:

```
MIT License

Copyright (c) 2026 ArtCraft Team and the CADCraft contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## ezdxf — DXF template and checks

`engine/dxf/r2000-template.ts` is an empty AutoCAD 2000 drawing written by ezdxf 1.4.2 (https://github.com/mozman/ezdxf, MIT) via `tools/make_dxf_template.py`. It is generated output (DXF structure defined by Autodesk's DXF reference), not ezdxf source code. ezdxf and pytest (MIT) are used only as development tools in `tools/.venv`.

## Fonts

Geist and Geist Mono (Vercel), SIL Open Font License 1.1, bundled via `@fontsource-variable/geist` and `@fontsource-variable/geist-mono`. The licence text ships in each package's `LICENSE` file and travels with the font files in the build.

npm dependencies keep their own licence files in `node_modules`; they are not listed here.
