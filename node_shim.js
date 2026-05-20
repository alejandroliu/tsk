// Node.js compatibility shim for QuickJS
// Usage: qjs --std -I node_shim.js typescript-5.4.5/tsc.js [tsc args...]
// Requires: qjs --std (makes 'std' and 'os' modules available as globals)

// ---- TextEncoder / TextDecoder fallbacks ----

if (typeof TextEncoder === 'undefined') {
  globalThis.TextEncoder = class TextEncoder {
    encode(str) {
      const buf = new Uint8Array(str.length * 3);
      let pos = 0;
      for (let i = 0; i < str.length; i++) {
        let c = str.charCodeAt(i);
        if (c >= 0xD800 && c <= 0xDBFF && i + 1 < str.length) {
          const low = str.charCodeAt(i + 1);
          if (low >= 0xDC00 && low <= 0xDFFF) {
            c = 0x10000 + ((c - 0xD800) << 10) + (low - 0xDC00);
            i++;
          }
        }
        if (c < 0x80) { buf[pos++] = c; }
        else if (c < 0x800) { buf[pos++] = 0xC0 | (c >> 6); buf[pos++] = 0x80 | (c & 0x3F); }
        else if (c < 0x10000) { buf[pos++] = 0xE0 | (c >> 12); buf[pos++] = 0x80 | ((c >> 6) & 0x3F); buf[pos++] = 0x80 | (c & 0x3F); }
        else { buf[pos++] = 0xF0 | (c >> 18); buf[pos++] = 0x80 | ((c >> 12) & 0x3F); buf[pos++] = 0x80 | ((c >> 6) & 0x3F); buf[pos++] = 0x80 | (c & 0x3F); }
      }
      return buf.subarray(0, pos);
    }
  };
}

if (typeof TextDecoder === 'undefined') {
  globalThis.TextDecoder = class TextDecoder {
    constructor(enc) { this.encoding = enc || 'utf-8'; }
    decode(input) {
      if (!input) return '';
      const view = input instanceof Uint8Array ? input : new Uint8Array(input.buffer || input, input.byteOffset || 0, input.byteLength !== undefined ? input.byteLength : input.length);
      if (this.encoding === 'utf-16le') {
        let s = '';
        for (let i = 0; i < view.length - 1; i += 2) s += String.fromCharCode(view[i] | (view[i+1] << 8));
        return s;
      }
      let s = '', i = 0;
      while (i < view.length) {
        const b = view[i];
        if (b < 0x80) { s += String.fromCharCode(b); i++; }
        else if (b < 0xE0) { s += String.fromCharCode(((b & 0x1F) << 6) | (view[i+1] & 0x3F)); i += 2; }
        else if (b < 0xF0) { s += String.fromCharCode(((b & 0x0F) << 12) | ((view[i+1] & 0x3F) << 6) | (view[i+2] & 0x3F)); i += 3; }
        else { const cp = ((b & 0x07) << 18) | ((view[i+1] & 0x3F) << 12) | ((view[i+2] & 0x3F) << 6) | (view[i+3] & 0x3F); s += String.fromCodePoint(cp); i += 4; }
      }
      return s;
    }
  };
}

if (typeof btoa === 'undefined') {
  const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  globalThis.btoa = (str) => {
    let r = '', i = 0;
    while (i < str.length) {
      const a = str.charCodeAt(i++);
      const hasB = i < str.length, b = hasB ? str.charCodeAt(i++) : 0;
      const hasC = i < str.length, c = hasC ? str.charCodeAt(i++) : 0;
      r += B64[a >> 2] + B64[((a & 3) << 4) | (b >> 4)]
        + (hasB ? B64[((b & 15) << 2) | (c >> 6)] : '=')
        + (hasC ? B64[c & 63] : '=');
    }
    return r;
  };
  globalThis.atob = (str) => {
    str = str.replace(/[^A-Za-z0-9+/]/g, '');
    let r = '', i = 0;
    while (i < str.length) {
      const a = B64.indexOf(str[i++]), b = B64.indexOf(str[i++]);
      const c = i < str.length ? B64.indexOf(str[i++]) : -1;
      const d = i < str.length ? B64.indexOf(str[i++]) : -1;
      r += String.fromCharCode((a << 2) | (b >> 4));
      if (c !== -1) r += String.fromCharCode(((b & 15) << 4) | (c >> 2));
      if (d !== -1) r += String.fromCharCode(((c & 3) << 6) | d);
    }
    return r;
  };
}

// ---- Buffer ----

const _enc = new TextEncoder();
const _dec = new TextDecoder();
const _dec16 = new TextDecoder('utf-16le');

class _Buffer extends Uint8Array {
  static from(data, encoding) {
    if (typeof data === 'string') {
      if (encoding === 'base64') {
        const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
        const s = data.replace(/\s/g, '');
        const bytes = [];
        for (let j = 0; j < s.length; j += 4) {
          const a = B64.indexOf(s[j]), b = B64.indexOf(s[j+1]);
          const c = s[j+2] === '=' || s[j+2] === undefined ? -1 : B64.indexOf(s[j+2]);
          const d = s[j+3] === '=' || s[j+3] === undefined ? -1 : B64.indexOf(s[j+3]);
          bytes.push((a << 2) | (b >> 4));
          if (c !== -1) bytes.push(((b & 15) << 4) | (c >> 2));
          if (d !== -1) bytes.push(((c & 3) << 6) | d);
        }
        const b = new _Buffer(bytes.length);
        for (let j = 0; j < bytes.length; j++) b[j] = bytes[j];
        return b;
      }
      if (encoding === 'hex') { const b = new _Buffer(data.length >> 1); for (let i = 0; i < b.length; i++) b[i] = parseInt(data.slice(i*2, i*2+2), 16); return b; }
      const e = _enc.encode(data); const b = new _Buffer(e.length); b.set(e); return b;
    }
    if (data instanceof _Buffer) { const b = new _Buffer(data.length); b.set(data); return b; }
    if (data instanceof ArrayBuffer) { const b = new _Buffer(data.byteLength); b.set(new Uint8Array(data)); return b; }
    if (ArrayBuffer.isView(data)) { const b = new _Buffer(data.byteLength); b.set(new Uint8Array(data.buffer, data.byteOffset, data.byteLength)); return b; }
    if (Array.isArray(data)) { const b = new _Buffer(data.length); for (let i = 0; i < data.length; i++) b[i] = data[i] & 0xFF; return b; }
    return new _Buffer(typeof data === 'number' ? data : 0);
  }
  static alloc(size, fill) {
    const b = new _Buffer(size);
    if (fill !== undefined) { if (typeof fill === 'number') b.fill(fill); else if (typeof fill === 'string') { const e = _enc.encode(fill); for (let i = 0; i < size; i++) b[i] = e[i % e.length]; } }
    return b;
  }
  static allocUnsafe(size) { return new _Buffer(size); }
  static isBuffer(obj) { return obj instanceof _Buffer; }
  static isEncoding(enc) { return ['utf8','utf-8','ascii','latin1','binary','hex','base64','utf16le','utf-16le'].includes(enc); }
  static concat(list, len) {
    if (len === undefined) len = list.reduce((s, b) => s + b.length, 0);
    const r = new _Buffer(len); let off = 0;
    for (const b of list) {
      if (off >= len) break;
      const toCopy = Math.min(b.length, len - off);
      r.set(b.subarray(0, toCopy), off);
      off += toCopy;
    }
    return r;
  }
  static compare(a, b) {
    for (let i = 0; i < Math.min(a.length, b.length); i++) { if (a[i] < b[i]) return -1; if (a[i] > b[i]) return 1; } return a.length - b.length;
  }
  toString(encoding, start, end) {
    const sl = (start !== undefined || end !== undefined) ? this.subarray(start || 0, end) : this;
    if (!encoding || encoding === 'utf8' || encoding === 'utf-8') return _dec.decode(sl);
    if (encoding === 'utf16le' || encoding === 'utf-16le') return _dec16.decode(sl);
    if (encoding === 'hex') return Array.from(sl).map(b => b.toString(16).padStart(2, '0')).join('');
    if (encoding === 'base64') {
      const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
      let r = '', i = 0;
      while (i < sl.length) {
        const a = sl[i++], b = i < sl.length ? sl[i++] : -1, c = i < sl.length ? sl[i++] : -1;
        r += B64[a >> 2];
        if (b === -1) { r += B64[(a & 3) << 4] + '=='; }
        else if (c === -1) { r += B64[((a & 3) << 4) | (b >> 4)] + B64[(b & 15) << 2] + '='; }
        else { r += B64[((a & 3) << 4) | (b >> 4)] + B64[((b & 15) << 2) | (c >> 6)] + B64[c & 63]; }
      }
      return r;
    }
    if (encoding === 'ascii') return Array.from(sl).map(b => String.fromCharCode(b & 0x7F)).join('');
    if (encoding === 'latin1' || encoding === 'binary') return Array.from(sl).map(b => String.fromCharCode(b)).join('');
    return _dec.decode(sl);
  }
  write(string, offset, length, encoding) {
    if (typeof offset === 'string') { encoding = offset; offset = 0; length = this.length; }
    if (typeof length === 'string') { encoding = length; length = this.length - (offset || 0); }
    offset = offset || 0;
    const bytes = _enc.encode(string);
    const count = Math.min(bytes.length, length !== undefined ? length : bytes.length, this.length - offset);
    for (let i = 0; i < count; i++) this[offset + i] = bytes[i];
    return count;
  }
  slice(start, end) { return this.subarray(start, end); }
  copy(target, tStart, sStart, sEnd) {
    sStart = sStart || 0; sEnd = sEnd !== undefined ? sEnd : this.length; tStart = tStart || 0;
    for (let i = sStart; i < sEnd; i++) target[tStart + i - sStart] = this[i];
    return sEnd - sStart;
  }
  readUInt8(offset) { return this[offset]; }
  readInt8(offset) { const v = this[offset]; return v >= 128 ? v - 256 : v; }
  readUInt16LE(offset) { return this[offset] | (this[offset+1] << 8); }
  readUInt32LE(offset) { return (this[offset] | (this[offset+1] << 8) | (this[offset+2] << 16) | (this[offset+3] << 24)) >>> 0; }
  readInt32LE(offset) { return this[offset] | (this[offset+1] << 8) | (this[offset+2] << 16) | (this[offset+3] << 24); }
}
globalThis.Buffer = _Buffer;

// ---- OS flags ----

const O_RDONLY = typeof os !== 'undefined' && os.O_RDONLY !== undefined ? os.O_RDONLY : 0;
const O_WRONLY = typeof os !== 'undefined' && os.O_WRONLY !== undefined ? os.O_WRONLY : 1;
const O_CREAT  = typeof os !== 'undefined' && os.O_CREAT  !== undefined ? os.O_CREAT  : 64;
const O_TRUNC  = typeof os !== 'undefined' && os.O_TRUNC  !== undefined ? os.O_TRUNC  : 512;
const O_APPEND = typeof os !== 'undefined' && os.O_APPEND !== undefined ? os.O_APPEND : 1024;

function _flagsToOs(flags) {
  if (flags === 'r')  return O_RDONLY;
  if (flags === 'w')  return O_WRONLY | O_CREAT | O_TRUNC;
  if (flags === 'a')  return O_WRONLY | O_CREAT | O_APPEND;
  if (flags === 'r+') return 2; // O_RDWR
  if (flags === 'w+') return 2 | O_CREAT | O_TRUNC;
  return O_RDONLY;
}

function _makeErr(code, path) {
  const msg = code === 'ENOENT' ? `ENOENT: no such file or directory, '${path}'`
            : code === 'EEXIST' ? `EEXIST: file already exists, '${path}'`
            : `${code}: operation failed, '${path}'`;
  return Object.assign(new Error(msg), { code, path });
}

// ---- fs module ----

function _makeStat(st) {
  const S_IFMT = 0o170000, S_IFDIR = 0o040000, S_IFREG = 0o100000, S_IFLNK = 0o120000;
  return {
    mode: st.mode, size: st.size,
    mtime: new Date(st.mtime * 1000), mtimeMs: st.mtime * 1000,
    isFile()            { return (st.mode & S_IFMT) === S_IFREG; },
    isDirectory()       { return (st.mode & S_IFMT) === S_IFDIR; },
    isSymbolicLink()    { return (st.mode & S_IFMT) === S_IFLNK; },
    isBlockDevice()     { return false; },
    isCharacterDevice() { return false; },
    isFIFO()            { return false; },
    isSocket()          { return false; },
  };
}

const _fsModule = {
  readFileSync(filePath, encoding) {
    if (!encoding) {
      // Must return a Buffer with indexed byte access
      const [st, err] = os.stat(filePath);
      if (err !== 0) throw _makeErr('ENOENT', filePath);
      const size = st.size;
      const buf = new _Buffer(size);
      const fd = os.open(filePath, O_RDONLY);
      if (fd < 0) throw _makeErr('ENOENT', filePath);
      let off = 0;
      while (off < size) {
        const n = os.read(fd, buf.buffer, off, size - off);
        if (n <= 0) break;
        off += n;
      }
      os.close(fd);
      return buf;
    }
    const content = std.loadFile(filePath);
    if (content === null) throw _makeErr('ENOENT', filePath);
    return content;
  },

  writeFileSync(filePath, data, options) {
    const f = std.open(filePath, 'w');
    if (!f) throw _makeErr('ENOENT', filePath);
    f.puts(typeof data === 'string' ? data : (data.toString ? data.toString('utf8') : String(data)));
    f.flush(); f.close();
  },

  appendFileSync(filePath, data) {
    const f = std.open(filePath, 'a');
    if (!f) throw _makeErr('ENOENT', filePath);
    f.puts(typeof data === 'string' ? data : String(data));
    f.flush(); f.close();
  },

  openSync(filePath, flags, mode) {
    const fd = os.open(filePath, _flagsToOs(flags), mode || 0o666);
    if (fd < 0) throw _makeErr('ENOENT', filePath);
    return fd;
  },

  writeSync(fd, data, position, encoding) {
    const bytes = typeof data === 'string' ? _enc.encode(data) : data;
    os.write(fd, bytes.buffer || bytes, bytes.byteOffset || 0, bytes.byteLength || bytes.length);
  },

  closeSync(fd) {
    os.close(fd);
  },

  existsSync(filePath) {
    const [, err] = os.stat(filePath);
    return err === 0;
  },

  statSync(filePath, options) {
    const [st, err] = os.stat(filePath);
    if (err !== 0) {
      if (options && options.throwIfNoEntry === false) return undefined;
      throw _makeErr('ENOENT', filePath);
    }
    return _makeStat(st);
  },

  lstatSync(filePath, options) {
    const statFn = os.lstat || os.stat;
    const [st, err] = statFn(filePath);
    if (err !== 0) {
      if (options && options.throwIfNoEntry === false) return undefined;
      throw _makeErr('ENOENT', filePath);
    }
    return _makeStat(st);
  },

  readdirSync(dirPath, options) {
    const [entries, err] = os.readdir(dirPath);
    if (err !== 0) throw _makeErr('ENOENT', dirPath);
    const names = entries.filter(e => e !== '.' && e !== '..');
    if (!options || !options.withFileTypes) return names;
    // Return dirent objects
    return names.map(name => {
      const full = dirPath.replace(/\/$/, '') + '/' + name;
      const [st, sterr] = os.stat(full);
      const S_IFMT = 0o170000, S_IFDIR = 0o040000, S_IFREG = 0o100000, S_IFLNK = 0o120000;
      const mode = sterr === 0 ? st.mode : 0;
      return {
        name,
        isFile()         { return (mode & S_IFMT) === S_IFREG; },
        isDirectory()    { return (mode & S_IFMT) === S_IFDIR; },
        isSymbolicLink() { return (mode & S_IFMT) === S_IFLNK; },
        isBlockDevice()  { return false; },
        isCharacterDevice() { return false; },
        isFIFO()         { return false; },
        isSocket()       { return false; },
      };
    });
  },

  mkdirSync(dirPath, options) {
    if (options && options.recursive) {
      const abs = dirPath.startsWith('/');
      const parts = dirPath.replace(/\/+$/, '').split('/').filter(Boolean);
      let cur = abs ? '' : os.getcwd()[0];
      for (const p of parts) {
        cur = (cur ? cur + '/' : '/') + p;
        const [, err] = os.stat(cur);
        if (err !== 0) os.mkdir(cur, 0o755);
      }
    } else {
      const err = os.mkdir(dirPath, 0o755);
      if (err !== 0) throw _makeErr('EEXIST', dirPath);
    }
  },

  realpathSync: Object.assign(
    (filePath) => { const [r, err] = os.realpath(filePath); if (err !== 0) throw _makeErr('ENOENT', filePath); return r; },
    { native: (filePath) => { const [r, err] = os.realpath(filePath); if (err !== 0) throw _makeErr('ENOENT', filePath); return r; } }
  ),

  watch(path, options, cb) { return { close() {}, on() { return this; } }; },
  watchFile(path, options, cb) {},
  unwatchFile(path, cb) {},

  createWriteStream(filePath, options) {
    const f = std.open(filePath, 'w');
    return {
      write(d) { if (f) f.puts(typeof d === 'string' ? d : d.toString()); return true; },
      end(d) { if (d && f) f.puts(typeof d === 'string' ? d : d.toString()); if (f) { f.flush(); f.close(); } },
      on() { return this; },
    };
  },
};

// ---- path module ----

const _pathModule = {
  sep: '/',
  delimiter: ':',

  normalize(p) {
    if (!p) return '.';
    const abs = p.startsWith('/');
    const parts = p.split('/');
    const out = [];
    for (const s of parts) {
      if (s === '' || s === '.') continue;
      if (s === '..') { if (out.length && out[out.length-1] !== '..') out.pop(); else if (!abs) out.push('..'); }
      else out.push(s);
    }
    return (abs ? '/' : '') + (out.join('/') || '.');
  },

  join(...parts) { return this.normalize(parts.filter(Boolean).join('/')); },

  resolve(...parts) {
    let r = os.getcwd()[0];
    for (const p of parts) { r = p.startsWith('/') ? p : r + '/' + p; }
    return this.normalize(r);
  },

  dirname(p) {
    if (!p) return '.';
    const s = p.replace(/\/+$/, '');
    const i = s.lastIndexOf('/');
    if (i === -1) return '.'; if (i === 0) return '/';
    return s.slice(0, i);
  },

  basename(p, ext) {
    const s = p.replace(/\/+$/, '');
    let b = s.slice(s.lastIndexOf('/') + 1);
    if (ext && b.endsWith(ext)) b = b.slice(0, -ext.length);
    return b;
  },

  extname(p) { const b = this.basename(p); const i = b.lastIndexOf('.'); return i > 0 ? b.slice(i) : ''; },

  relative(from, to) {
    const f = this.resolve(from).split('/').filter(Boolean);
    const t = this.resolve(to).split('/').filter(Boolean);
    let i = 0; while (i < f.length && f[i] === t[i]) i++;
    return [...Array(f.length - i).fill('..'), ...t.slice(i)].join('/') || '.';
  },

  isAbsolute(p) { return typeof p === 'string' && p.startsWith('/'); },

  parse(p) {
    const dir = this.dirname(p), base = this.basename(p), ext = this.extname(p);
    return { root: p.startsWith('/') ? '/' : '', dir, base, ext, name: ext ? base.slice(0, -ext.length) : base };
  },

  format(o) {
    const dir = o.dir || o.root || '';
    const base = o.base || ((o.name || '') + (o.ext || ''));
    return dir ? dir + '/' + base : base;
  },
};

// ---- os module (Node.js style) ----

const _osModule = {
  EOL: '\n',
  platform() { return 'linux'; },
  homedir() { return std.getenv('HOME') || '/root'; },
  tmpdir() { return std.getenv('TMPDIR') || '/tmp'; },
  arch() { return 'x64'; },
  type() { return 'Linux'; },
  release() { return '6.0.0'; },
  cpus() { return [{ model: 'QuickJS', speed: 1000, times: { user: 0, nice: 0, sys: 0, idle: 0, irq: 0 } }]; },
  networkInterfaces() { return {}; },
  freemem() { return 1 << 30; },
  totalmem() { return 4 << 30; },
  hostname() { return 'localhost'; },
  userInfo() { return { username: std.getenv('USER') || 'user', uid: 1000, gid: 1000, shell: '/bin/sh', homedir: std.getenv('HOME') || '/root' }; },
};

// ---- require ----

function require(name) {
  switch (name) {
    case 'fs':     return _fsModule;
    case 'path':   return _pathModule;
    case 'os':     return _osModule;
    case 'buffer': return { Buffer: _Buffer };
    case 'crypto': throw new Error('crypto not available'); // triggers fallback to generateDjb2Hash
    case 'util':   return {
      format(fmt, ...a) { return a.reduce((s, v) => s.replace(/%[sdoj]/, String(v)), fmt); },
      inspect(v) { try { return JSON.stringify(v); } catch { return String(v); } },
      promisify(fn) { return (...a) => new Promise((res, rej) => fn(...a, (e, v) => e ? rej(e) : res(v))); },
      inherits(C, P) { C.prototype = Object.create(P.prototype, { constructor: { value: C } }); },
    };
    case 'assert': return {
      ok(v, m)           { if (!v) throw new Error(m || 'Assertion failed'); },
      equal(a, b, m)     { if (a != b) throw new Error(m || `${a} != ${b}`); },
      strictEqual(a,b,m) { if (a !== b) throw new Error(m || `${a} !== ${b}`); },
    };
    case 'v8':          return { writeHeapSnapshot() {}, getHeapStatistics() { return {}; } };
    case 'perf_hooks':  return { performance: { now() { return Date.now(); }, mark() {}, measure() {} } };
    case 'inspector':   return { Session: class { connect(){} post(m,p,cb){if(cb)cb(null,{});} disconnect(){} } };
    case 'source-map-support': throw new Error('source-map-support not available');
    default: throw new Error(`Cannot find module '${name}'`);
  }
}

// ---- process ----

const _envOverrides = {};
const _scriptPath = _pathModule.resolve((typeof scriptArgs !== 'undefined' && scriptArgs[0]) || 'tsc.js');
const _scriptArgs = (typeof scriptArgs !== 'undefined') ? scriptArgs.slice(1) : [];

const process = {
  argv: ['qjs', _scriptPath, ..._scriptArgs],
  execArgv: [],
  platform: 'linux',
  arch: 'x64',
  version: 'v18.0.0',
  versions: { node: '18.0.0' },
  browser: false,
  env: new Proxy({}, {
    get(_, k) { if (typeof k === 'string') { if (k in _envOverrides) return _envOverrides[k]; const v = std.getenv(k); return v !== null ? v : undefined; } },
    has(_, k) { return k in _envOverrides || std.getenv(k) !== null; },
    set(_, k, v) { _envOverrides[k] = String(v); return true; },
  }),
  cwd() { return os.getcwd()[0]; },
  chdir(d) { os.chdir(d); },
  exit(code) { std.exit(code !== undefined ? code : 0); },
  stdout: {
    write(s) { std.out.puts(s); std.out.flush(); return true; },
    isTTY: false, columns: 80,
    _handle: null,
    on() { return this; },
  },
  stderr: {
    write(s) { std.err.puts(s); std.err.flush(); return true; },
    isTTY: false,
    on() { return this; },
  },
  stdin: { isTTY: false, on() { return this; }, read() { return null; } },
  nextTick(fn, ...args) { fn(...args); },
  hrtime(prev) {
    const ms = Date.now(), s = Math.floor(ms / 1000), ns = (ms % 1000) * 1e6;
    if (prev) { let ds = s - prev[0], dns = ns - prev[1]; if (dns < 0) { ds -= 1; dns += 1e9; } return [ds, dns]; }
    return [s, ns];
  },
  memoryUsage() { return { rss: 0, heapTotal: 0, heapUsed: 0, external: 0, arrayBuffers: 0 }; },
  on() { return this; },
  removeListener() { return this; },
  pid: 1, ppid: 0, title: 'qjs',
  recordreplay: undefined,
};
process.hrtime.bigint = () => BigInt(Date.now()) * 1000000n;

// ---- globals ----

var module = { exports: {}, id: _scriptPath, filename: _scriptPath, loaded: false };
var exports = module.exports;
var __filename = _scriptPath;
var __dirname = _pathModule.dirname(_scriptPath);

// ---- setTimeout fallback ----
if (typeof setTimeout === 'undefined') {
  globalThis.setTimeout = function(fn, delay, ...args) { return 0; };
  globalThis.clearTimeout = function() {};
  globalThis.setInterval = function(fn, delay, ...args) { return 0; };
  globalThis.clearInterval = function() {};
}
