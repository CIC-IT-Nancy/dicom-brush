import globals from 'globals';
import tsEslint from 'typescript-eslint';
import js from "@eslint/js";
import importPlugin from "eslint-plugin-import";
import prettierRecommended from "eslint-plugin-prettier/recommended";
import stylistic from "@stylistic/eslint-plugin";

export default tsEslint.config({
    extends: [
        js.configs.recommended,
        importPlugin.flatConfigs.recommended,
        prettierRecommended,
        ...tsEslint.configs.recommended,
    ],
    files: ['**/*.{js,ts}'],
    languageOptions: {
        ecmaVersion: 2022,
        globals: globals.browser,
        parserOptions: {
            project: ['./tsconfig.eslint.json'],
            tsconfigRootDir: import.meta.dirname,
        },
    },
    plugins: {
        '@stylistic': stylistic,
    },
    rules: {
        'prettier/prettier': [
            'error',
            {
                singleQuote: true,
                trailingComma: 'all',
                tabWidth: 4,
                bracketSpacing: true,
                arrowParens: 'always',
                endOfLine: 'lf',
                semi: true,
            },
        ],
        'no-import-assign': 'error',
        'no-undef': [
            'error',
            {
                typeof: true,
            },
        ],
        'no-unexpected-multiline': 'error',
        'no-self-assign': 'error',
        'no-unreachable': 'error',
        'no-unreachable-loop': 'error',
        'no-unsafe-optional-chaining': 'error',
        'no-use-before-define': 'error',
        'no-useless-backreference': 'error',
        'valid-typeof': [
            'error',
            {
                requireStringLiterals: false,
            },
        ],
        camelcase: 'error',
        curly: 'error',
        eqeqeq: 'error',
        'no-shadow': 'error',
        'no-var': 'error',
        radix: 'error',
        semi: 'error',
        'import/first': 'error',
        'import/newline-after-import': 'error',
        'import/no-namespace': 'error',
        'import/no-empty-named-blocks': 'error',
        'import/no-useless-path-segments': 'error',
        'import/consistent-type-specifier-style': 'error',
        'import/no-unresolved': 'off',
        'import/order': [
            'error',
            {
                groups: [
                    'index',
                    'sibling',
                    'parent',
                    'internal',
                    'external',
                    'builtin',
                    'object',
                    'type',
                ],
                alphabetize: {
                    order: 'asc',
                    caseInsensitive: true,
                },
                'newlines-between': 'always',
            },
        ],

        '@typescript-eslint/array-type': [
            'error',
            {
                default: 'array-simple',
                readonly: 'array-simple',
            },
        ],

        '@typescript-eslint/ban-ts-comment': 'off',
        '@typescript-eslint/no-unsafe-function-type': 'off',
        '@typescript-eslint/consistent-indexed-object-style': 'error',
        '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
        '@typescript-eslint/consistent-type-exports': 'error',
        '@typescript-eslint/consistent-type-imports': 'error',
        '@typescript-eslint/member-ordering': 'error',
        '@typescript-eslint/method-signature-style': 'error',
        '@typescript-eslint/no-confusing-non-null-assertion': 'error',
        '@typescript-eslint/no-confusing-void-expression': 'error',
        '@typescript-eslint/no-duplicate-enum-values': 'error',
        '@typescript-eslint/no-duplicate-type-constituents': 'error',
        '@typescript-eslint/no-explicit-any': 'warn',
        '@typescript-eslint/no-extra-non-null-assertion': 'error',
        '@typescript-eslint/no-extraneous-class': 'error',
        '@typescript-eslint/no-for-in-array': 'error',
        '@typescript-eslint/no-import-type-side-effects': 'error',
        '@typescript-eslint/no-inferrable-types': 'error',
        '@typescript-eslint/no-misused-new': 'error',
        '@typescript-eslint/no-misused-promises': 'error',
        '@typescript-eslint/no-require-imports': 'error',
        '@typescript-eslint/no-this-alias': 'error',
        '@typescript-eslint/no-unnecessary-boolean-literal-compare': 'error',
        '@typescript-eslint/no-unnecessary-qualifier': 'error',
        '@typescript-eslint/no-unnecessary-type-arguments': 'error',
        '@typescript-eslint/no-unnecessary-type-assertion': 'error',
        '@typescript-eslint/no-unnecessary-type-constraint': 'error',
        '@typescript-eslint/no-unsafe-return': 'error',
        '@typescript-eslint/no-useless-empty-export': 'error',
        '@typescript-eslint/no-unused-vars': [
            'error',
            { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
        ],
        '@typescript-eslint/prefer-as-const': 'error',
        '@typescript-eslint/prefer-for-of': 'error',
        '@typescript-eslint/prefer-string-starts-ends-with': 'error',
        '@typescript-eslint/prefer-regexp-exec': 'error',
        '@typescript-eslint/prefer-ts-expect-error': 'warn',
        '@typescript-eslint/sort-type-constituents': 'error',
        '@typescript-eslint/switch-exhaustiveness-check': 'error',
        '@typescript-eslint/triple-slash-reference': 'error',
        '@typescript-eslint/unified-signatures': 'error',
        '@typescript-eslint/interface-name-prefix': 'off',
        '@typescript-eslint/explicit-function-return-type': 'off',
        '@typescript-eslint/explicit-module-boundary-types': 'off',
    },
});
