# Known issues

## Bugs

**`mkdirSync` always reports `EEXIST` on failure** (`node_shim.js:337`)
Non-recursive `mkdirSync` calls `os.mkdir` and unconditionally throws `EEXIST` if the result is non-zero. Permission denied, missing parent, path-is-a-file — all silently become `EEXIST`. The actual errno from `os` is discarded.

**`writeSync` ignores the `position` parameter** (`node_shim.js:269`)
Node's `fs.writeSync(fd, buffer, offset, length, position)` should seek to `position` before writing when it is not `null`/`undefined`. The shim ignores the parameter entirely. Code that writes at an explicit position would silently write at the current cursor instead.

**`Buffer.write` ignores the `encoding` parameter** (`node_shim.js:161`)
Always encodes via UTF-8 regardless of the `encoding` argument passed. Silently wrong for any non-UTF-8 encoding.

**`util.format` format specifiers are wrong except `%s`** (`node_shim.js:454`)
`%d`, `%o`, and `%j` all use `String(v)` instead of `Number(v)`, an inspect-like renderer, and `JSON.stringify(v)` respectively.

**`readdirSync` with `withFileTypes` uses `os.stat` instead of `os.lstat`** (`node_shim.js:311`)
Symlinks to directories report `isDirectory()=true` and `isSymbolicLink()=false`. Node.js dirent objects follow `lstat` semantics, so symlinks should be identifiable as such.

**`openSync`, `writeFileSync`, `appendFileSync` always report `ENOENT` on failure**
Any failure (permission denied, path is a directory, disk full) is reported as `ENOENT` rather than the actual error.

**`require()` does not support `NODE_PATH`** (`node_shim.js`)
The module loader walks `node_modules` up the directory tree (standard Node.js resolution) but does not read the `NODE_PATH` environment variable. Node.js treats `NODE_PATH` as a colon-separated list of additional search directories, consulted after the `node_modules` walk. This could be useful for shared library trees that live outside any project. Implementation would be a few lines: split `process.env.NODE_PATH` on `:` and append the results to the search list in `_makeRequire`.

## Code quality

**Base64 logic is duplicated three times**
Identical encode/decode logic appears in `btoa`/`atob`, `_Buffer.from(data, 'base64')`, and `_Buffer.prototype.toString('base64')`. The three implementations already have minor divergences (e.g. `atob` strips `=` via the non-base64 char regex; `Buffer.from` checks `=` explicitly). A bug fix in one copy needs to be applied to the others.

**`TextDecoder.decode` has no bounds checking**
A truncated multibyte sequence at end-of-buffer reads `view[i+1]`/`view[i+2]`/`view[i+3]` past the array boundary. QuickJS returns `undefined` for out-of-bounds typed array reads, so the decode produces garbage rather than throwing.

**`atob` silently accepts malformed input**
`str.replace(/[^A-Za-z0-9+/]/g, '')` strips `=` padding and any other non-base64 characters without throwing. The Web spec requires an error on invalid input.

**`tscOutput` in the test suite captures output via a temp shell script** (`tsc_tests.js:22–28`)
It writes a `.sh` file and runs `sh script` to capture combined stdout+stderr. The approach is fragile and the `_n` counter is incremented twice per call, so capture files are non-consecutively numbered (`cap0`, `cap2`, `cap4`...).

**`test.ts` and `test_error.ts` in the project root are not part of any test suite**
These appear to be leftover development smoke-test files. They are not referenced by the Makefile or test runner.
