// ESLint — Expo's defaults plus the design-system rules from
// docs/DESIGN_SYSTEM_FORTE.md §8, so the review checklist is enforced rather
// than remembered. https://docs.expo.dev/guides/using-eslint/

const HEX_COLOUR = /^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

const designSystem = [
  {
    selector: `Literal[value=${HEX_COLOUR}]`,
    message: 'No hex colours outside src/ui/tokens.ts. Use a token from useTheme().c (DESIGN_SYSTEM_FORTE.md §2.1).',
  },
  {
    // Literal values in style objects only: token references, and destructuring
    // a key away (useTextStyle's lineHeight on single-line inputs), are fine.
    selector: 'ObjectExpression > Property[key.name=/^(fontSize|fontFamily|fontWeight|lineHeight|letterSpacing)$/][value.type="Literal"]',
    message: 'No raw type styles. Use <Text variant>, or useTextStyle(variant) for inputs (DESIGN_SYSTEM_FORTE.md §2.2).',
  },
  {
    selector: 'ObjectExpression > Property[key.name=/^border(TopLeft|TopRight|BottomLeft|BottomRight)?Radius$/][value.type="Literal"]',
    message: 'No raw radii. Use radius.* — radius.pill for dots and thin bars (DESIGN_SYSTEM_FORTE.md §2.4).',
  },
  {
    selector: 'JSXAttribute[name.name="color"][value.value="accent"]',
    message: 'accent is a fill, never a text colour. Use textPrimary (with bodyStrong for text actions) (DESIGN_SYSTEM_FORTE.md §6).',
  },
];

module.exports = {
  extends: 'expo',
  // /Documents holds local design work (mockups, handover), never shipped.
  ignorePatterns: ['/dist/*', '/.expo/*', '/android/*', '/ios/*', 'expo-env.d.ts', '/vendor/qrcode/*', '/Documents/*'],
  rules: {
    'no-restricted-syntax': ['error', ...designSystem],
    'no-restricted-imports': [
      'error',
      {
        paths: [
          {
            name: 'react-native',
            importNames: ['Modal'],
            message: 'Use SystemModal from @/ui/SystemModal: a raw Modal renders blank while the navigation bar is hidden (src/ui/system-bars.ts).',
          },
        ],
      },
    ],
    // Destructuring a key out just to drop it (useTextStyle's lineHeight on
    // single-line inputs) is intentional; mark such names with a leading _.
    '@typescript-eslint/no-unused-vars': ['warn', { varsIgnorePattern: '^_', argsIgnorePattern: '^_' }],
  },
  overrides: [
    {
      // The two files whose job is to define and apply the raw values.
      files: ['src/ui/tokens.ts', 'src/ui/Text.tsx'],
      rules: { 'no-restricted-syntax': 'off' },
    },
    {
      files: ['src/ui/SystemModal.tsx'],
      rules: { 'no-restricted-imports': 'off' },
    },
    {
      // Node-side code: config plugins, the entry shim, the plain-Node tests and
      // the PC companion's helper, and build tools.
      files: [
        'plugins/**/*.js',
        'index.js',
        '.eslintrc.js',
        'babel.config.js',
        'tests/**/*.mjs',
        'companion/**/*.mjs',
        'tools/**/*.mjs',
      ],
      env: { node: true },
    },
    {
      // The tests, the companion and tools/ import src/features/analysis as TypeScript,
      // through Node's type stripping. The import plugin parses those .ts files
      // with the JavaScript parser and reports every export as missing; the
      // tests themselves prove the imports resolve.
      files: ['tests/**/*.mjs', 'companion/**/*.mjs', 'tools/**/*.mjs'],
      rules: { 'import/named': 'off', 'import/namespace': 'off' },
    },
    {
      // The companion's page runs in a browser.
      files: ['companion/web/**/*.js'],
      env: { browser: true },
    },
  ],
};
