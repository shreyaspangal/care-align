import storybook from 'eslint-plugin-storybook'
import reactHooks from 'eslint-plugin-react-hooks'
import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

// ─── Custom plugin: CareAlign architecture rules ──────────────────────────────
//
// These rules encode constraints from CLAUDE.md that the standard ESLint
// ecosystem cannot express. They operate on the parsed AST (not regex), so
// they handle multiline JSX, spread props, and comments correctly.

const carealigPlugin = {
  meta: { name: 'carealig', version: '1.0.0' },
  rules: {

    // Rule 1 — No raw <button>, <input>, <label> in composites or features.
    // Use Button / Input / Label from @/components/ui/*.
    // Exceptions: input[type=radio|file|checkbox|hidden] (no Shadcn primitive).
    'no-raw-html-primitives': {
      meta: {
        type: 'problem',
        docs: { description: 'Use Shadcn primitives instead of raw HTML elements' },
        schema: [],
      },
      create(context) {
        const filename = context.getFilename()
        const inScope =
          filename.includes('/components/composites/') ||
          filename.includes('/components/features/')
        if (!inScope) return {}

        return {
          JSXOpeningElement(node) {
            const name = node.name.name
            if (!['button', 'input', 'label'].includes(name)) return

            // Allow input[type=radio|file|checkbox|hidden]
            if (name === 'input') {
              const typeAttr = node.attributes.find(
                a => a.type === 'JSXAttribute' && a.name?.name === 'type'
              )
              const typeVal = typeAttr?.value?.value
              if (['radio', 'file', 'checkbox', 'hidden'].includes(typeVal)) return
            }

            // Allow <label> used as a styled wrapper for a radio/checkbox (clickable card pattern).
            // These have no Shadcn equivalent and are a standard accessible pattern.
            if (name === 'label') {
              const hasHtmlFor = node.attributes.some(
                a => a.type === 'JSXAttribute' && a.name?.name === 'htmlFor'
              )
              // A <label> without htmlFor is acting as a wrapper — allow it.
              // A <label htmlFor="..."> should use <Label> from Shadcn.
              if (!hasHtmlFor) return
            }

            const replacement = { button: 'Button', input: 'Input', label: 'Label' }[name]
            context.report({
              node,
              message: `Raw <${name}> not allowed in composites/features — use <${replacement}> from @/components/ui/${name}`,
            })
          },
        }
      },
    },

    // Rule 2 — Domain union types must be imported from @/lib/types/domain, never redefined.
    // Catches: `type DocumentType = ...` or `export type EpisodeStatus = ...` inline.
    'no-inline-domain-types': {
      meta: {
        type: 'problem',
        docs: { description: 'Domain types must be imported from @/lib/types/domain' },
        schema: [],
      },
      create(context) {
        const filename = context.getFilename()
        const exempt =
          filename.includes('lib/types/domain.ts') ||
          filename.includes('lib/validation/schemas.ts') ||
          filename.endsWith('.stories.tsx')
        if (exempt) return {}

        const DOMAIN_TYPES = new Set([
          'DocumentType', 'EpisodeStatus', 'TranslationStatus', 'DocumentStatus',
          'TaskCategory', 'TaskPhase', 'TaskStatus', 'ActionFor',
          'UserRole', 'AdmissionStatus',
        ])

        return {
          TSTypeAliasDeclaration(node) {
            if (DOMAIN_TYPES.has(node.id.name)) {
              context.report({
                node,
                message: `'${node.id.name}' must be imported from @/lib/types/domain, not redefined inline`,
              })
            }
          },
        }
      },
    },

    // Rule 3 — No deprecated AI SDK APIs (generateObject, streamObject, NoObjectGeneratedError).
    // Scope: lib/ai/ and actions/ only.
    'no-deprecated-ai-sdk': {
      meta: {
        type: 'problem',
        docs: { description: 'Deprecated AI SDK APIs must not be used' },
        schema: [],
      },
      create(context) {
        const filename = context.getFilename()
        const inScope =
          filename.includes('/lib/ai/') || filename.includes('/actions/')
        if (!inScope) return {}

        const DEPRECATED = {
          generateObject: 'use generateText + Output.object({ schema }) instead',
          streamObject: 'use streamText + Output.object({ schema }) instead',
          NoObjectGeneratedError: 'use NoOutputGeneratedError instead',
        }

        return {
          ImportSpecifier(node) {
            const name = node.imported.name
            if (DEPRECATED[name]) {
              context.report({
                node,
                message: `'${name}' is deprecated in ai@6+ — ${DEPRECATED[name]}`,
              })
            }
          },
          Identifier(node) {
            if (node.name === 'NoObjectGeneratedError') {
              context.report({
                node,
                message: `'NoObjectGeneratedError' is deprecated — use NoOutputGeneratedError instead`,
              })
            }
          },
        }
      },
    },

    // Rule 4 — No raw console.* in server-side files ('use server' or 'server-only').
    // Use createLogger() from @/lib/logger instead.
    'no-console-in-server-files': {
      meta: {
        type: 'suggestion',
        docs: { description: 'Use createLogger() instead of console.* in server files' },
        schema: [],
      },
      create(context) {
        const filename = context.getFilename()
        // Only applies to files outside components/ (those are client-side)
        if (filename.includes('/components/')) return {}
        if (filename.includes('logger.ts')) return {}

        let isServerFile = false

        return {
          ExpressionStatement(node) {
            // Detect 'use server' or 'server-only' directives
            if (
              node.expression.type === 'Literal' &&
              (node.expression.value === 'use server' ||
                node.expression.value === 'server-only')
            ) {
              isServerFile = true
            }
          },
          ImportDeclaration(node) {
            if (node.source.value === 'server-only') isServerFile = true
          },
          'CallExpression[callee.type="MemberExpression"]'(node) {
            if (!isServerFile) return
            const obj = node.callee.object
            const prop = node.callee.property
            if (
              obj.type === 'Identifier' &&
              obj.name === 'console' &&
              ['log', 'warn', 'error', 'debug', 'info'].includes(prop.name)
            ) {
              context.report({
                node,
                message: `console.${prop.name}() in a server file — use createLogger() from @/lib/logger`,
              })
            }
          },
        }
      },
    },

    // Rule 5 — Server actions that call formData.get() must use .safeParse().
    // Mirrors the server-action half of check-schemas.mjs.
    'server-action-requires-safeParse': {
      meta: {
        type: 'problem',
        docs: { description: 'Server actions using formData must call .safeParse()' },
        schema: [],
      },
      create(context) {
        const filename = context.getFilename()
        if (!filename.includes('/actions/')) return {}

        let isServerAction = false
        let callsFormDataGet = false
        let callsSafeParse = false
        let usesSchemaValidator = false

        return {
          ExpressionStatement(node) {
            if (
              node.expression.type === 'Literal' &&
              node.expression.value === 'use server'
            ) {
              isServerAction = true
            }
          },
          CallExpression(node) {
            const src = context.getSourceCode().getText(node)
            if (src.includes('formData.get(')) callsFormDataGet = true
            if (src.includes('.safeParse(')) callsSafeParse = true
            if (src.includes('validateDocumentFile(')) usesSchemaValidator = true
          },
          'Program:exit'() {
            if (
              isServerAction &&
              callsFormDataGet &&
              !callsSafeParse &&
              !usesSchemaValidator
            ) {
              context.report({
                loc: { line: 1, column: 0 },
                message: `Server action calls formData.get() without .safeParse() or a schema-backed validator`,
              })
            }
          },
        }
      },
    },

    // Rule 6 — No raw color values in className arbitrary syntax or style props.
    // All colors must reference a design token via a Tailwind class or var(--token).
    //
    // Forbidden:  className="bg-[oklch(0.44_0.11_183)]"
    // Forbidden:  style={{ color: '#3b82f6' }}
    // Allowed:    className="bg-brand-base"
    // Allowed:    style={{ color: 'var(--brand-base)' }}
    //
    // For one-off exceptions confirmed by the product owner, add an eslint-disable-next-line
    // comment with a brief justification.
    'no-raw-color-values': {
      meta: {
        type: 'problem',
        docs: { description: 'Use design token classes or var(--token) — no raw color values' },
        schema: [],
        messages: {
          rawColorInClass:
            'Raw color in className "{{value}}" — use a token class (bg-brand-base) or CSS variable',
          rawColorInStyle:
            'Raw color in style prop "{{key}}: {{value}}" — use var(--token-name) instead',
        },
      },
      create(context) {
        // Matches arbitrary Tailwind classes with raw color functions or hex codes
        const ARBITRARY_COLOR_RE =
          /(?:^|\s)[\w-]+-\[(?:oklch|rgb|rgba|hsl|hsla|color)\s*\(|(?:^|\s)[\w-]+-\[#[0-9a-fA-F]{3,8}\]/g

        // Matches raw color values that are NOT wrapped in var()
        const RAW_COLOR_VALUE_RE =
          /^(?:oklch|rgb|rgba|hsl|hsla|color)\s*\(|^#[0-9a-fA-F]{3,8}$/

        function checkClassName(value, node) {
          const matches = value.match(ARBITRARY_COLOR_RE)
          if (!matches) return
          for (const match of matches) {
            context.report({
              node,
              messageId: 'rawColorInClass',
              data: { value: match.trim() },
            })
          }
        }

        return {
          JSXAttribute(node) {
            // ── className="..." ──
            if (node.name.name === 'className') {
              if (node.value?.type === 'Literal' && typeof node.value.value === 'string') {
                checkClassName(node.value.value, node)
              }
              if (node.value?.type === 'JSXExpressionContainer') {
                const expr = node.value.expression
                if (expr.type === 'TemplateLiteral') {
                  for (const quasi of expr.quasis) {
                    checkClassName(quasi.value.raw, node)
                  }
                }
              }
            }

            // ── style={{ key: 'raw-color' }} ──
            if (node.name.name === 'style') {
              const container = node.value
              if (container?.type !== 'JSXExpressionContainer') return
              const obj = container.expression
              if (obj.type !== 'ObjectExpression') return
              for (const prop of obj.properties) {
                if (prop.type !== 'Property') continue
                const val = prop.value
                if (val.type === 'Literal' && typeof val.value === 'string') {
                  if (RAW_COLOR_VALUE_RE.test(val.value.trim())) {
                    const key = prop.key.type === 'Identifier' ? prop.key.name : prop.key.value
                    context.report({
                      node: prop,
                      messageId: 'rawColorInStyle',
                      data: { key, value: val.value },
                    })
                  }
                }
              }
            }
          },
        }
      },
    },
  },
}

// ─── ESLint config ────────────────────────────────────────────────────────────

export default defineConfig([
  // Base Next.js rules
  ...nextVitals,
  ...nextTs,

  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    'node_modules/**',
    'scripts/**',           // our Node.js utility scripts, not app code
    'supabase/**',          // generated Supabase types
    '.storybook/**',
  ]),

  // TypeScript-aware rules across all TS/TSX files.
  // @typescript-eslint plugin is already registered by nextTs — do not re-declare it here.
  {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: {
      'react-hooks': reactHooks,
    },
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Catch unused variables/parameters — the episodePhase bug class
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          vars: 'all',
          args: 'after-used',
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],

      // Exhaustive deps in useEffect/useCallback/useMemo
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // No floating promises — prevents fire-and-forget async bugs
      '@typescript-eslint/no-floating-promises': 'error',

      // Consistent type imports — keeps bundle clean
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],
    },
  },

  // CareAlign custom architecture rules
  {
    files: ['**/*.tsx', '**/*.ts'],
    plugins: { carealig: carealigPlugin },
    rules: {
      'carealig/no-raw-html-primitives': 'error',
      'carealig/no-inline-domain-types': 'error',
      'carealig/no-deprecated-ai-sdk': 'error',
      'carealig/no-console-in-server-files': 'error',
      'carealig/server-action-requires-safeParse': 'error',
      'carealig/no-raw-color-values': 'error',
    },
  },

  // Storybook rules for story files only
  ...storybook.configs['flat/recommended'],
])
