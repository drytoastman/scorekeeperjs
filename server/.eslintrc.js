let rules = {
    'max-len': ['error', { code: 180, ignoreTemplateLiterals: true }],
    '@typescript-eslint/no-explicit-any': 'off',
    'space-before-function-paren': ['warn', {
        anonymous: 'never',
        named: 'never',
        asyncArrow: 'always'
    }],
    'no-useless-constructor': 'off', // this still fires when using private constructor args to set local
    'no-multi-spaces': 'off', // I like to visually align things
    'no-multiple-empty-lines': 'off',
    'key-spacing': 'off',
    'no-unused-vars': 'off',  // doesn't appear to work with typescript
    'padded-blocks': 'off',
    'no-debugger': 'off',
    'object-curly-spacing': ['warn', 'always', { objectsInObjects: false }],
    quotes: 'warn',
    indent: ['warn', 4, { SwitchCase: 1, CallExpression: { arguments: 'off' }}]

}

if (process.env.NODE_ENV === 'production') {
    rules = Object.assign(rules, {
        'no-debugger': 'error'
    })
}

module.exports = {
    root: true,
    env: {
        es6: true,
        node: true
    },
    extends: [
        'standard'
    ],
    globals: {
        Atomics: 'readonly',
        SharedArrayBuffer: 'readonly'
    },
    parser: '@typescript-eslint/parser',
    parserOptions: {
        ecmaVersion: 2018,
        sourceType: 'module'
    },
    plugins: [
        '@typescript-eslint'
    ],
    rules: rules
}
