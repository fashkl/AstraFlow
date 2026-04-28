import { expect, test } from '@playwright/test';

const weatherPayload = {
  data: [
    {
      date: '2024-02-01',
      precipitationSum: 0.1,
      temperatureMax: 26.4,
      temperatureMin: 20.5,
    },
    {
      date: '2024-02-02',
      precipitationSum: 0,
      temperatureMax: 25.9,
      temperatureMin: 19.8,
    },
    {
      date: '2024-02-03',
      precipitationSum: 1.2,
      temperatureMax: 24.7,
      temperatureMin: 18.9,
    },
  ],
  location: { latitude: 25.2048, longitude: 55.2708 },
  pagination: { page: 1, pageSize: 50, totalItems: 3, totalPages: 1 },
  range: { start: '2024-02-01', end: '2024-02-03' },
};

test.describe('Weather + Streaming E2E', () => {
  test('happy path: user loads date range and chart renders with data', async ({ page }) => {
    const weatherRequests: string[] = [];

    await page.route('**/api/v1/weather?*', async (route) => {
      weatherRequests.push(route.request().url());
      await route.fulfill({
        contentType: 'application/json',
        status: 200,
        body: JSON.stringify(weatherPayload),
      });
    });

    await page.goto('/');
    await page.getByRole('textbox', { name: 'Location (lat,long)' }).fill('25.2048,55.2708');
    await page.getByLabel('Start date').fill('2024-02-01');
    await page.getByLabel('End date').fill('2024-02-03');

    await page.getByRole('button', { name: 'Load weather data' }).click();

    await expect(page.getByTestId('weather-line-chart')).toBeVisible();
    await expect(page.getByText('Total records: 3')).toBeVisible();
    await expect(page.locator('tbody tr')).toHaveCount(3);

    expect(weatherRequests.some((url) => url.includes('start=2024-02-01'))).toBeTruthy();
    expect(weatherRequests.some((url) => url.includes('end=2024-02-03'))).toBeTruthy();
  });

  test('streaming path: tokens appear incrementally in the UI', async ({ page }) => {
    await page.route('**/api/v1/weather?*', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        status: 200,
        body: JSON.stringify(weatherPayload),
      });
    });

    await page.addInitScript(() => {
      class MockEventSource {
        onerror: ((event: Event) => void) | null = null;
        private closed = false;
        private handlers: Record<string, Array<(event: { data: string }) => void>> = {};

        constructor(url: string) {
          void url;
          setTimeout(() => this.emit('token', 'Hello '), 40);
          setTimeout(() => this.emit('token', 'world'), 100);
          setTimeout(() => this.emit('done', ''), 160);
        }

        addEventListener(event: string, handler: (event: { data: string }) => void): void {
          const list = this.handlers[event] ?? [];
          this.handlers[event] = [...list, handler];
        }

        close(): void {
          this.closed = true;
        }

        private emit(event: string, data: string): void {
          if (this.closed) return;
          for (const handler of this.handlers[event] ?? []) {
            handler({ data });
          }
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).EventSource = MockEventSource;
    });

    await page.goto('/');
    await page.getByRole('textbox', { name: 'Location (lat,long)' }).fill('25.2048,55.2708');

    await page.getByPlaceholder('Ask anything… (⌘ Enter to send)').fill('Give me a short summary');
    await page.getByRole('button', { name: 'Send' }).click();

    await expect(page.locator('.stream-output')).toContainText('Hello ');
    await expect(page.locator('.stream-output')).toContainText('Hello world');
    await expect(page.getByRole('button', { name: 'Send' })).toBeVisible();
  });

  test('error path: API down state is visible to the user', async ({ page }) => {
    await page.route('**/api/v1/weather?*', async (route) => {
      await route.abort('failed');
    });

    await page.goto('/');

    const errorBanner = page.locator('.status-error').first();
    await expect(errorBanner).toBeVisible();
    await expect(errorBanner).toContainText(/fetch|network|failed/i);
  });
});
