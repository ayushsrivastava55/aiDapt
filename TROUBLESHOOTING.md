# 🔧 Troubleshooting Guide - aiDapt

Common issues and their solutions.

---

## 🔴 Database Errors

### Error: "column does not exist"

**Example Error:**
```
Error [NeonDbError]: column "email" does not exist
```

**Cause**: Your database schema is out of sync with your code schema definition.

**Solution:**
```bash
npm run db:push
```

This pushes your schema changes from `lib/db/schema.ts` to the actual database.

**When to run `db:push`:**
- ✅ First time setting up the project
- ✅ After pulling schema changes from git
- ✅ After modifying `lib/db/schema.ts`
- ✅ When you see "column/table does not exist" errors

---

### Error: "relation does not exist"

**Example Error:**
```
Error: relation "learners" does not exist
```

**Cause**: Database tables haven't been created yet.

**Solution:**
```bash
npm run db:push
```

---

### Error: "DATABASE_URL is not defined"

**Cause**: Missing database connection string in environment variables.

**Solution:**
1. Copy `.env.example` to `.env.local`
2. Add your database URL:
   ```
   DATABASE_URL=postgresql://user:password@host/database
   ```

Get a free database from [Neon](https://neon.tech), [Vercel Postgres](https://vercel.com/storage/postgres), or [Supabase](https://supabase.com).

---

## 🔴 API Errors

### Error: "Failed to generate course: 500"

**Common Causes:**
1. **Database schema mismatch** → Run `npm run db:push`
2. **Missing OPENAI_API_KEY** → Check `.env.local`
3. **Invalid session** → Clear cookies and refresh

**Solution Steps:**
```bash
# 1. Check environment variables
cat .env.local

# 2. Sync database
npm run db:push

# 3. Restart dev server
npm run dev
```

---

### Error: "OPENAI_API_KEY is not defined"

**Cause**: Missing OpenAI API key in environment variables.

**Solution:**
1. Get API key from [OpenAI Platform](https://platform.openai.com/api-keys)
2. Add to `.env.local`:
   ```
   OPENAI_API_KEY=sk-proj-...
   ```
3. Restart dev server

---

## 🔴 Session Errors

### Error: "No session found"

**Cause**: Session cookie expired or cleared.

**Solution**: Just refresh the page. A new session will be created automatically.

---

### Error: "Session cleared unexpectedly"

**Possible Causes:**
- Browser privacy settings blocking cookies
- Incognito/private mode
- Cookie max age expired (365 days)

**Solution:**
1. Enable cookies in browser
2. Use regular browsing mode
3. Session will auto-recreate on next page load

---

## 🔴 Build Errors

### Error: "Type error in..." during build

**Cause**: TypeScript type errors in code.

**Solution:**
```bash
# Check types without building
npm run typecheck

# Fix type errors in reported files
```

---

### Error: "Module not found"

**Cause**: Missing npm dependencies.

**Solution:**
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

---

## 🔴 Development Server Errors

### Error: "Port 3000 already in use"

**Cause**: Another process is using port 3000.

**Solution:**
```bash
# Option 1: Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Option 2: Use different port
npm run dev -- -p 3001
```

---

### Error: "Turbopack failed to start"

**Cause**: Turbopack compatibility issue.

**Solution:**
```bash
# Use standard webpack instead
next dev
```

Or update `package.json` scripts to remove `--turbopack` flag.

---

## 🔴 Runtime Errors

### Error: "Hydration mismatch"

**Cause**: Client/server HTML mismatch, often from:
- Using `Date.now()` or random values
- Browser extensions modifying HTML
- Conditional rendering based on browser APIs

**Solution:**
1. Use `useEffect` for client-only code
2. Use `suppressHydrationWarning` sparingly
3. Check for browser extensions interfering

---

### Error: "Too many re-renders"

**Cause**: Infinite loop in state updates.

**Common Pattern:**
```tsx
// ❌ Wrong - causes infinite loop
const [count, setCount] = useState(0);
setCount(count + 1); // Called on every render!

// ✅ Correct - call in effect or event handler
const [count, setCount] = useState(0);
useEffect(() => {
  setCount(count + 1);
}, []); // Only once
```

**Solution**: Move state updates into event handlers or properly managed effects.

---

## 🔴 Drizzle Studio Issues

### Error: "Failed to connect to database"

**Cause**: Invalid DATABASE_URL or database unreachable.

**Solution:**
```bash
# Test database connection
npm run db:push

# If that works, try studio again
npm run db:studio
```

---

## 🔴 Console Warnings

### Warning: "Each child should have a unique key prop"

**Cause**: Missing `key` prop in mapped elements.

**Solution:**
```tsx
// ❌ Wrong
{items.map(item => <div>{item.name}</div>)}

// ✅ Correct
{items.map(item => <div key={item.id}>{item.name}</div>)}
```

---

### Warning: "Cannot update component while rendering"

**Cause**: State update during render.

**Solution**: Move state updates to effects or event handlers.

---

## 📦 Package Installation Issues

### Error: "ERESOLVE unable to resolve dependency tree"

**Cause**: Package version conflicts.

**Solution:**
```bash
# Use legacy peer deps
npm install --legacy-peer-deps

# Or force
npm install --force
```

---

## 🛠️ General Debugging Tips

### Enable Verbose Logging

```bash
# Next.js verbose mode
DEBUG=* npm run dev

# TypeScript verbose
npm run typecheck -- --verbose
```

### Clear All Caches

```bash
# Clear Next.js cache
rm -rf .next

# Clear node_modules
rm -rf node_modules package-lock.json
npm install

# Clear browser cache
# Open DevTools → Application → Clear Storage
```

### Check Environment

```bash
# Verify Node version (should be 18+)
node --version

# Verify npm version
npm --version

# Check if env vars loaded
node -e "console.log(process.env.DATABASE_URL)"
```

---

## 🔍 Getting More Help

### 1. Check the Logs
- Browser DevTools Console (F12)
- Terminal output from `npm run dev`
- Network tab for API errors

### 2. Review Documentation
- `README.md` - Setup guide
- `IMPLEMENTATION.md` - Database details
- `ISSUES.md` - Known issues
- `RECOMMENDATIONS.md` - Best practices

### 3. Common Patterns

**Always try this sequence:**
```bash
# 1. Ensure dependencies installed
npm install

# 2. Sync database
npm run db:push

# 3. Check env vars
cat .env.local

# 4. Restart server
npm run dev
```

---

## 📝 Reporting Issues

If you encounter an issue not covered here:

1. **Note the exact error message**
2. **Check which file/line it occurs**
3. **Note the steps to reproduce**
4. **Check browser console for additional errors**
5. **Verify environment setup** (Node version, env vars, etc.)

---

*Last Updated: After fixing "column does not exist" error*
