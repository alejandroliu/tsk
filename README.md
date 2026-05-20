# tsk — TypeScript compiler on QuickJS

Runs the TypeScript 5.4.5 compiler (`tsc.js`) under [QuickJS](https://bellard.org/quickjs/) via a Node.js compatibility shim — no Node.js required.

## Prerequisites

- `qjs` (QuickJS interpreter, version 2024-01-01 or later)

## Usage

```sh
qjs --std -I node_shim.js typescript-5.4.5/tsc.js [tsc args...]
```

Examples:

```sh
# Type-check a file without emitting output
qjs --std -I node_shim.js typescript-5.4.5/tsc.js --noEmit src/main.ts

# Compile to ES2020 JavaScript
qjs --std -I node_shim.js typescript-5.4.5/tsc.js --target es2020 --outDir dist src/main.ts

# Use a tsconfig.json
qjs --std -I node_shim.js typescript-5.4.5/tsc.js -p tsconfig.json

# Print compiler version
qjs --std -I node_shim.js typescript-5.4.5/tsc.js --version
```

You can wrap this in a shell alias or script:

```sh
#!/bin/sh
exec qjs --std -I /path/to/node_shim.js /path/to/typescript-5.4.5/tsc.js "$@"
```

## How it works

`tsc.js` is a self-contained bundle that expects a Node.js environment. `node_shim.js` is loaded first (via `-I`) and provides the globals that `tsc.js` needs before it runs:

| Shim component | What it provides |
|---|---|
| `require('fs')` | File I/O backed by QuickJS `std`/`os` modules |
| `require('path')` | Pure-JS POSIX path utilities |
| `require('os')` | Platform info (`linux`, EOL, homedir, tmpdir) |
| `require('buffer')` | `Buffer` class (extends `Uint8Array`) with full encoding support |
| `process` | `argv`, `env`, `cwd()`, `stdout`/`stderr`, `nextTick`, `hrtime` |
| `__filename`, `__dirname` | Resolved from `scriptArgs[0]` |
| `module`, `exports` | CommonJS stubs (needed for `isNodeLikeSystem()` check) |

Because `require('crypto')` throws, TypeScript falls back to its built-in `generateDjb2Hash` for content hashing. Incremental build info (`.tsbuildinfo`) still works; it just uses a different hash algorithm than SHA-256.

## Limitations

- **Watch mode (`--watch`) is a no-op.** `fs.watch`, `fs.watchFile`, and `fs.unwatchFile` are stubs that return immediately, and `setTimeout`/`setInterval` do not fire their callbacks. Use a shell loop or external file watcher instead.
- **No `source-map-support`.** Stack traces in compiler errors won't be remapped. The compiler still reports TypeScript-level diagnostics correctly.
- **No CPU profiling.** `--generateCpuProfile` requires the `inspector` module, which is stubbed out.
- **`require()` only resolves built-in modules.** TypeScript plugins that call `sys.require()` to load external modules at runtime will fail.

## Tests

```sh
make test
```

Or run individual suites:

```sh
qjs --std -I node_shim.js -I test_runner.js shim_tests.js
qjs --std -I node_shim.js -I test_runner.js tsc_tests.js
```

The suite covers `Buffer`, `path`, `fs`, `os`, `process`, `require`, `TextEncoder`/`TextDecoder`, `btoa`/`atob`, and end-to-end tsc invocations.

## Files

```
node_shim.js          Node.js compatibility shim (~530 lines)
test_runner.js        Shared test harness (~60 lines)
shim_tests.js         Shim unit tests (~460 lines, 112 tests)
tsc_tests.js          End-to-end compiler tests (~490 lines)
typescript-5.4.5/
  tsc.js              Bundled TypeScript compiler
  lib.*.d.ts          Bundled library declaration files
```
