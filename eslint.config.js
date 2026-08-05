import js from '@eslint/js'

// Globals Lexicon injects into every action script. Declared readonly so that
// `no-undef` catches typos like `_helper.Log` while still allowing real use.
const LEXICON_GLOBALS = {
  _vars: 'readonly',
  _library: 'readonly',
  _settings: 'readonly',
  _storage: 'readonly',
  _network: 'readonly',
  _ui: 'readonly',
  _helpers: 'readonly',
  _files: 'readonly',
  _musicplayer: 'readonly'
}

// Lexicon runs action scripts through a restricted parser. These rules encode
// the restrictions documented at
// https://www.lexicondj.com/docs/developers/plugin
// A plugin that violates them fails to load in the app, so they are errors.
const SANDBOX_RULES = {
  // "Don't use if-statement oneliners, but use curly brackets instead"
  curly: ['error', 'all'],

  // "Trailing semicolons after loops or brackets may result in an
  // 'unexpected token' error"
  'no-extra-semi': 'error',

  // "Explicitly set keys for your objects"
  'object-shorthand': ['error', 'never'],

  'no-restricted-syntax': [
    'error',
    {
      // "Don't use a do-while loop"
      selector: 'DoWhileStatement',
      message: 'Lexicon\'s parser rejects do-while loops. Use a while loop instead.'
    },

    // --- Undocumented restrictions, found by probing a real Lexicon. ---
    // See packages/harness/src/runtime-spec.js (SANDBOX_PARSER_FACTS).

    {
      // Real error: Unexpected token after inlineIf: ?: ? "71"
      // The ternary ?: is fine; it is specifically ?. that the parser chokes on.
      selector: 'ChainExpression',
      message:
        'Lexicon\'s parser rejects optional chaining (?.). Use an explicit check: `if (a && a.b)`.'
    },
    {
      // Real error: Static method or property access not permitted: Object.prototype
      selector: 'MemberExpression[object.name="Object"][property.name="prototype"]',
      message:
        'Lexicon blocks Object.prototype access. Use `Object.keys(obj).includes(key)` instead of Object.prototype.hasOwnProperty.call.'
    },
    {
      selector: 'MemberExpression[object.name="Array"][property.name="prototype"]',
      message: 'Lexicon blocks prototype access on built-ins.'
    },
    {
      selector: 'MemberExpression[object.name="Function"][property.name="prototype"]',
      message: 'Lexicon blocks prototype access on built-ins.'
    },
    {
      // A catch binding inside a nested function declaration failed at runtime
      // with "err is not defined", while a top-level try/catch works fine.
      selector: 'FunctionDeclaration TryStatement > CatchClause[param!=null]',
      message:
        'A catch binding inside a nested function does not work in Lexicon ("err is not defined"). Move the try/catch to the top level of the action.'
    },
    {
      selector: 'FunctionExpression TryStatement > CatchClause[param!=null]',
      message:
        'A catch binding inside a nested function does not work in Lexicon. Move the try/catch to the top level of the action.'
    },
    {
      selector: 'ArrowFunctionExpression TryStatement > CatchClause[param!=null]',
      message:
        'A catch binding inside a nested function does not work in Lexicon. Move the try/catch to the top level of the action.'
    },
    {
      selector: 'ImportDeclaration',
      message: 'Plugin scripts cannot use import. Each action file is standalone.'
    },
    {
      selector: 'ImportExpression',
      message: 'Plugin scripts cannot use dynamic import().'
    },
    {
      selector: 'ExportNamedDeclaration',
      message: 'Plugin scripts cannot use export.'
    },
    {
      selector: 'ExportDefaultDeclaration',
      message: 'Plugin scripts cannot use export.'
    },
    {
      selector: 'CallExpression[callee.name="require"]',
      message: 'Plugin scripts cannot use require(). The sandbox has no module system.'
    },
    {
      // Bundler-style and minifier-style output tends to violate the parser
      // restrictions, so keep sources hand-written and readable.
      selector: 'CallExpression[callee.object.name="Function"]',
      message: 'Do not construct functions dynamically in a plugin.'
    },
    {
      selector: 'NewExpression[callee.name="Function"]',
      message: 'Do not construct functions dynamically in a plugin.'
    }
  ],

  'no-restricted-globals': [
    'error',
    { name: 'window', message: 'The plugin sandbox has no window object.' },
    { name: 'document', message: 'The plugin sandbox has no document object.' },
    { name: 'process', message: 'The plugin sandbox has no process object.' },
    { name: 'require', message: 'The plugin sandbox has no module system.' },
    { name: 'module', message: 'The plugin sandbox has no module system.' },
    { name: 'fetch', message: 'Use _network.GET / _network.POST instead of fetch.' },
    { name: 'XMLHttpRequest', message: 'Use _network.GET / _network.POST instead.' }
  ],

  // Dynamic evaluation defeats the point of reviewing contributed code.
  'no-eval': 'error',
  'no-implied-eval': 'error',
  'no-new-func': 'error'
}

export default [
  {
    ignores: ['node_modules/**', 'dist/**', 'coverage/**']
  },

  // Plugin action scripts: the restricted sandbox dialect.
  {
    files: ['plugins/**/*.js'],
    ignores: ['plugins/**/__tests__/**'],
    languageOptions: {
      ecmaVersion: 2022,
      // Action files are executed as async function bodies, so top-level await
      // is legal even though they are not modules.
      sourceType: 'module',
      globals: LEXICON_GLOBALS
    },
    rules: {
      ...js.configs.recommended.rules,
      ...SANDBOX_RULES,
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }]
    }
  },

  // Tests and tooling are ordinary modern Node, no sandbox restrictions.
  {
    files: ['plugins/**/__tests__/**/*.js', 'packages/**/*.js', 'scripts/**/*.mjs', '*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        URL: 'readonly',
        Buffer: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly'
      }
    },
    rules: {
      ...js.configs.recommended.rules
    }
  }
]
