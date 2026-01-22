# Vercel React Best Practices

*Derived from [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills/tree/main/skills/react-best-practices)*

This guide encapsulates critical React and Next.js optimization knowledge. Use this as a checklist for code reviews and refactoring.

## Priority 1: Critical Issues

### 1. Eliminating Waterfalls
**Why:** Sequential data fetching adds significant latency.
- **`async-defer-await`**: Don't `await` a promise until the data is actually needed (e.g., inside a conditional).
- **`async-parallel`**: Use `Promise.all()` for independent operations instead of sequential `await`s.
- **`async-dependencies`**: If operation B depends on part of operation A, start B as soon as that part is available.
- **`async-api-routes`**: In API routes, start all async tasks early and `await` them only when forming the response.

### 2. Bundle Size Optimization
**Why:** Large bundles delay interactivity (TTI) and hydration.
- **`bundle-barrel-imports`**: **Avoid `export * from ...`**. Import directly from source files to enable better tree-shaking.
- **`bundle-dynamic-imports`**: Use `next/dynamic` or `React.lazy` for heavy components (charts, huge lists) that aren't critical for LCP.
- **`bundle-conditional`**: Dynamically import modules only when the feature is activated (e.g., huge SDKs for a "Help" modal).

---

## Priority 2: High Impact

### 3. Server-Side Performance
- **`server-cache-react`**: Use `React.cache()` to deduplicate identical fetch requests within a single render pass.
- **`server-cache-lru`**: Implement LRU caching for expensive computations across requests.
- **`server-serialization`**: Minimize the size of data passed from Server Components to Client Components (the "RSC Payload").
- **`server-parallel-fetching`**: Structure component trees so siblings can fetch data in parallel, rather than blocking each other (waterfalls).

### 4. Client-Side Optimization
- **`client-swr-dedup`**: Use libraries like SWR or TanStack Query to automatically deduplicate network requests on the client.
- **`client-event-listeners`**: Avoid attaching identical event listeners repeatedly; use delegation or single listeners where possible.

---

## Priority 3: Medium Impact

### 5. Re-render Optimization
- **`rerender-defer-reads`**: Don't subscribe to context/state values that are only used inside callbacks (use refs or functional updates).
- **`rerender-memo`**: Use `React.memo`, `useMemo`, and `useCallback` judiciously for expensive sub-trees or stable dependencies.
- **`rerender-dependencies`**: Avoid using objects/arrays as dependencies in `useEffect` unless memoized; prefer primitives.

### 6. Rendering Performance
- **`rendering-content-visibility`**: Use CSS `content-visibility: auto` for off-screen content in long lists.
- **`rendering-hoist-jsx`**: Define static JSX (icons, invariant wrappers) outside components to prevent re-creation.
- **`rendering-activity`**: Use `<Activity>` (or hidden CSS classes) to toggle visibility instead of unmounting/remounting heavy components.
