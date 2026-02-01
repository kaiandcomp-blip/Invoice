import { test, expect } from '@playwright/test';

test('estimate editor updates preview', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: '견적서', exact: true })).toBeVisible();

  const recipientNameInput = page.getByPlaceholder('회사명').nth(1);
  await recipientNameInput.fill('테스트 회사');

  await expect(page.getByText('테스트 회사').first()).toBeVisible();
});

test('export buttons trigger downloads', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: /PDF/ }).click();
  await expect(page.locator('[data-export-status="pdf"]')).toBeVisible();

  await page.getByRole('button', { name: /이미지/ }).click();
  await expect(page.locator('[data-export-status="png"]')).toBeVisible();
});
