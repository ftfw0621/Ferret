import '@testing-library/jest-dom/vitest'

// Mock @tauri-apps/api/core — prevents actual Tauri calls in tests
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))
