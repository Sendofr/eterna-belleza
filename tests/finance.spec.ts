import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const STORE = 'eterna-belleza-state-v2'

async function state(page: Page) {
  return page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key) || '{}'),
    STORE,
  )
}

async function inventory(page: Page) {
  await page.goto('/admin')
  await page
    .getByRole('button', { name: 'Explorar inventario de ejemplo' })
    .click()
  await expect(
    page.getByRole('heading', { name: 'Tu inventario.' }),
  ).toBeVisible()
}

async function garment(page: Page, name: string, stock = '3') {
  await page.getByRole('button', { name: 'Nueva prenda', exact: true }).click()
  const modal = page.getByRole('dialog', { name: 'Una nueva prenda.' })
  await modal.getByLabel('Nombre de la prenda', { exact: true }).fill(name)
  await modal.getByLabel('Precio de venta (Gs.)', { exact: true }).fill('85000')
  await modal
    .getByLabel('Precio de compra (Gs.)', { exact: true })
    .fill('40000')
  await modal.getByLabel('Unidades en stock', { exact: true }).fill(stock)
  await modal.getByRole('button', { name: 'Guardar prenda' }).click()
  await expect(modal).not.toBeVisible()
  await expect(page.locator('tbody tr').filter({ hasText: name })).toBeVisible()
}

function metric(page: Page, name: string) {
  return page.getByRole('article', { name, exact: true })
}

async function sale(page: Page, name: string, soldOn?: string) {
  await page
    .getByRole('button', { name: 'Registrar venta', exact: true })
    .first()
    .click()
  const modal = page.getByRole('dialog', { name: 'Registrar venta' })
  const product = (await state(page)).products.find(
    (p: { name: string }) => p.name === name,
  )
  await modal
    .getByRole('combobox', { name: /^Prenda/ })
    .selectOption(product.id)
  await modal.getByLabel('Unidades', { exact: true }).fill('1')
  await modal
    .getByLabel('Precio de venta por unidad (Gs.)', { exact: true })
    .fill('85000')
  if (soldOn)
    await modal.getByLabel('Fecha de venta', { exact: true }).fill(soldOn)
  await modal
    .getByRole('combobox', { name: /^Medio de pago/ })
    .selectOption('Transferencia')
  await modal
    .getByRole('button', { name: 'Confirmar venta', exact: true })
    .click()
  await expect(modal).not.toBeVisible()
}

test('ventas y gastos calculan ganancia mensual real; editar costos no altera ventas pasadas', async ({
  page,
}) => {
  await inventory(page)
  await garment(page, 'Blusa finanzas')
  await page.getByRole('button', { name: 'Finanzas', exact: true }).click()
  await sale(page, 'Blusa finanzas')
  let saved = await state(page)
  const product = saved.products.find(
    (p: { name: string }) => p.name === 'Blusa finanzas',
  )
  expect(product.stock).toBe(2)
  expect(saved.sales).toHaveLength(1)
  expect(saved.sales[0].unit_cost).toBe(40000)
  expect(saved.sales[0].payment_method).toBe('Transferencia')
  await expect(metric(page, 'Ingresos')).toContainText('85.000')
  await expect(metric(page, 'Ganancia neta')).toContainText('45.000')

  await page
    .getByRole('button', { name: 'Cargar gasto', exact: true })
    .first()
    .click()
  const expenseForm = page.getByRole('dialog', { name: 'Registrar gasto' })
  await expenseForm
    .getByLabel('Descripción', { exact: true })
    .fill('Bolsas para entregas')
  await expenseForm.getByLabel('Importe (Gs.)', { exact: true }).fill('10000')
  await expenseForm
    .getByRole('button', { name: 'Guardar gasto', exact: true })
    .click()
  await expect(expenseForm).not.toBeVisible()
  await expect(metric(page, 'Gastos')).toContainText('10.000')
  await expect(metric(page, 'Ganancia neta')).toContainText('35.000')

  await page.getByRole('button', { name: 'Inventario', exact: false }).click()
  await page
    .locator('tbody tr')
    .filter({ hasText: 'Blusa finanzas' })
    .getByRole('button', { name: 'Editar', exact: true })
    .click()
  const edit = page.getByRole('dialog', { name: 'Editá tu prenda.' })
  await edit.getByLabel('Precio de compra (Gs.)', { exact: true }).fill('50000')
  await edit.getByRole('button', { name: 'Guardar prenda' }).click()
  await expect(edit).not.toBeVisible()
  await page.getByRole('button', { name: 'Finanzas', exact: true }).click()
  await expect(metric(page, 'Ganancia neta')).toContainText('35.000')
  saved = await state(page)
  expect(saved.sales[0].unit_cost).toBe(40000)

  const month = await page
    .getByLabel('Mes del resumen', { exact: true })
    .inputValue()
  const previousDate = new Date(`${month}-15T12:00:00Z`)
  previousDate.setUTCMonth(previousDate.getUTCMonth() - 1)
  const previous = previousDate.toISOString().slice(0, 10)
  await sale(page, 'Blusa finanzas', previous)
  await expect(metric(page, 'Ingresos')).toContainText('85.000')
  await page
    .getByLabel('Mes del resumen', { exact: true })
    .fill(previous.slice(0, 7))
  await expect(metric(page, 'Ingresos')).toContainText('85.000')
  await expect(metric(page, 'Gastos')).toContainText('Gs. 0')
  await expect(metric(page, 'Ganancia neta')).toContainText('35.000')
  saved = await state(page)
  expect(saved.sales).toHaveLength(2)
  expect(
    saved.sales.find((s: { sold_on: string }) => s.sold_on === previous)
      .unit_cost,
  ).toBe(50000)
  expect(
    saved.products.find((p: { id: string }) => p.id === product.id).stock,
  ).toBe(1)

  await page.getByLabel('Mes del resumen', { exact: true }).fill(month)
  await page.getByRole('button', { name: /^Ventas/ }).click()
  const saleRow = page.locator('tbody tr').filter({ hasText: 'Blusa finanzas' })
  await saleRow.getByRole('button', { name: 'Anular', exact: true }).click()
  const cancel = page.getByRole('dialog', { name: 'Anular venta' })
  await cancel
    .getByRole('button', { name: 'Confirmar anulación', exact: true })
    .click()
  await expect(cancel).not.toBeVisible()
  await expect(saleRow).toContainText('Anulada')
  await expect(metric(page, 'Ingresos')).toContainText('Gs. 0')
  await expect(metric(page, 'Ganancia neta')).toContainText('-10.000')
  saved = await state(page)
  expect(
    saved.products.find((p: { id: string }) => p.id === product.id).stock,
  ).toBe(2)

  await page.getByRole('button', { name: /^Gastos/ }).click()
  const expenseRow = page
    .locator('tbody tr')
    .filter({ hasText: 'Bolsas para entregas' })
  await expenseRow.getByRole('button', { name: 'Editar', exact: true }).click()
  const editExpense = page.getByRole('dialog', { name: 'Editar gasto' })
  await editExpense.getByLabel('Importe (Gs.)', { exact: true }).fill('15000')
  await editExpense
    .getByRole('button', { name: 'Guardar gasto', exact: true })
    .click()
  await expect(editExpense).not.toBeVisible()
  await expect(metric(page, 'Ganancia neta')).toContainText('-15.000')
  await expenseRow
    .getByRole('button', { name: 'Eliminar', exact: true })
    .click()
  const deleteExpense = page.getByRole('dialog', { name: 'Eliminar gasto' })
  await deleteExpense
    .getByRole('button', { name: 'Eliminar gasto', exact: true })
    .click()
  await expect(deleteExpense).not.toBeVisible()
  await expect(metric(page, 'Ganancia neta')).toContainText('Gs. 0')
  expect((await state(page)).expenses).toHaveLength(0)
  await page.reload()
  await page
    .getByRole('button', { name: 'Explorar inventario de ejemplo' })
    .click()
  await page.getByRole('button', { name: 'Finanzas', exact: true }).click()
  expect(
    (await state(page)).sales.filter(
      (s: { voided_at: string | null }) => !s.voided_at,
    ),
  ).toHaveLength(1)
})

test('finanzas móvil: evita vender sin costo o más unidades que el stock', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await inventory(page)
  await garment(page, 'Prenda móvil finanzas', '1')
  await page
    .getByRole('button', { name: 'Abrir navegación', exact: true })
    .click()
  await page.getByRole('button', { name: 'Finanzas', exact: true }).click()
  await page
    .getByRole('button', { name: 'Registrar venta', exact: true })
    .first()
    .click()
  const modal = page.getByRole('dialog', { name: 'Registrar venta' })
  const seed = (await state(page)).products.find(
    (p: { sku: string }) => p.sku === 'DEMO-001',
  )
  await modal.getByRole('combobox', { name: /^Prenda/ }).selectOption(seed.id)
  await expect(modal.getByRole('alert')).toContainText(
    'todavía no tiene precio de compra',
  )
  await expect(
    modal.getByRole('button', { name: 'Confirmar venta', exact: true }),
  ).toBeDisabled()
  const product = (await state(page)).products.find(
    (p: { name: string }) => p.name === 'Prenda móvil finanzas',
  )
  await modal
    .getByRole('combobox', { name: /^Prenda/ })
    .selectOption(product.id)
  await modal.getByLabel('Unidades', { exact: true }).fill('2')
  await expect(
    modal.getByRole('button', { name: 'Confirmar venta', exact: true }),
  ).toBeDisabled()
  await modal.getByLabel('Unidades', { exact: true }).fill('1')
  await modal
    .getByRole('button', { name: 'Confirmar venta', exact: true })
    .click()
  await expect(modal).not.toBeVisible()
  await expect(metric(page, 'Ganancia neta')).toContainText('45.000')
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await page.screenshot({
    path: '/tmp/eterna-finance-mobile.png',
    fullPage: true,
  })
})
