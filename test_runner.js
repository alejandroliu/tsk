// Shared test runner for shim_tests.js and tsc_tests.js
// Loaded via: qjs --std -I node_shim.js -I test_runner.js <test-file.js>

var _passed = 0, _failed = 0;

function section(name) {
  print('\n' + name);
}

function test(name, fn) {
  try {
    fn();
    _passed++;
    print('  pass  ' + name);
  } catch (e) {
    _failed++;
    print('  FAIL  ' + name);
    print('        ' + e.message);
  }
}

function assert(val, msg) {
  if (!val) throw new Error(msg || ('Expected truthy, got ' + JSON.stringify(val)));
}
function eq(a, b, msg) {
  if (a !== b) throw new Error(msg || ('Expected ' + JSON.stringify(b) + ', got ' + JSON.stringify(a)));
}
function deepEq(a, b, msg) {
  const sa = JSON.stringify(a), sb = JSON.stringify(b);
  if (sa !== sb) throw new Error(msg || ('Expected ' + sb + ', got ' + sa));
}
function throws(fn, codeOrMsg) {
  let threw = false;
  try { fn(); }
  catch (e) {
    threw = true;
    if (typeof codeOrMsg === 'string' && codeOrMsg.length <= 10) {
      if (e.code && e.code !== codeOrMsg) throw new Error('Expected code ' + codeOrMsg + ', got ' + e.code);
    }
  }
  if (!threw) throw new Error('Expected function to throw');
}

function rmdir(dir) {
  try {
    const entries = os.readdir(dir)[0] || [];
    for (const e of entries) {
      if (e === '.' || e === '..') continue;
      const full = dir + '/' + e;
      const [st] = os.stat(full);
      if (st && (st.mode & 0o170000) === 0o040000) rmdir(full);
      else os.remove(full);
    }
    os.remove(dir);
  } catch {}
}

function reportResults() {
  print('\n' + '─'.repeat(40));
  print('Results: ' + _passed + ' passed, ' + _failed + ' failed');
  if (_failed > 0) std.exit(1);
}
