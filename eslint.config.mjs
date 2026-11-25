import tsParser from '@typescript-eslint/parser'
import tsPlugin from '@typescript-eslint/eslint-plugin'
import reactHooks from 'eslint-plugin-react-hooks'
import jsxA11y from 'eslint-plugin-jsx-a11y'

const mockDataRestriction = {
  patterns: [
    {
      group: ['**/mock-data'],
      message: 'Use Supabase data, a test fixture, or supabase/seed.sql instead.',
    },
  ],
}

const adminDataRestriction = {
  ...mockDataRestriction,
  patterns: [
    ...mockDataRestriction.patterns,
    {
      group: ['**/supabase/admin'],
      message: 'Service role access is limited to readiness checks and authorized storage operations.',
    },
  ],
}

const baseSyntaxRestrictions = [
  { selector: 'MemberExpression[property.name="only"]', message: 'Focused tests must not be committed.' },
  {
    selector: 'MemberExpression[property.name="skip"]',
    message: 'Skipped tests require an active issue and cannot be committed in this suite.',
  },
]

// F-30: a dynamic import() of the admin client slipped past no-restricted-imports.
const dynamicAdminImport = {
  selector: 'ImportExpression[source.value=/supabase\\/admin$/]',
  message: 'Service role access is limited to readiness checks and authorized storage operations.',
}

// F-29: withApi already authenticates and loads the role; routes must use its context.
const routeGetUser = {
  selector: 'CallExpression[callee.property.name="getUser"][callee.object.property.name="auth"]',
  message: 'Use user, role and supabase from the withApi context instead of calling auth.getUser() in a route.',
}

// Files with a reviewed need for the service role (F-30). Keep this list short.
const serviceRoleAllowed = [
  'app/api/course-materials/route.ts',
  // Signs a short-lived URL only after the caller's own client (RLS) has read the material.
  'app/api/course-materials/download/route.ts',
  'app/api/invoices/**/download/route.ts',
  'app/api/ready/route.ts',
  'app/api/admin/users/route.ts',
  'app/api/auth/login/route.ts',
  'app/api/auth/signup/route.ts',
  'app/api/auth/verify-invite/route.ts',
  'app/api/auth/redeem-invite/route.ts',
  // Cached reads inside unstable_cache (no request cookies); callers check permissions first.
  'modules/courses/service.ts',
  'modules/gst/service.ts',
  // Notifications are written only by server code (F-10).
  'modules/notifications/service.ts',
]

export default [
  {
    ignores: ['.next/**', 'node_modules/**', 'coverage/**', 'playwright-report/**', 'test-results/**', 'out/**'],
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { parser: tsParser },
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      'no-restricted-imports': ['error', mockDataRestriction],
      'no-restricted-syntax': ['error', ...baseSyntaxRestrictions],
      // F-42: application code is fully typed (Supabase clients use the generated Database types).
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    // Unit tests mock Supabase's chainable query builders; typing every mock chain adds noise, not safety.
    files: ['**/*.test.{ts,tsx}', 'tests/**/*.{ts,tsx}'],
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },
  {
    files: ['**/*.tsx'],
    plugins: { 'react-hooks': reactHooks, 'jsx-a11y': jsxA11y },
    languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // jsx-a11y recommended, as warnings while F-38 fixes the existing ones (rules it turns off stay off).
      ...Object.fromEntries(
        Object.entries(jsxA11y.configs.recommended.rules)
          .filter(([, setting]) => (Array.isArray(setting) ? setting[0] : setting) !== 'off')
          .map(([rule, setting]) => [rule, Array.isArray(setting) ? ['warn', ...setting.slice(1)] : 'warn']),
      ),
    },
  },
  {
    files: ['app/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}', 'lib/**/*.{ts,tsx}', 'modules/**/*.{ts,tsx}'],
    ignores: serviceRoleAllowed,
    rules: {
      'no-restricted-imports': ['error', adminDataRestriction],
      'no-restricted-syntax': ['error', ...baseSyntaxRestrictions, dynamicAdminImport],
    },
  },
  // Flat config replaces a rule's options per matching block, so each route group lists its full set.
  {
    // Ordinary routes: no service role (static or dynamic) and no auth.getUser().
    files: ['app/api/**/route.ts'],
    ignores: [...serviceRoleAllowed, 'app/api/auth/**'],
    rules: {
      'no-restricted-syntax': ['error', ...baseSyntaxRestrictions, dynamicAdminImport, routeGetUser],
    },
  },
  {
    // Reviewed service-role routes that still run inside withApi: no auth.getUser().
    files: serviceRoleAllowed.filter((file) => file.startsWith('app/api/') && !file.startsWith('app/api/auth/')),
    rules: {
      'no-restricted-syntax': ['error', ...baseSyntaxRestrictions, routeGetUser],
    },
  },
]
