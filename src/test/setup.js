import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Clean up any rendered components after each test so leaks don't poison
// subsequent suites. RTL doesn't auto-cleanup under vitest.
afterEach(() => {
    cleanup();
});
