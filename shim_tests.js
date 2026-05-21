// Tests for node_shim.js
// Run with: qjs --std -I node_shim.js -I test_runner.js shim_tests.js

const TMP = '/tmp/node_shim_test_' + Date.now();
os.mkdir(TMP, 0o755);

// ============================================================
// Buffer
// ============================================================

section('Buffer.from / toString');

test('from utf8 string', () => {
  const b = Buffer.from('hello');
  eq(b.length, 5);
  eq(b[0], 0x68); // 'h'
  eq(b[4], 0x6f); // 'o'
});

test('from utf8 string, toString round-trip', () => {
  eq(Buffer.from('hello world').toString('utf8'), 'hello world');
});

test('from utf8 with multibyte chars', () => {
  const s = 'héllo'; // é is 2 bytes in UTF-8
  const b = Buffer.from(s);
  assert(b.length > s.length);
  eq(b.toString('utf8'), s);
});

test('from array of bytes', () => {
  const b = Buffer.from([72, 101, 108, 108, 111]);
  eq(b.toString(), 'Hello');
});

test('from hex encoding', () => {
  const b = Buffer.from('48656c6c6f', 'hex');
  eq(b.toString(), 'Hello');
});

test('to hex', () => {
  eq(Buffer.from('Hello').toString('hex'), '48656c6c6f');
});

test('from base64 encoding', () => {
  eq(Buffer.from('SGVsbG8=', 'base64').toString(), 'Hello');
});

test('to base64', () => {
  eq(Buffer.from('Hello').toString('base64'), 'SGVsbG8=');
});

test('base64 round-trip', () => {
  const original = 'The quick brown fox';
  eq(Buffer.from(Buffer.from(original).toString('base64'), 'base64').toString(), original);
});

section('Buffer.alloc / concat / isBuffer');

test('alloc zero-filled', () => {
  const b = Buffer.alloc(4);
  eq(b.length, 4);
  eq(b[0], 0); eq(b[3], 0);
});

test('alloc with fill byte', () => {
  const b = Buffer.alloc(3, 0xFF);
  eq(b[0], 255); eq(b[2], 255);
});

test('concat two buffers', () => {
  const a = Buffer.from('Hello');
  const b = Buffer.from(' World');
  eq(Buffer.concat([a, b]).toString(), 'Hello World');
});

test('concat with explicit length', () => {
  const a = Buffer.from('Hello');
  const b = Buffer.from(' World');
  eq(Buffer.concat([a, b], 5).toString(), 'Hello');
});

test('isBuffer', () => {
  assert(Buffer.isBuffer(Buffer.from('x')));
  assert(!Buffer.isBuffer('x'));
  assert(!Buffer.isBuffer(new Uint8Array(1)));
});

test('subarray / slice', () => {
  const b = Buffer.from('Hello World');
  eq(b.toString('utf8', 6, 11), 'World');
  eq(b.slice(0, 5).toString(), 'Hello');
});

test('Buffer.write utf8 (default)', () => {
  const b = Buffer.alloc(5);
  b.write('Hello');
  eq(b.toString(), 'Hello');
});

test('Buffer.write latin1 encoding', () => {
  const b = Buffer.alloc(3);
  b.write('\xFF\xFE\x41', 0, 3, 'latin1');
  eq(b[0], 0xFF); eq(b[1], 0xFE); eq(b[2], 0x41);
});

test('Buffer.write hex encoding', () => {
  const b = Buffer.alloc(3);
  b.write('deadbe', 0, 3, 'hex');
  eq(b[0], 0xDE); eq(b[1], 0xAD); eq(b[2], 0xBE);
});

test('Buffer.write base64 encoding', () => {
  const b = Buffer.alloc(3);
  b.write('SGVs', 0, 3, 'base64'); // 'Hel'
  eq(b[0], 72); eq(b[1], 101); eq(b[2], 108);
});

section('Buffer BOM detection (used by readFileWorker in tsc)');

test('UTF-8 BOM detection', () => {
  const b = Buffer.from([0xEF, 0xBB, 0xBF, 0x41]); // BOM + 'A'
  eq(b[0], 0xEF); eq(b[1], 0xBB); eq(b[2], 0xBF);
  eq(b.toString('utf8', 3), 'A');
});

test('UTF-16LE BOM detection', () => {
  const b = Buffer.from([0xFF, 0xFE, 0x41, 0x00]); // BOM + 'A' in UTF-16LE
  eq(b[0], 0xFF); eq(b[1], 0xFE);
  eq(b.toString('utf16le', 2), 'A');
});

// ============================================================
// path
// ============================================================

const path = require('path');

section('path.join');

test('join simple parts', () => eq(path.join('a', 'b', 'c'), 'a/b/c'));
test('join with leading slash', () => eq(path.join('/a', 'b'), '/a/b'));
test('join with ..', () => eq(path.join('/a', 'b', '..', 'c'), '/a/c'));
test('join with empty string', () => eq(path.join('a', '', 'b'), 'a/b'));
test('join trailing slash stripped', () => eq(path.join('a/b/'), 'a/b'));

section('path.dirname / basename / extname');

test('dirname of file', () => eq(path.dirname('/foo/bar.js'), '/foo'));
test('dirname of nested', () => eq(path.dirname('/foo/bar/baz.ts'), '/foo/bar'));
test('dirname of root file', () => eq(path.dirname('/foo.js'), '/'));
test('dirname of filename only', () => eq(path.dirname('foo.js'), '.'));
test('basename', () => eq(path.basename('/foo/bar.js'), 'bar.js'));
test('basename with ext strip', () => eq(path.basename('/foo/bar.js', '.js'), 'bar'));
test('extname .js', () => eq(path.extname('foo.js'), '.js'));
test('extname .d.ts', () => eq(path.extname('foo.d.ts'), '.ts'));
test('extname none', () => eq(path.extname('foo'), ''));
test('extname dot-file', () => eq(path.extname('.gitignore'), ''));

section('path.normalize');

test('normalize double slashes', () => eq(path.normalize('/foo//bar'), '/foo/bar'));
test('normalize dots', () => eq(path.normalize('/foo/./bar'), '/foo/bar'));
test('normalize ..',  () => eq(path.normalize('/foo/bar/../baz'), '/foo/baz'));
test('normalize relative', () => eq(path.normalize('a/b/../c'), 'a/c'));

section('path.resolve / isAbsolute / relative');

test('resolve absolute overrides', () => eq(path.resolve('/foo', '/bar'), '/bar'));
test('resolve appends to absolute', () => eq(path.resolve('/foo', 'bar'), '/foo/bar'));
test('isAbsolute true', () => assert(path.isAbsolute('/foo')));
test('isAbsolute false', () => assert(!path.isAbsolute('foo')));
test('isAbsolute false relative', () => assert(!path.isAbsolute('./foo')));
test('relative sibling dir', () => eq(path.relative('/a/b', '/a/c'), '../c'));
test('relative child', () => eq(path.relative('/a', '/a/b/c'), 'b/c'));
test('relative same', () => eq(path.relative('/a/b', '/a/b'), '.'));

section('path.parse / format');

test('parse', () => {
  const p = path.parse('/foo/bar.js');
  eq(p.dir, '/foo'); eq(p.base, 'bar.js'); eq(p.name, 'bar'); eq(p.ext, '.js');
});
test('format round-trip', () => {
  const p = path.parse('/foo/bar.js');
  eq(path.format(p), '/foo/bar.js');
});

// ============================================================
// fs
// ============================================================

const fs = require('fs');

section('fs.writeFileSync / readFileSync (string)');

const FILE1 = TMP + '/hello.txt';
const FILE2 = TMP + '/empty.txt';
const FILE3 = TMP + '/binary.bin';

test('writeFileSync creates file', () => {
  fs.writeFileSync(FILE1, 'Hello, world!');
  assert(fs.existsSync(FILE1));
});

test('readFileSync with utf8 encoding', () => {
  eq(fs.readFileSync(FILE1, 'utf8'), 'Hello, world!');
});

test('readFileSync without encoding returns Buffer', () => {
  const b = fs.readFileSync(FILE1);
  assert(Buffer.isBuffer(b));
  eq(b.toString('utf8'), 'Hello, world!');
});

test('readFileSync buffer byte values', () => {
  const b = fs.readFileSync(FILE1);
  eq(b[0], 72); // 'H'
  eq(b.length, 13);
});

test('writeFileSync overwrites', () => {
  fs.writeFileSync(FILE1, 'overwritten');
  eq(fs.readFileSync(FILE1, 'utf8'), 'overwritten');
  fs.writeFileSync(FILE1, 'Hello, world!'); // restore
});

test('write and read empty file', () => {
  fs.writeFileSync(FILE2, '');
  eq(fs.readFileSync(FILE2, 'utf8'), '');
  const b = fs.readFileSync(FILE2);
  eq(b.length, 0);
});

test('write and read unicode content', () => {
  const content = 'こんにちは\nHello\n';
  const f = TMP + '/unicode.txt';
  fs.writeFileSync(f, content);
  eq(fs.readFileSync(f, 'utf8'), content);
});

section('fs.openSync / writeSync / closeSync');

test('open-write-close creates readable file', () => {
  const f = TMP + '/fd_test.txt';
  const fd = fs.openSync(f, 'w');
  fs.writeSync(fd, 'line one\n', undefined, 'utf8');
  fs.writeSync(fd, 'line two\n', undefined, 'utf8');
  fs.closeSync(fd);
  eq(fs.readFileSync(f, 'utf8'), 'line one\nline two\n');
});

test('openSync on missing file throws ENOENT', () => {
  throws(() => fs.openSync(TMP + '/no_such_file_xyz.txt', 'r'), 'ENOENT');
});

test('openSync on directory throws EISDIR', () => {
  throws(() => fs.openSync(TMP, 'w'), 'EISDIR');
});

test('writeSync with position seeks before writing', () => {
  const f = TMP + '/seek_test.txt';
  fs.writeFileSync(f, 'AAAAA');
  const fd = fs.openSync(f, 'r+');
  fs.writeSync(fd, 'XY', 2); // write 'XY' at file position 2
  fs.closeSync(fd);
  eq(fs.readFileSync(f, 'utf8'), 'AAXYA');
});

section('fs.existsSync / statSync');

test('existsSync true for created file', () => assert(fs.existsSync(FILE1)));
test('existsSync false for missing', () => assert(!fs.existsSync(TMP + '/no_such_file_xyz.txt')));

test('statSync isFile', () => {
  const s = fs.statSync(FILE1);
  assert(s.isFile());
  assert(!s.isDirectory());
});

test('statSync size', () => {
  eq(fs.statSync(FILE1).size, 13); // 'Hello, world!' = 13 bytes
});

test('statSync mtime is Date', () => {
  assert(fs.statSync(FILE1).mtime instanceof Date);
});

test('statSync throwIfNoEntry:false returns undefined', () => {
  const s = fs.statSync(TMP + '/missing_xyz.txt', { throwIfNoEntry: false });
  eq(s, undefined);
});

test('statSync throws for missing by default', () => {
  throws(() => fs.statSync(TMP + '/missing_xyz.txt'), 'ENOENT');
});

test('readFileSync throws for missing', () => {
  throws(() => fs.readFileSync(TMP + '/missing_xyz.txt', 'utf8'), 'ENOENT');
});

section('fs.mkdirSync / readdirSync / statSync directory');

const SUBDIR = TMP + '/subdir';
const NESTED = TMP + '/a/b/c';

test('mkdirSync creates directory', () => {
  fs.mkdirSync(SUBDIR);
  assert(fs.statSync(SUBDIR).isDirectory());
});

test('mkdirSync on existing directory throws EEXIST', () => {
  throws(() => fs.mkdirSync(SUBDIR), 'EEXIST');
});

test('mkdirSync recursive creates parents', () => {
  fs.mkdirSync(NESTED, { recursive: true });
  assert(fs.statSync(NESTED).isDirectory());
});

test('statSync isDirectory', () => {
  assert(fs.statSync(SUBDIR).isDirectory());
  assert(!fs.statSync(SUBDIR).isFile());
});

test('readdirSync returns string array', () => {
  fs.writeFileSync(SUBDIR + '/a.txt', 'a');
  fs.writeFileSync(SUBDIR + '/b.txt', 'b');
  const entries = fs.readdirSync(SUBDIR);
  assert(Array.isArray(entries));
  assert(entries.includes('a.txt'));
  assert(entries.includes('b.txt'));
  assert(!entries.includes('.'));
  assert(!entries.includes('..'));
});

test('readdirSync withFileTypes returns dirents', () => {
  const entries = fs.readdirSync(SUBDIR, { withFileTypes: true });
  assert(Array.isArray(entries));
  assert(entries.every(e => typeof e.name === 'string'));
  assert(entries.every(e => typeof e.isFile === 'function'));
  const file = entries.find(e => e.name === 'a.txt');
  assert(file && file.isFile());
  assert(file && !file.isDirectory());
});

test('readdirSync throws for missing directory', () => {
  throws(() => fs.readdirSync(TMP + '/no_such_dir_xyz'), 'ENOENT');
});

test('readdirSync withFileTypes identifies symlinks via lstat', () => {
  const target = SUBDIR + '/a.txt';
  const link   = SUBDIR + '/link_to_a.txt';
  os.symlink(target, link);
  const entries = fs.readdirSync(SUBDIR, { withFileTypes: true });
  const dirent = entries.find(e => e.name === 'link_to_a.txt');
  assert(dirent && dirent.isSymbolicLink(), 'expected symlink dirent to report isSymbolicLink()');
  assert(dirent && !dirent.isFile(),        'expected symlink dirent not to report isFile()');
  os.remove(link);
});

section('fs.appendFileSync');

test('appendFileSync adds to existing file', () => {
  const f = TMP + '/append.txt';
  fs.writeFileSync(f, 'line1\n');
  fs.appendFileSync(f, 'line2\n');
  eq(fs.readFileSync(f, 'utf8'), 'line1\nline2\n');
});

test('writeFileSync on a directory throws EISDIR', () => {
  throws(() => fs.writeFileSync(TMP, 'data'), 'EISDIR');
});

test('appendFileSync on a directory throws EISDIR', () => {
  throws(() => fs.appendFileSync(TMP, 'data'), 'EISDIR');
});

section('fs.realpathSync');

test('realpathSync resolves to absolute path', () => {
  const r = fs.realpathSync(FILE1);
  assert(r.startsWith('/'));
  assert(r.endsWith('hello.txt'));
});

test('realpathSync.native works', () => {
  const r = fs.realpathSync.native(FILE1);
  assert(r.startsWith('/'));
});

test('realpathSync throws for missing', () => {
  throws(() => fs.realpathSync(TMP + '/missing_xyz.txt'), 'ENOENT');
});

section('fs.watch stubs (no-op, no throw)');

test('watch returns closeable object', () => {
  const w = fs.watch(FILE1, {}, () => {});
  assert(typeof w.close === 'function');
  w.close();
});

test('watchFile does not throw', () => { fs.watchFile(FILE1, {}, () => {}); });
test('unwatchFile does not throw', () => { fs.unwatchFile(FILE1, () => {}); });

// ============================================================
// os module
// ============================================================

const nodeOs = require('os');

section('os module');

test('EOL is newline on linux', () => eq(nodeOs.EOL, '\n'));
test('platform returns linux', () => eq(nodeOs.platform(), 'linux'));
test('homedir returns non-empty string', () => assert(typeof nodeOs.homedir() === 'string' && nodeOs.homedir().length > 0));
test('tmpdir returns non-empty string', () => assert(typeof nodeOs.tmpdir() === 'string' && nodeOs.tmpdir().length > 0));
test('arch returns string', () => eq(nodeOs.arch(), 'x64'));

// ============================================================
// process
// ============================================================

section('process');

test('platform is linux', () => eq(process.platform, 'linux'));
test('argv is array', () => assert(Array.isArray(process.argv)));
test('argv[0] is qjs', () => eq(process.argv[0], 'qjs'));
test('argv[1] is absolute path', () => assert(path.isAbsolute(process.argv[1])));
test('cwd() returns absolute path', () => assert(path.isAbsolute(process.cwd())));
test('env.HOME is defined', () => assert(typeof process.env.HOME === 'string'));
test('env.MISSING_XYZ_KEY is undefined', () => eq(process.env.MISSING_XYZ_KEY_12345, undefined));
test('stdout.write does not throw', () => { process.stdout.write(''); });
test('stderr.write does not throw', () => { process.stderr.write(''); });
test('nextTick calls fn synchronously', () => {
  let called = false;
  process.nextTick(() => { called = true; });
  assert(called);
});
test('hrtime returns [seconds, nanoseconds]', () => {
  const t = process.hrtime();
  assert(Array.isArray(t) && t.length === 2);
  assert(typeof t[0] === 'number' && typeof t[1] === 'number');
});
test('hrtime.bigint returns bigint', () => {
  assert(typeof process.hrtime.bigint() === 'bigint');
});
test('memoryUsage returns object', () => {
  const m = process.memoryUsage();
  assert(typeof m.heapUsed === 'number');
});

// ============================================================
// util.format
// ============================================================

section('util.format');

const { format } = require('util');

test('%s converts to string', () => eq(format('%s', 42), '42'));
test('%d converts to number', () => eq(format('%d', '3.5'), '3.5'));
test('%d on non-numeric', () => eq(format('%d', 'x'), 'NaN'));
test('%j serialises to JSON', () => eq(format('%j', { a: 1 }), '{"a":1}'));
test('%o pretty-prints object', () => { const r = format('%o', { x: 1 }); assert(r.includes('"x"') && r.includes('1')); });
test('%% emits literal percent', () => eq(format('100%%'), '100%'));
test('multiple specifiers', () => eq(format('%s=%d', 'x', 7), 'x=7'));
test('extra args beyond specifiers are ignored', () => eq(format('%s', 'a', 'b'), 'a'));
test('no specifiers returns fmt unchanged', () => eq(format('hello'), 'hello'));

// ============================================================
// require
// ============================================================

section('require');

test('require fs returns fs module', () => assert(typeof require('fs').readFileSync === 'function'));
test('require path returns path module', () => assert(typeof require('path').join === 'function'));
test('require os returns os module', () => assert(typeof require('os').platform === 'function'));
test('require buffer returns Buffer', () => assert(require('buffer').Buffer === Buffer));
test('require crypto returns createHash', () => assert(typeof require('crypto').createHash === 'function'));
test('require crypto sha256 empty string', () => {
  const hex = require('crypto').createHash('SHA256').update('').digest('hex');
  assert(hex === 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
});
test('require crypto sha256 chained updates produce 64-char hex', () => {
  const h = require('crypto').createHash('SHA256');
  h.update('hello'); h.update(' '); h.update('world');
  const hex = h.digest('hex');
  assert(typeof hex === 'string' && hex.length === 64 && /^[0-9a-f]+$/.test(hex));
});
test('require unknown throws', () => throws(() => require('no_such_module_xyz')));

// ============================================================
// require — file-based module loader
// ============================================================

section('require — file-based module loader');

const MODS = TMP + '/mods';
os.mkdir(MODS, 0o755);

test('loads module by absolute path', () => {
  fs.writeFileSync(MODS + '/abs.js', 'module.exports = { value: 99 };');
  const m = require(MODS + '/abs.js');
  eq(m.value, 99);
});

test('.js extension inferred', () => {
  fs.writeFileSync(MODS + '/noext.js', 'module.exports = { ok: true };');
  const m = require(MODS + '/noext');
  assert(m.ok);
});

test('exports.x pattern', () => {
  fs.writeFileSync(MODS + '/named.js', 'exports.greet = function(n) { return "hi " + n; };');
  eq(require(MODS + '/named.js').greet('world'), 'hi world');
});

test('module.exports = function', () => {
  fs.writeFileSync(MODS + '/fn.js', 'module.exports = function add(a, b) { return a + b; };');
  const fn = require(MODS + '/fn.js');
  eq(typeof fn, 'function');
  eq(fn(2, 3), 5);
});

test('loaded module receives correct __filename and __dirname', () => {
  fs.writeFileSync(MODS + '/meta.js', 'module.exports = { f: __filename, d: __dirname };');
  const m = require(MODS + '/meta.js');
  eq(m.f, MODS + '/meta.js');
  eq(m.d, MODS);
});

test('module is cached after first load', () => {
  fs.writeFileSync(MODS + '/cached.js', 'module.exports = { count: 0 };');
  const a = require(MODS + '/cached.js');
  a.count = 1;
  const b = require(MODS + '/cached.js');
  eq(b.count, 1);
});

test('scoped require: module loads sibling by relative path', () => {
  fs.writeFileSync(MODS + '/sib_a.js', 'module.exports = { from: "a" };');
  fs.writeFileSync(MODS + '/sib_b.js', 'const a = require("./sib_a"); module.exports = { msg: "b got " + a.from };');
  eq(require(MODS + '/sib_b.js').msg, 'b got a');
});

test('circular require returns partial exports without infinite loop', () => {
  fs.writeFileSync(MODS + '/circ_a.js', [
    'const b = require("./circ_b");',
    'module.exports = { name: "a", bName: b.name };',
  ].join('\n'));
  fs.writeFileSync(MODS + '/circ_b.js', [
    'const a = require("./circ_a");',
    'module.exports = { name: "b", aName: a.name };',
  ].join('\n'));
  const a = require(MODS + '/circ_a.js');
  eq(a.name, 'a');
  eq(a.bName, 'b');
  // circ_b captured circ_a's partial (empty) exports before circ_a finished
  eq(require(MODS + '/circ_b.js').aName, undefined);
});

test('index.js fallback for directory require', () => {
  fs.mkdirSync(MODS + '/pkg_index');
  fs.writeFileSync(MODS + '/pkg_index/index.js', 'module.exports = { from: "index" };');
  eq(require(MODS + '/pkg_index').from, 'index');
});

test('package.json "main" entry point', () => {
  fs.mkdirSync(MODS + '/pkg_main');
  fs.mkdirSync(MODS + '/pkg_main/lib');
  fs.writeFileSync(MODS + '/pkg_main/package.json', '{"main":"lib/entry.js"}');
  fs.writeFileSync(MODS + '/pkg_main/lib/entry.js', 'module.exports = { version: 2 };');
  eq(require(MODS + '/pkg_main').version, 2);
});

test('node_modules lookup from within a loaded module', () => {
  fs.mkdirSync(MODS + '/app');
  fs.mkdirSync(MODS + '/app/node_modules');
  fs.mkdirSync(MODS + '/app/node_modules/mypkg');
  fs.writeFileSync(MODS + '/app/node_modules/mypkg/index.js', 'module.exports = { name: "mypkg" };');
  fs.writeFileSync(MODS + '/app/main.js', 'module.exports = require("mypkg");');
  eq(require(MODS + '/app/main.js').name, 'mypkg');
});

test('missing relative module throws', () => {
  throws(() => require(MODS + '/no_such_file_xyz.js'));
});

test('missing bare module throws', () => {
  throws(() => require('no_such_pkg_xyz_abc'));
});

test('NODE_PATH: bare require finds module in NODE_PATH directory', () => {
  const dir = TMP + '/nodepath_lib';
  fs.mkdirSync(dir);
  fs.writeFileSync(dir + '/nodepath_mod.js', 'module.exports = { found: true };');
  const prev = process.env.NODE_PATH || '';
  process.env.NODE_PATH = dir;
  try {
    eq(require('nodepath_mod').found, true);
  } finally {
    process.env.NODE_PATH = prev;
  }
});

test('NODE_PATH: colon-separated list is searched in order', () => {
  const dir1 = TMP + '/nodepath_first';
  const dir2 = TMP + '/nodepath_second';
  fs.mkdirSync(dir1);
  fs.mkdirSync(dir2);
  fs.writeFileSync(dir1 + '/nodepath_order.js', 'module.exports = { src: "first" };');
  fs.writeFileSync(dir2 + '/nodepath_order.js', 'module.exports = { src: "second" };');
  const prev = process.env.NODE_PATH || '';
  process.env.NODE_PATH = dir1 + ':' + dir2;
  try {
    eq(require('nodepath_order').src, 'first');
  } finally {
    process.env.NODE_PATH = prev;
  }
});

// ============================================================
// TextEncoder / TextDecoder
// ============================================================

section('TextEncoder / TextDecoder');

test('encode ascii string', () => {
  const bytes = new TextEncoder().encode('Hi');
  eq(bytes[0], 72); eq(bytes[1], 105); eq(bytes.length, 2);
});

test('encode multibyte', () => {
  const bytes = new TextEncoder().encode('é'); // U+00E9 → 0xC3 0xA9
  eq(bytes.length, 2); eq(bytes[0], 0xC3); eq(bytes[1], 0xA9);
});

test('decode utf8', () => {
  eq(new TextDecoder().decode(new Uint8Array([72, 101, 108, 108, 111])), 'Hello');
});

test('decode utf-16le', () => {
  const b = new Uint8Array([0x41, 0x00, 0x42, 0x00]); // 'AB' in UTF-16LE
  eq(new TextDecoder('utf-16le').decode(b), 'AB');
});

test('encode→decode round-trip', () => {
  const s = 'Hello, 世界!';
  eq(new TextDecoder().decode(new TextEncoder().encode(s)), s);
});

test('decode truncated 2-byte sequence does not read past end', () => {
  const result = new TextDecoder().decode(new Uint8Array([0x41, 0xC3])); // 'A' + lone lead byte
  eq(result, 'A'); // truncated sequence is dropped, no garbage appended
});

test('decode truncated 3-byte sequence does not read past end', () => {
  const result = new TextDecoder().decode(new Uint8Array([0x41, 0xE2, 0x80])); // 'A' + 2/3 bytes
  eq(result, 'A');
});

test('decode truncated 4-byte sequence does not read past end', () => {
  const result = new TextDecoder().decode(new Uint8Array([0x41, 0xF0, 0x9F, 0x98])); // 'A' + 3/4 bytes
  eq(result, 'A');
});

// ============================================================
// globals
// ============================================================

section('globals (__filename, __dirname, module)');

test('__filename is absolute', () => assert(path.isAbsolute(__filename)));
test('__dirname is dirname of __filename', () => eq(__dirname, path.dirname(__filename)));
test('module.exports exists', () => assert(typeof module.exports === 'object'));

// ============================================================
// btoa / atob
// ============================================================

section('btoa / atob');

test('btoa encodes ascii', () => eq(btoa('Hello'), 'SGVsbG8='));
test('atob decodes back', () => eq(atob('SGVsbG8='), 'Hello'));
test('btoa/atob round-trip', () => eq(atob(btoa('The quick brown fox')), 'The quick brown fox'));
test('atob single byte (2-char group + ==)', () => eq(atob('YQ=='), 'a'));
test('atob two bytes (3-char group + =)', () => eq(atob('YWI='), 'ab'));
test('atob throws on invalid character', () => throws(() => atob('SGVs!G8=')));
test('atob throws on non-base64 character in otherwise valid string', () => throws(() => atob('YQ$=')));

// ============================================================
// cleanup & report
// ============================================================

rmdir(TMP);
reportResults();
