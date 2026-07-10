import { render, screen } from '@testing-library/react';
import App from './App';

beforeEach(() => {
  jest.restoreAllMocks();
  window.history.pushState({}, '', '/');
});

test('redirects app startup to the A/R dashboard', async () => {
  jest.spyOn(global, 'fetch').mockImplementation((url) => {
    if (url.includes('/api/auth/me/')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          authenticated: true,
          user: { username: 'admin', name: 'Admin User', access: ['ar'] },
        }),
      });
    }

    if (url.includes('/api/ar/dashboard/')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          has_data: false,
          message: 'Upload your AR Master Sheet to get started.',
        }),
      });
    }

    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  });

  window.history.pushState({}, '', '/');
  render(<App />);
  expect(await screen.findByText(/AR Dashboard Ready/i)).toBeInTheDocument();
  expect(window.location.pathname).toBe('/ar');
});
