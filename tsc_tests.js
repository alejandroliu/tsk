// Tests for the TypeScript compiler (tsc) running under node_shim.js
// Run with: qjs --std -I node_shim.js -I test_runner.js tsc_tests.js

const TMP = '/tmp/tsc_test_' + Date.now();
os.mkdir(TMP, 0o755);

// ---- helpers ----

const fs = require('fs');

const CWD = process.cwd();
const SHIM = CWD + '/node_shim.js';
const TSC  = CWD + '/typescript-5.4.5/tsc.js';

function tsc(...args) {
  return os.exec(['qjs', '--std', '-I', SHIM, TSC, ...args], { usePath: true });
}

// Run tsc and capture combined stdout+stderr to a string.
let _n = 0;
function tscOutput(...args) {
  const out = TMP + '/cap' + (_n++) + '.txt';
  const script = TMP + '/run' + (_n++) + '.sh';
  const sq = s => "'" + s.replace(/'/g, "'\\''") + "'";
  const parts = ['qjs', '--std', '-I', SHIM, TSC, ...args].map(sq).join(' ');
  fs.writeFileSync(script, '#!/bin/sh\n' + parts + ' >' + sq(out) + ' 2>&1\n');
  os.exec(['sh', script], { usePath: true });
  return fs.readFileSync(out, 'utf8');
}

// Write a uniquely-named .ts source file in TMP and return its path.
function src(content) {
  const p = TMP + '/s' + (_n++) + '.ts';
  fs.writeFileSync(p, content);
  return p;
}

// ============================================================
// tsc --version
// ============================================================

section('tsc --version');

test('exits 0', () => {
  eq(tsc('--version'), 0);
});

test('output contains version number', () => {
  const out = tscOutput('--version');
  assert(out.includes('5.4.5'), 'expected "5.4.5" in output, got: ' + out.trim());
});

// ============================================================
// tsc --noEmit
// ============================================================

section('tsc --noEmit');

test('valid file exits 0', () => {
  eq(tsc('--noEmit', src('const n: number = 1; console.log(n);\n')), 0);
});

test('type-error file exits non-zero', () => {
  assert(tsc('--noEmit', src('const n: number = "oops";\n')) !== 0);
});

// ============================================================
// tsc emit
// ============================================================

section('tsc emit');

test('produces .js output file', () => {
  const s = src('const x: string = "hello"; console.log(x);\n');
  eq(tsc('--target', 'es2020', '--outDir', TMP, s), 0);
  assert(fs.existsSync(s.replace('.ts', '.js')));
  assert(fs.readFileSync(s.replace('.ts', '.js'), 'utf8').includes('console.log'));
});

// ============================================================
// --target es5 downcompilation
// ============================================================

section('--target es5 downcompilation');

test('arrow functions compiled to function expressions', () => {
  const s = src('const add = (a: number, b: number): number => a + b;\n');
  eq(tsc('--target', 'es5', '--outDir', TMP, s), 0);
  const js = fs.readFileSync(s.replace('.ts', '.js'), 'utf8');
  assert(js.includes('function'), 'expected "function" keyword in output');
  assert(!js.includes('=>'), 'expected arrow to be compiled away');
});

test('template literals compiled to string concatenation', () => {
  const s = src('const who = "world"; const msg = `Hello, ${who}!`;\n');
  eq(tsc('--target', 'es5', '--outDir', TMP, s), 0);
  const js = fs.readFileSync(s.replace('.ts', '.js'), 'utf8');
  assert(!js.includes('`'), 'expected template literal backtick to be compiled away');
  assert(js.includes('"Hello, "'), 'expected string concatenation in output');
});

test('async/await compiled to __awaiter helper', () => {
  const s = src('async function fetchData(): Promise<string> { return "data"; }\n');
  eq(tsc('--target', 'es5', '--lib', 'es2015', '--outDir', TMP, s), 0);
  const js = fs.readFileSync(s.replace('.ts', '.js'), 'utf8');
  assert(js.includes('__awaiter'), 'expected __awaiter helper in ES5 async output');
});

test('optional chaining compiled away for es5', () => {
  const s = src('const obj: { a?: { b: number } } | null = null; const x = obj?.a?.b;\n');
  eq(tsc('--target', 'es5', '--outDir', TMP, s), 0);
  const js = fs.readFileSync(s.replace('.ts', '.js'), 'utf8');
  assert(!js.includes('?.'), 'expected optional chaining to be compiled away for ES5');
});

// ============================================================
// --target es2020 output
// ============================================================

section('--target es2020 output');

test('optional chaining preserved', () => {
  const s = src('const obj: { a?: { b: number } } | null = null; const x = obj?.a?.b;\n');
  eq(tsc('--target', 'es2020', '--outDir', TMP, s), 0);
  const js = fs.readFileSync(s.replace('.ts', '.js'), 'utf8');
  assert(js.includes('?.'), 'expected ?. to survive in ES2020 output');
});

// ============================================================
// emit flags
// ============================================================

section('emit flags');

test('--declaration produces .d.ts file', () => {
  const s = src('export function greet(name: string): string { return "Hello, " + name; }\n');
  eq(tsc('--declaration', '--outDir', TMP, s), 0);
  const dts = s.replace('.ts', '.d.ts');
  assert(fs.existsSync(dts), 'expected .d.ts file to exist');
  const content = fs.readFileSync(dts, 'utf8');
  assert(content.includes('greet'), 'expected function name in .d.ts');
  assert(content.includes('string'), 'expected type annotation in .d.ts');
});

test('--sourceMap produces .js.map file', () => {
  const s = src('const x: number = 42;\n');
  eq(tsc('--sourceMap', '--outDir', TMP, s), 0);
  const map = s.replace('.ts', '.js.map');
  assert(fs.existsSync(map), 'expected .js.map file to exist');
  assert(fs.readFileSync(map, 'utf8').includes('mappings'), 'expected source map data');
});

test('--removeComments strips comments from output', () => {
  const s = src('// line comment\nconst x: number = 1; /* block */ console.log(x);\n');
  eq(tsc('--removeComments', '--outDir', TMP, s), 0);
  const js = fs.readFileSync(s.replace('.ts', '.js'), 'utf8');
  assert(!js.includes('line comment'), 'expected line comment to be stripped');
  assert(!js.includes('block'), 'expected block comment to be stripped');
});

test('--outFile bundles multiple script files into one', () => {
  const a = TMP + '/bundle_a.ts';
  const b = TMP + '/bundle_b.ts';
  const out = TMP + '/bundle.js';
  fs.writeFileSync(a, 'function greet(name: string): string { return "Hello, " + name; }\n');
  fs.writeFileSync(b, 'console.log(greet("world"));\n');
  eq(tsc('--module', 'none', '--outFile', out, a, b), 0);
  assert(fs.existsSync(out), 'expected bundle.js to exist');
  const js = fs.readFileSync(out, 'utf8');
  assert(js.includes('greet'), 'expected greet function in bundle');
  assert(js.includes('console.log'), 'expected console.log in bundle');
});

// ============================================================
// type-system errors
// ============================================================

section('type-system errors');

test('missing required property is an error', () => {
  assert(tsc('--noEmit', src('const p: { x: number; y: number } = { x: 1 };\n')) !== 0);
});

test('wrong number of arguments is an error', () => {
  assert(tsc('--noEmit', src(
    'function add(a: number, b: number): number { return a + b; } add(1);\n'
  )) !== 0);
});

test('--strict rejects implicit any on function parameters', () => {
  assert(tsc('--strict', '--noEmit', src('function identity(x) { return x; }\n')) !== 0);
});

test('--strictNullChecks rejects access on possibly-null value', () => {
  assert(tsc('--strictNullChecks', '--noEmit', src(
    'function getLength(s: string | null): number { return s.length; }\n'
  )) !== 0);
});

// ============================================================
// TypeScript features in emitted output
// ============================================================

section('TypeScript features in emitted output');

test('interfaces are erased from JS output', () => {
  const s = src(
    'interface Point { x: number; y: number; }\n' +
    'function dist(p: Point): number { return Math.sqrt(p.x * p.x + p.y * p.y); }\n'
  );
  eq(tsc('--target', 'es2020', '--outDir', TMP, s), 0);
  const js = fs.readFileSync(s.replace('.ts', '.js'), 'utf8');
  assert(!js.includes('interface'), 'expected interface keyword to be erased');
  assert(js.includes('dist'), 'expected function to remain');
});

test('enums compile to runtime object', () => {
  const s = src('enum Color { Red, Green, Blue }\nconsole.log(Color.Red);\n');
  eq(tsc('--target', 'es2020', '--outDir', TMP, s), 0);
  const js = fs.readFileSync(s.replace('.ts', '.js'), 'utf8');
  assert(js.includes('Color'), 'expected enum name in output');
  // TypeScript enum IIFE assigns numeric values
  assert(js.includes('0'), 'expected enum value 0 in output');
});

test('type assertions are stripped from JS output', () => {
  const s = src('const x: any = "hello";\nconst y = x as string;\nconsole.log(y);\n');
  eq(tsc('--target', 'es2020', '--outDir', TMP, s), 0);
  const js = fs.readFileSync(s.replace('.ts', '.js'), 'utf8');
  assert(!js.includes(' as '), 'expected "as" assertion to be stripped');
  assert(js.includes('console.log'), 'expected console.log to remain');
});

// ============================================================
// multi-file compilation
// ============================================================

section('multi-file compilation');

test('multiple valid files compiled together exit 0', () => {
  const a = TMP + '/multi_a.ts';
  const b = TMP + '/multi_b.ts';
  fs.writeFileSync(a, 'export function square(n: number): number { return n * n; }\n');
  fs.writeFileSync(b, 'import { square } from "./multi_a"; console.log(square(4));\n');
  eq(tsc('--module', 'commonjs', '--outDir', TMP, a, b), 0);
});

test('cross-file type error is caught', () => {
  const a = TMP + '/cross_a.ts';
  const b = TMP + '/cross_b.ts';
  fs.writeFileSync(a, 'export function greet(name: string): string { return "Hi, " + name; }\n');
  fs.writeFileSync(b, 'import { greet } from "./cross_a"; greet(42);\n');
  assert(tsc('--module', 'commonjs', '--noEmit', a, b) !== 0);
});

// ============================================================
// tsconfig.json
// ============================================================

section('tsconfig.json');

test('--project catches noImplicitAny violation', () => {
  const d = TMP + '/proj1';
  fs.mkdirSync(d);
  fs.writeFileSync(d + '/tsconfig.json', JSON.stringify({
    compilerOptions: { noImplicitAny: true, noEmit: true }
  }));
  fs.writeFileSync(d + '/main.ts', 'function identity(x) { return x; }\n');
  assert(tsc('--project', d) !== 0);
});

test('--project with include picks up files automatically', () => {
  const d = TMP + '/proj2';
  fs.mkdirSync(d);
  fs.mkdirSync(d + '/src');
  fs.writeFileSync(d + '/tsconfig.json', JSON.stringify({
    compilerOptions: { noEmit: true },
    include: ['src/**/*.ts']
  }));
  fs.writeFileSync(d + '/src/index.ts', 'const x: number = 42; console.log(x);\n');
  eq(tsc('--project', d), 0);
});

// ============================================================
// error output format
// ============================================================

section('error output format');

test('diagnostic contains filename(line,col) and error code', () => {
  const s = src('const n: number = "wrong";\n');
  const out = tscOutput('--noEmit', s);
  assert(out.includes('error TS'), 'expected "error TS" in output, got: ' + out.trim());
  assert(out.includes('.ts('), 'expected filename(line,col) in output, got: ' + out.trim());
});

// ============================================================
// edge cases
// ============================================================

section('edge cases');

test('empty .ts file exits 0', () => {
  eq(tsc('--noEmit', src('')), 0);
});

test('comments-only file exits 0', () => {
  eq(tsc('--noEmit', src('// just a comment\n/* block */\n')), 0);
});

test('non-existent input file exits non-zero', () => {
  assert(tsc('--noEmit', TMP + '/does_not_exist.ts') !== 0);
});

// ============================================================
// generics type erasure
// ============================================================

section('generics type erasure');

test('generic function: type parameter stripped from JS', () => {
  const s = src(
    'function identity<T>(x: T): T { return x; }\n' +
    'const r = identity<string>("hello");\n'
  );
  eq(tsc('--target', 'es2020', '--outDir', TMP, s), 0);
  const js = fs.readFileSync(s.replace('.ts', '.js'), 'utf8');
  assert(!js.includes('<T>'), 'expected <T> to be erased');
  assert(!js.includes('<string>'), 'expected type argument <string> to be erased');
  assert(js.includes('identity'), 'expected function name to remain');
});

test('generic class: type parameter stripped from JS', () => {
  const s = src(
    'class Box<T> {\n' +
    '  constructor(public value: T) {}\n' +
    '  get(): T { return this.value; }\n' +
    '}\n'
  );
  eq(tsc('--target', 'es2020', '--outDir', TMP, s), 0);
  const js = fs.readFileSync(s.replace('.ts', '.js'), 'utf8');
  assert(!js.includes('<T>'), 'expected <T> to be erased');
  assert(js.includes('class Box'), 'expected class name to remain');
});

// ============================================================
// class compilation
// ============================================================

section('class compilation');

test('class syntax preserved on ES2020 target', () => {
  const s = src(
    'class Animal {\n' +
    '  constructor(private name: string) {}\n' +
    '  speak(): string { return this.name + " speaks"; }\n' +
    '}\n'
  );
  eq(tsc('--target', 'es2020', '--outDir', TMP, s), 0);
  const js = fs.readFileSync(s.replace('.ts', '.js'), 'utf8');
  assert(js.includes('class Animal'), 'expected class keyword to be preserved');
  assert(js.includes('speak()'), 'expected method shorthand syntax');
  assert(!js.includes('prototype'), 'expected no prototype-based method assignment');
});

test('class downcompiled to constructor function on ES5 target', () => {
  const s = src(
    'class Animal {\n' +
    '  constructor(private name: string) {}\n' +
    '  speak(): string { return this.name + " speaks"; }\n' +
    '}\n'
  );
  eq(tsc('--target', 'es5', '--outDir', TMP, s), 0);
  const js = fs.readFileSync(s.replace('.ts', '.js'), 'utf8');
  assert(!js.includes('class Animal'), 'expected class keyword to be compiled away');
  assert(js.includes('function Animal'), 'expected constructor function in output');
  assert(js.includes('prototype.speak'), 'expected prototype-based method assignment');
});

// ============================================================
// enum values and patterns
// ============================================================

section('enum values and patterns');

test('numeric enum IIFE assigns values and reverse-maps names', () => {
  const s = src('enum Color { Red, Green, Blue }\n');
  eq(tsc('--target', 'es2020', '--outDir', TMP, s), 0);
  const js = fs.readFileSync(s.replace('.ts', '.js'), 'utf8');
  assert(js.includes('Color["Red"] = 0'), 'expected forward mapping Color["Red"] = 0');
  assert(js.includes('] = "Red"'),   'expected reverse mapping back to "Red"');
  assert(js.includes('] = "Green"'), 'expected reverse mapping back to "Green"');
});

test('string enum assigns string values without reverse mapping', () => {
  const s = src('enum Direction { Up = "UP", Down = "DOWN" }\n');
  eq(tsc('--target', 'es2020', '--outDir', TMP, s), 0);
  const js = fs.readFileSync(s.replace('.ts', '.js'), 'utf8');
  assert(js.includes('"UP"'),  'expected string value "UP" in output');
  assert(js.includes('"DOWN"'), 'expected string value "DOWN" in output');
  assert(!js.includes('Direction["UP"]'), 'expected no reverse mapping for string enum');
});

test('const enum is fully inlined — no runtime object emitted', () => {
  const s = src(
    'const enum Size { Small = 1, Medium = 2, Large = 3 }\n' +
    'const s = Size.Small;\n' +
    'const m = Size.Medium;\n'
  );
  eq(tsc('--target', 'es2020', '--removeComments', '--outDir', TMP, s), 0);
  const js = fs.readFileSync(s.replace('.ts', '.js'), 'utf8');
  assert(!js.includes('Size'), 'expected const enum to be fully erased after removeComments');
  assert(js.includes('= 1;'), 'expected inlined value 1 for Small');
  assert(js.includes('= 2;'), 'expected inlined value 2 for Medium');
});

// ============================================================
// async/await
// ============================================================

section('async/await');

test('real await expression emits __awaiter and __generator on ES5', () => {
  const s = src(
    'async function process(data: string): Promise<string> {\n' +
    '  const result = await Promise.resolve(data.toUpperCase());\n' +
    '  return result;\n' +
    '}\n'
  );
  eq(tsc('--target', 'es5', '--lib', 'es2015', '--outDir', TMP, s), 0);
  const js = fs.readFileSync(s.replace('.ts', '.js'), 'utf8');
  assert(js.includes('__awaiter'),  'expected __awaiter helper');
  assert(js.includes('__generator'), 'expected __generator helper');
});

test('async/await keywords preserved on ES2017 target', () => {
  const s = src(
    'async function fetchData(): Promise<string> {\n' +
    '  const result = await Promise.resolve("data");\n' +
    '  return result;\n' +
    '}\n'
  );
  eq(tsc('--target', 'es2017', '--lib', 'es2017', '--outDir', TMP, s), 0);
  const js = fs.readFileSync(s.replace('.ts', '.js'), 'utf8');
  assert(js.includes('async '),    'expected async keyword to be preserved on ES2017');
  assert(js.includes('await '),    'expected await keyword to be preserved on ES2017');
  assert(!js.includes('__awaiter'), 'expected no __awaiter helper on ES2017');
});

// ============================================================
// JSX compilation
// ============================================================

section('JSX compilation');

test('--jsx react transforms JSX to React.createElement calls', () => {
  const tsx = TMP + '/greeting.tsx';
  fs.writeFileSync(tsx,
    'declare const React: any;\n' +
    'function Greeting(props: { name: string }) {\n' +
    '  return <div className="hello">Hello, {props.name}</div>;\n' +
    '}\n'
  );
  eq(tsc('--jsx', 'react', '--target', 'es2020', '--outDir', TMP, tsx), 0);
  const js = fs.readFileSync(tsx.replace('.tsx', '.js'), 'utf8');
  assert(js.includes('React.createElement'), 'expected React.createElement in output');
  assert(!js.includes('<div'), 'expected JSX syntax to be transformed away');
});

test('--jsx preserve keeps JSX syntax and outputs a .jsx file', () => {
  const tsx = TMP + '/preserved.tsx';
  fs.writeFileSync(tsx,
    'declare const React: any;\n' +
    'function Greeting(props: { name: string }) {\n' +
    '  return <div>Hello, {props.name}</div>;\n' +
    '}\n'
  );
  eq(tsc('--jsx', 'preserve', '--target', 'es2020', '--outDir', TMP, tsx), 0);
  const jsx = tsx.replace('.tsx', '.jsx');
  assert(fs.existsSync(jsx), 'expected .jsx output file to exist');
  const content = fs.readFileSync(jsx, 'utf8');
  assert(content.includes('<div>'), 'expected JSX syntax to be preserved');
  assert(!content.includes('React.createElement'), 'expected no createElement transformation');
});

// ============================================================
// cleanup & report
// ============================================================

rmdir(TMP);
reportResults();
