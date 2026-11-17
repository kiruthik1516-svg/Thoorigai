# @repo/supabase-next-rbac

A production-grade, reusable **Role-Based Access Control (RBAC), Authentication, and User Management engine** designed for **Next.js App Router** and **Supabase (PostgreSQL)**.

---

## ✨ Features

- 🛡️ **Zero-Privilege Default (`pending`)**: Protects against self-registration privilege escalation. Public users who register cannot access protected routes or mutate data until cleared by an administrator or activated via an invite code.
- 🔑 **Expiring One-Time Invite Codes**: Admins can generate time-limited invite codes for specific roles or targeted email addresses with atomic PostgreSQL redemption.
- ⚡ **Type-Safe Permission Matrix**: Factory function `createRbac()` defines custom roles, resources, and action permissions with strict compile-time types.
- 🌐 **Next.js Proxy / Middleware**: Edge-ready session claim refresher with automatic cookie renewal via `@supabase/ssr`.
- 🔒 **Defense-in-Depth Route Guard (`withApi`)**: Route handler wrapper enforcing Origin/Host CSRF protection, input validation via Zod, rate limiting, and role assertions.
- 📦 **React Server Component Helpers**: Cached (`React.cache()`) profile retrieval and permission enforcement for layouts and page components.
- 🎨 **Pluggable UI Components**: Ready-to-use, accessible Tailwind CSS components:
  - `<AuthShell>`
  - `<LoginForm>` (automatically catches `ACCOUNT_PENDING_APPROVAL` status)
  - `<SignupForm>` (dual-mode: _Request Access_ vs _Redeem Invite Code_)
  - `<PendingClearance>` (standby approval view)
  - `<UserRolesManager>` (administrative user table, role selector, invite modal)
- 🗄️ **PostgreSQL Security**: 5 modular migrations with advisory transaction locks, audit logs, and Row Level Security (RLS) helpers.

---

## 📁 Package Architecture

```
packages/supabase-next-rbac/
├── migrations/                     # Database migrations for Supabase
│   ├── 01_create_profiles.sql      # Profiles table & handle_new_user() trigger
│   ├── 02_create_invite_codes.sql  # Invite codes table & redeem_invite_code RPC
│   ├── 03_create_audit_log.sql     # Tamper-evident administrative audit log
│   ├── 04_admin_functions.sql      # admin_change_profile_role RPC with locks
│   └── 05_rls_helpers.sql          # auth_user_role(), is_admin(), has_role()
├── src/
│   ├── index.ts                    # Main exports
│   ├── types.ts                    # Role, Resource, Action, Matrix types
│   ├── core/
│   │   ├── createRbac.ts           # can(), rolesFor(), requireRole()
│   │   └── errors.ts               # UnauthorizedError, ForbiddenError, etc.
│   ├── server/
│   │   ├── middleware.ts           # createRbacMiddleware() for proxy.ts
│   │   ├── profile.ts              # getCurrentProfile(), requirePermission()
│   │   ├── handler.ts              # withApi() route handler wrapper
│   │   └── csrf.ts                 # validateMutationRequest() CSRF check
│   ├── handlers/
│   │   ├── login.ts                # createLoginHandler()
│   │   ├── signup.ts               # createSignupHandler()
│   │   ├── logout.ts               # createLogoutHandler()
│   │   ├── invite.ts               # createVerifyInviteHandler(), createAdminInviteCodesHandler()
│   │   └── users.ts                # createAdminUsersHandler()
│   └── components/
│       ├── AuthShell.tsx
│       ├── LoginForm.tsx
│       ├── SignupForm.tsx
│       ├── PendingClearance.tsx
│       └── UserRolesManager.tsx
```

---

## 🚀 Quick Start Guide

### Step 1: Run Database Migrations

Apply the SQL files in `migrations/` to your Supabase project in order:

```bash
supabase db push
# or run migrations 01 through 05 in the Supabase Dashboard SQL Editor
```

---

### Step 2: Define Your Roles & Permission Matrix

Create a central RBAC definition file in your app (e.g. `lib/rbac.ts`):

```typescript
// lib/rbac.ts
import { createRbac } from '@repo/supabase-next-rbac'

export const roles = ['admin', 'manager', 'staff', 'pending'] as const
export type Role = (typeof roles)[number]

export const resources = ['users', 'reports', 'settings', 'billing'] as const
export type Resource = (typeof resources)[number]

export type Action = 'read' | 'create' | 'update' | 'delete' | 'manage'

export const rbac = createRbac({
  roles,
  resources,
  defaultRole: 'pending',
  adminRole: 'admin',
  matrix: {
    admin: {
      users: ['read', 'create', 'update', 'delete', 'manage'],
      reports: ['read', 'create', 'update', 'delete', 'manage'],
      settings: ['read', 'create', 'update', 'delete', 'manage'],
      billing: ['read', 'create', 'update', 'delete', 'manage'],
    },
    manager: {
      reports: ['read', 'create', 'update'],
      settings: ['read'],
    },
    staff: {
      reports: ['read'],
    },
    pending: {},
  },
})
```

---

### Step 3: Add Edge Middleware / Proxy

Add session claim validation in `proxy.ts` or `middleware.ts`:

```typescript
// proxy.ts or middleware.ts
import { createRbacMiddleware } from '@repo/supabase-next-rbac'

export const proxy = createRbacMiddleware({
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  loginPath: '/login',
  publicPaths: ['/login', '/signup', '/pending-approval', '/api/auth/login', '/api/auth/signup'],
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
```

---

### Step 4: Configure React Server Component Helpers

```typescript
// lib/auth.ts
import { createProfileHelpers, createApiHandlerFactory } from '@repo/supabase-next-rbac'
import { createClient } from '@/lib/supabase/server'
import { rbac } from '@/lib/rbac'

export const { getCurrentProfile, requirePermission } = createProfileHelpers({
  createClient,
  rbac,
  loginPath: '/login',
  unauthorizedRedirectPath: '/',
})

export const withApi = createApiHandlerFactory({
  createClient,
  rbac,
})
```

---

### Step 5: Mount Pluggable API Route Handlers

Create API endpoints using the prebuilt handler factories:

#### 1. Login Route (`app/api/auth/login/route.ts`)

```typescript
import { createLoginHandler } from '@repo/supabase-next-rbac'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'

export const POST = createLoginHandler({
  createClient,
  getAdminClient: getSupabaseAdminClient,
  defaultRole: 'pending',
})
```

#### 2. Signup Route (`app/api/auth/signup/route.ts`)

```typescript
import { createSignupHandler } from '@repo/supabase-next-rbac'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'

export const POST = createSignupHandler({
  getAdminClient: getSupabaseAdminClient,
  defaultRole: 'pending',
  defaultActiveRole: 'staff',
  fallbackStaffPasscode: process.env.STAFF_PASSCODE, // Optional static invite code
  onPendingRegistration: async ({ email, fullName }) => {
    // Optional: send Slack / Email alert to admin
  },
})
```

#### 3. Admin User Management (`app/api/admin/users/route.ts`)

```typescript
import { createAdminUsersHandler } from '@repo/supabase-next-rbac'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'

const { GET, PATCH, DELETE } = createAdminUsersHandler({
  createClient,
  getAdminClient: getSupabaseAdminClient,
  adminRole: 'admin',
})

export { GET, PATCH, DELETE }
```

---

### Step 6: Use UI Components

#### Login Page (`app/(auth)/login/page.tsx`)

```tsx
import { AuthShell, LoginForm } from '@repo/supabase-next-rbac'

export default function LoginPage() {
  return (
    <AuthShell brand={{ displayName: 'Acme Admin' }}>
      <LoginForm signupUrl="/signup" />
    </AuthShell>
  )
}
```

#### Signup Page (`app/(auth)/signup/page.tsx`)

```tsx
import { AuthShell, SignupForm } from '@repo/supabase-next-rbac'

export default function SignupPage() {
  return (
    <AuthShell brand={{ displayName: 'Acme Admin' }}>
      <SignupForm loginUrl="/login" />
    </AuthShell>
  )
}
```

#### Admin Users Page (`app/(dashboard)/settings/users/page.tsx`)

```tsx
import { requirePermission } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { UserRolesManager } from '@repo/supabase-next-rbac'

export default async function UsersPage() {
  const admin = await requirePermission('users', 'manage')
  const supabase = await createClient()

  const { data: users } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })

  return (
    <UserRolesManager
      users={users ?? []}
      currentUserId={admin.id}
      availableRoles={[
        { value: 'admin', label: 'Administrator' },
        { value: 'manager', label: 'Manager' },
        { value: 'staff', label: 'Staff' },
      ]}
    />
  )
}
```

---

## 🔒 Security Guarantees

1. **Anti-Privilege Escalation**: `handle_new_user()` trigger strictly ignores client metadata for role assignment.
2. **Double-Lock Admin Modifications**: `admin_change_profile_role` uses PostgreSQL advisory transaction locks (`pg_advisory_xact_lock`) to serialize concurrent role modifications and ensure at least one active administrator remains.
3. **Audit Trail**: Every role change is recorded to `audit_log` with before-and-after values and caller identity.
4. **CSRF Validation**: State-changing endpoints compare `Origin` and `Host` headers.
5. **No Leaked Tokens**: Unauthenticated users and pending clearance accounts cannot retrieve sensitive application data via RLS.
