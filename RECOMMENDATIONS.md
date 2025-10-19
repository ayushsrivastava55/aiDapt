# 🎯 Quick Improvements for aiDapt

## ✅ Completed Improvements

1. **Fixed template literal bug** in achievements page
2. **Added missing "accent" button variant**
3. **Created reusable UI components**:
   - Loading states (spinner, page, cards, overlay)
   - Error states (full page, inline, boundary)
   - Empty states (with actions)
4. **Implemented proper session management**:
   - `useSession()` hook
   - `/api/session` endpoint
   - Removed hardcoded mock IDs
5. **Added TypeScript types** for all API responses
6. **Updated package.json** with correct project name

## 🚀 Immediate Next Steps

### 1. Replace Console Logging
Create a proper logging utility:

```typescript
// lib/utils/logger.ts
export const logger = {
  info: (message: string, data?: any) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[INFO] ${message}`, data);
    }
    // Send to logging service in production
  },
  error: (message: string, error?: any) => {
    console.error(`[ERROR] ${message}`, error);
    // Send to Sentry/error tracking
  },
  // ... warn, debug, etc.
};
```

Then replace all `console.log` with `logger.info`, etc.

### 2. Add Toast Notifications

```bash
npm install sonner
```

```tsx
// Add to layout.tsx
import { Toaster } from 'sonner';

// In layout
<body>
  {children}
  <Toaster position="top-right" />
</body>
```

Usage:
```tsx
import { toast } from 'sonner';
toast.success('Achievement unlocked!');
```

### 3. Add Environment Variable Validation

```typescript
// lib/env.ts (expand existing)
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  OPENAI_API_KEY: z.string().min(1),
  NODE_ENV: z.enum(['development', 'production', 'test']),
  // Add more as needed
});

export const env = envSchema.parse(process.env);
```

### 4. Implement API Client

```typescript
// lib/api/client.ts
type ApiMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

interface ApiOptions<T = any> {
  method?: ApiMethod;
  body?: T;
  headers?: Record<string, string>;
}

export class ApiError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

export async function apiCall<T>(
  endpoint: string,
  options: ApiOptions = {}
): Promise<T> {
  const { method = 'GET', body, headers = {} } = options;

  const response = await fetch(endpoint, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new ApiError(response.status, error);
  }

  return response.json();
}

// Specific API functions
export const api = {
  session: {
    get: () => apiCall<{ learner: Learner }>('/api/session'),
    delete: () => apiCall('/api/session', { method: 'DELETE' }),
  },
  achievements: {
    getProgress: (learnerId: string) =>
      apiCall(`/api/achievements?learnerId=${learnerId}&action=progress`),
    check: (learnerId: string) =>
      apiCall('/api/achievements?action=check', {
        method: 'POST',
        body: { learnerId },
      }),
  },
  // Add more...
};
```

### 5. Add Request Caching with SWR

```bash
npm install swr
```

```typescript
// lib/hooks/use-api.ts
import useSWR from 'swr';
import { apiCall } from '@/lib/api/client';

export function useApi<T>(
  key: string | null,
  fetcher?: () => Promise<T>
) {
  return useSWR(key, fetcher || (() => apiCall<T>(key!)), {
    revalidateOnFocus: false,
    dedupingInterval: 5000,
  });
}

// Usage
const { data, error, isLoading, mutate } = useApi('/api/session');
```

### 6. Add Accessibility Improvements

```tsx
// Add to interactive elements
<button
  aria-label="Close dialog"
  aria-pressed={isOpen}
  onClick={handleClick}
>
  Close
</button>

// Add to cards
<Card role="article" aria-labelledby="card-title">
  <CardTitle id="card-title">Title</CardTitle>
</Card>

// Add to progress indicators
<div
  role="progressbar"
  aria-valuenow={progress}
  aria-valuemin={0}
  aria-valuemax={100}
>
  {progress}%
</div>
```

### 7. Add Keyboard Navigation

```tsx
// Example for modal/dialog
useEffect(() => {
  const handleEscape = (e: KeyboardEvent) => {
    if (e.key === 'Escape') closeDialog();
  };
  
  if (isOpen) {
    document.addEventListener('keydown', handleEscape);
    // Trap focus in dialog
  }
  
  return () => document.removeEventListener('keydown', handleEscape);
}, [isOpen]);
```

## 📦 Suggested Packages

### Essential
- `sonner` - Toast notifications
- `@tanstack/react-query` or `swr` - Data fetching & caching
- `@sentry/nextjs` - Error tracking
- `zod` - Runtime validation

### Nice to Have
- `framer-motion` - Animations
- `react-hot-keys` - Keyboard shortcuts
- `cmdk` - Command palette
- `vaul` - Drawer component

### Development
- `vitest` - Unit testing
- `@playwright/test` - E2E testing
- `@storybook/react` - Component documentation
- `husky` - Git hooks

## 🎨 UI/UX Quick Wins

### 1. Add Smooth Transitions

```css
/* globals.css */
* {
  transition-property: background-color, border-color, color, fill, stroke, opacity, box-shadow, transform;
  transition-duration: 150ms;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
}
```

### 2. Add Skip to Content Link

```tsx
// layout.tsx
<a
  href="#main-content"
  className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:p-4 bg-main"
>
  Skip to main content
</a>

<main id="main-content">
  {children}
</main>
```

### 3. Add Focus Indicators

```css
/* globals.css */
*:focus-visible {
  outline: 3px solid var(--accent);
  outline-offset: 2px;
}
```

### 4. Add Reduced Motion Support

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

## 🔍 Monitoring & Analytics

### 1. Add Vercel Analytics

```bash
npm install @vercel/analytics
```

```tsx
// layout.tsx
import { Analytics } from '@vercel/analytics/react';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
```

### 2. Add Error Tracking

```bash
npm install @sentry/nextjs
```

Follow Sentry setup guide for Next.js

### 3. Add Performance Monitoring

```typescript
// lib/utils/performance.ts
export function measurePerformance(name: string, fn: () => void) {
  const start = performance.now();
  fn();
  const end = performance.now();
  console.log(`[PERF] ${name}: ${end - start}ms`);
}
```

## 📝 Code Quality Tools

### 1. Add Pre-commit Hooks

```bash
npm install -D husky lint-staged
npx husky install
```

```json
// package.json
{
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
    "*.{json,md}": ["prettier --write"]
  }
}
```

### 2. Add Commit Linting

```bash
npm install -D @commitlint/cli @commitlint/config-conventional
```

```js
// commitlint.config.js
module.exports = {
  extends: ['@commitlint/config-conventional'],
};
```

### 3. Add Bundle Analyzer

```bash
npm install -D @next/bundle-analyzer
```

```js
// next.config.ts
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

module.exports = withBundleAnalyzer({
  // your config
});
```

Run: `ANALYZE=true npm run build`

## 🧪 Testing Setup

### 1. Unit Tests with Vitest

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
```

### 2. E2E Tests with Playwright

```bash
npm install -D @playwright/test
npx playwright install
```

```typescript
// tests/e2e/home.spec.ts
import { test, expect } from '@playwright/test';

test('homepage loads and shows course generation', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toContainText('WHAT DO YOU WANT TO LEARN');
});
```

## 🎯 Priority Order

### Week 1 (Critical)
1. ✅ Fix bugs (DONE)
2. ✅ Add reusable components (DONE)
3. ✅ Implement session management (DONE)
4. Replace console.logging
5. Add toast notifications

### Week 2 (High Priority)
6. Add API client with error handling
7. Implement request caching (SWR)
8. Add environment validation
9. Add basic accessibility (ARIA labels)
10. Add error tracking (Sentry)

### Week 3-4 (Medium Priority)
11. Write unit tests for utilities
12. Add E2E tests for critical flows
13. Implement keyboard navigation
14. Add performance monitoring
15. Complete documentation

---

**Goal**: Transform from "works well" to "production-ready" 🚀
