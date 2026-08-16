import js from '@eslint/js'

// Lexicon flattens block scope. Two sibling blocks each declaring `const value`
// fails with "Identifier 'value' has already been declared" — legal JavaScript
// everywhere else. No built-in rule covers this, because in real JS it isn't a
// problem, so it needs a custom one.
//
// Loop heads (`for (const track of ...)`) are deliberately NOT checked yet:
// the collision is confirmed for declarations inside block bodies, and flagging
// loop variables before probing them would produce false errors.
const noDuplicateBlockScopedNames = {
  meta: {
    type: 'problem',
    docs: { description: 'Disallow reusing a block-scoped name within one function scope' },
    schema: []
  },

  create(context) {
    // One record of declared names per function scope.
    const scopes = []

    function enterScope() {
      scopes.push(new Map())
    }

    function exitScope() {
      scopes.pop()
    }

    function declare(name, node) {
      const current = scopes[scopes.length - 1]

      if (!current) {
        return
      }

      if (current.has(name)) {
        context.report({
          node,
          message: `"${name}" is already declared in this action. Lexicon flattens block scope, so a name reused in a sibling block fails with "Identifier '${name}' has already been declared". Use a distinct name.`
        })
        return
      }

      current.set(name, node)
    }

    function collectNames(pattern, node) {
      if (!pattern) {
        return
      }

      if (pattern.type === 'Identifier') {
        declare(pattern.name, node)
      }
      // Destructuring is separately banned, so no need to walk patterns.
    }

    return {
      Program: enterScope,
      'Program:exit': exitScope,
      FunctionDeclaration: enterScope,
      'FunctionDeclaration:exit': exitScope,
      FunctionExpression: enterScope,
      'FunctionExpression:exit': exitScope,
      ArrowFunctionExpression: enterScope,
      'ArrowFunctionExpression:exit': exitScope,

      VariableDeclaration(node) {
        if (node.kind === 'var') {
          return
        }

        // Skip loop heads until their behaviour is probed.
        const parent = node.parent

        if (
          parent &&
          (parent.type === 'ForOfStatement' ||
            parent.type === 'ForInStatement' ||
            parent.type === 'ForStatement')
        ) {
          return
        }

        for (const declarator of node.declarations) {
          collectNames(declarator.id, declarator)
        }
      }
    }
  }
}

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
      // Real error: Unexpected token after inlineIf: ?: ? "0"
      // Same parser path as ?. — anything after a `?` that is not a ternary.
      selector: 'LogicalExpression[operator="??"]',
      message:
        'Lexicon\'s parser rejects nullish coalescing (??). Use an explicit check: `if (x === null) { x = fallback }`.'
    },
    {
      // Real error: Unexpected token after prop: w: function withDefault(value = "0")
      selector: 'AssignmentPattern',
      message:
        'Lexicon\'s parser rejects default values in parameters and destructuring. Assign the fallback in the function body instead.'
    },
    {
      // Real error: Unexpected token after prop: {: const { alpha } = source
      selector: 'ObjectPattern',
      message:
        'Lexicon\'s parser rejects object destructuring. Read the property explicitly: `const alpha = source.alpha`.'
    },
    {
      selector: 'ArrayPattern',
      message:
        'Lexicon\'s parser rejects array destructuring. Index explicitly: `const first = items[0]`.'
    },
    {
      // Assigning to an injected global HALTS the action silently, mid-statement.
      // No error, no log, and a surrounding try/catch does not run.
      // Note this targets the globals themselves — mutating a track or playlist
      // you were handed (`track.rating = 5`) is the normal way to persist changes.
      selector:
        'AssignmentExpression[left.type="MemberExpression"][left.object.name=/^_(vars|library|settings|storage|network|ui|helpers|files|musicplayer)$/]',
      message:
        'Assigning to an injected global silently halts the action in Lexicon — no error, no log, try/catch will not save you. Use a local variable instead.'
    },
    {
      // Real error: Static method or property access not permitted: Object.prototype
      selector: 'MemberExpression[object.name="Object"][property.name="prototype"]',
      message:
        'Lexicon blocks Object.prototype access. Use `Object.keys(obj).includes(key)` instead of Object.prototype.hasOwnProperty.call.'
    },
    {
      // Real error: Static method or property access not permitted: Object.assign
      // Object.keys / values / entries / fromEntries are all fine.
      selector: 'MemberExpression[object.name="Object"][property.name="assign"]',
      message:
        'Lexicon blocks Object.assign. Copy the properties you need explicitly, or build the object literally.'
    },
    {
      // Worse than blocked: these are stubbed and silently return undefined.
      // No error, no halt — the failure surfaces somewhere else entirely.
      selector: 'MemberExpression[object.name="Object"][property.name="freeze"]',
      message:
        'Object.freeze is stubbed in Lexicon and returns undefined instead of the object. Remove it.'
    },
    {
      selector: 'MemberExpression[object.name="Object"][property.name="getPrototypeOf"]',
      message:
        'Object.getPrototypeOf is stubbed in Lexicon and returns undefined. Check for the properties you need instead.'
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
      // try/catch is unusable in this sandbox, in two independent ways:
      //
      //   1. The catch parameter is never bound. `catch (err)` then touching
      //      `err` throws "err is not defined". Renaming does not help —
      //      `catch (errA)` fails with "errA is not defined".
      //   2. A try block whose body does NOT throw halts the action silently:
      //      no log, no error, nothing after it runs.
      //
      // Validate up front and throw a clear Error instead. A thrown error is
      // shown to the user, and is the only reliable failure path here.
      selector: 'TryStatement',
      message:
        'try/catch does not work in Lexicon: the catch parameter is never bound, and a try block that does not throw halts the action silently. Validate inputs up front and throw a clear Error instead.'
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
    plugins: {
      lexicon: {
        rules: {
          'no-duplicate-block-scoped-names': noDuplicateBlockScopedNames
        }
      }
    },
    rules: {
      ...js.configs.recommended.rules,
      ...SANDBOX_RULES,
      'lexicon/no-duplicate-block-scoped-names': 'error',
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
        fetch: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly'
      }
    },
    rules: {
      ...js.configs.recommended.rules
    }
  }
]
