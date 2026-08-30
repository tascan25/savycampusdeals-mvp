# Testing

Full testing strategy (unit/component/integration/E2E matrix, CI wiring) lands
in Phase 9. This file tracks concrete tooling findings as they're discovered
so they aren't rediscovered later.

## Known tooling quirks (Expo SDK 57 / React 19.2 / RN 0.86)

- **`react-native-reanimated` v4 requires `react-native-worklets` as a
  separate direct dependency.** Without it, `babel.config.js`'s
  `react-native-reanimated/plugin` fails to load under Jest. Installed via
  `npx expo install react-native-worklets`.
- **`babel-preset-expo` must be an explicit devDependency**, not just a
  transitive one — Jest's Babel config resolution needs to find it from the
  project root.
- **`@testing-library/react-native@14` depends on the new `test-renderer`
  package, not `react-test-renderer`.** `react-test-renderer` is deprecated
  under React 19; installing it instead of `test-renderer` produces
  `Cannot find module 'test-renderer'`.
- **`render()` from `@testing-library/react-native@14` is `async`** (backed
  by `test-renderer`'s async `act`) — every call must be `await`ed, including
  in tests that render a single static element. Skipping `await` doesn't
  throw; it silently returns an empty, non-functional result object, which
  is a much harder bug to spot than an error would be.
- **The `screen` singleton export from `@testing-library/react-native@14`
  does not update reliably** in this project's Jest/Babel module setup
  (`setRenderResult` internally reassigns an exported `let`, which doesn't
  propagate through this transform's CJS interop). Use the object returned
  by `render()`/`await render()` directly (`const { getByRole } = await
render(...)`) instead of importing `screen`.
- **`renderHook()`, its `rerender()`, and `act()` are all `async` too** —
  same root cause as `render()` above. Skipping `await` on any of them
  doesn't throw; it produces "overlapping act() calls" warnings and stale
  `result.current` reads instead. Await every one:
  `const { result, rerender } = await renderHook(...)`, then
  `await rerender(newProps)` and `await act(() => { ... })`.
