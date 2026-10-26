import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEMO_STATE_KEY,
  getProducts,
  readDemoState,
  saveProduct,
  seedProducts,
  setStock,
} from './products'
import {
  deleteExpense,
  getFinanceData,
  getProductCosts,
  monthlySummary,
  recordSale,
  saveExpense,
  todayDate,
  voidSale,
} from './finance'

let data: Map<string, string>
beforeEach(() => {
  data = new Map()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
  })
})
const sample = () => ({
  ...seedProducts[0],
  name: 'Camisa rosa',
  category: 'Camisas',
  stock: 3,
  is_example: false,
})
const saleInput = (product_id: string) => ({
  product_id,
  quantity: 2,
  unit_price: 50000,
  sold_on: '2025-10-15',
  payment_method: 'Efectivo' as const,
  request_id: crypto.randomUUID(),
})

describe('private costs and monthly realized profit', () => {
  it('keeps purchase cost out of public product data and snapshots it for historical sales', async () => {
    const product = await saveProduct(sample(), undefined, 20000)
    expect(product).not.toHaveProperty('purchase_cost')
    expect(
      (await getProducts()).find((item) => item.id === product.id),
    ).not.toHaveProperty('purchase_cost')
    expect(await getProductCosts()).toEqual({ [product.id]: 20000 })
    await saveProduct({ ...product, name: 'Camisa editada' }, product.id)
    expect((await getProductCosts())[product.id]).toBe(20000)
    const sold = await recordSale(saleInput(product.id))
    expect(sold.unit_cost).toBe(20000)
    await saveProduct({ ...product, stock: 1 }, product.id, 35000)
    const expense = await saveExpense({
      description: 'Envío de mercadería',
      category: 'Transporte',
      amount: 10000,
      incurred_on: '2025-10-16',
    })
    await saveExpense({
      description: 'Otro mes',
      category: 'Otros',
      amount: 99999,
      incurred_on: '2025-11-01',
    })
    const finance = await getFinanceData()
    expect(
      monthlySummary(finance.sales, finance.expenses, '2025-10'),
    ).toMatchObject({
      revenue: 100000,
      costOfGoods: 40000,
      expenses: 10000,
      profit: 50000,
      unitsSold: 2,
      salesCount: 1,
      margin: 50,
    })
    await saveExpense({ ...expense, amount: 12000 }, expense.id)
    expect(
      monthlySummary(
        (await getFinanceData()).sales,
        (await getFinanceData()).expenses,
        '2025-10',
      ).profit,
    ).toBe(48000)
    await deleteExpense(expense.id)
    expect((await getFinanceData()).expenses).toHaveLength(1)
  })
  it('does not count manual stock adjustments as sales', async () => {
    await setStock(seedProducts[0], -1)
    expect((await getFinanceData()).sales).toHaveLength(0)
    expect(monthlySummary([], [], '2025-10').profit).toBe(0)
  })
  it('requires an explicitly known purchase cost, permitting zero', async () => {
    const product = await saveProduct(sample())
    await expect(recordSale(saleInput(product.id))).rejects.toThrow(
      'precio de compra',
    )
    expect(
      (await getProducts()).find((item) => item.id === product.id)?.stock,
    ).toBe(3)
    await saveProduct(product, product.id, 0)
    expect((await recordSale(saleInput(product.id))).unit_cost).toBe(0)
    await saveProduct({ ...product, stock: 1 }, product.id, null)
    expect((await getProductCosts())[product.id]).toBeUndefined()
  })
  it('records a retry only once and refuses an idempotency key used with different data', async () => {
    const product = await saveProduct(sample(), undefined, 10000)
    const input = saleInput(product.id)
    const sale = await recordSale(input)
    expect((await recordSale(input)).id).toBe(sale.id)
    expect(
      (await getProducts()).find((item) => item.id === product.id)?.stock,
    ).toBe(1)
    await expect(recordSale({ ...input, quantity: 1 })).rejects.toThrow(
      'otra venta',
    )
    expect((await getFinanceData()).sales).toHaveLength(1)
    await expect(
      recordSale({ ...input, request_id: crypto.randomUUID() }),
    ).rejects.toThrow('stock')
    expect((await getFinanceData()).sales).toHaveLength(1)
  })
  it('voids only once, restores stock and excludes the sale from all monthly totals', async () => {
    const product = await saveProduct(sample(), undefined, 10000)
    const sale = await recordSale(saleInput(product.id))
    await voidSale(sale.id)
    await voidSale(sale.id)
    expect(
      (await getProducts()).find((item) => item.id === product.id)?.stock,
    ).toBe(3)
    const { sales, expenses } = await getFinanceData()
    expect(monthlySummary(sales, expenses, '2025-10')).toMatchObject({
      revenue: 0,
      costOfGoods: 0,
      profit: 0,
      unitsSold: 0,
      salesCount: 0,
    })
    expect(sales).toHaveLength(1)
    expect(sales[0].voided_at).toBeTruthy()
  })
  it('migrates old inventories with their codes and generates numbers after the existing maximum', async () => {
    data.set(
      'eterna-belleza-products-v1',
      JSON.stringify([{ ...seedProducts[0], sku: 'EB-9999' }]),
    )
    const next = await saveProduct(sample(), undefined, 12000)
    expect(next.sku).toBe('EB-10000')
    expect(readDemoState().products[0].sku).toBe('EB-9999')
    expect(data.get('eterna-belleza-products-v1')).toContain('EB-9999')
    expect(data.has(DEMO_STATE_KEY)).toBe(true)
  })
  it('cannot partially save stock if local storage fails during a sale', async () => {
    const product = await saveProduct(sample(), undefined, 10000)
    const before = data.get(DEMO_STATE_KEY)
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: () => {
        throw new Error('full')
      },
    })
    await expect(recordSale(saleInput(product.id))).rejects.toThrow(
      'No se pudo guardar',
    )
    expect(data.get(DEMO_STATE_KEY)).toBe(before)
  })
  it('validates expense amounts, dates and empty descriptions without writing data', async () => {
    const expense = {
      description: 'Alquiler',
      category: 'Servicios',
      amount: 10000,
      incurred_on: '2025-10-01',
    }
    await expect(saveExpense({ ...expense, amount: -5 })).rejects.toThrow(
      'gasto',
    )
    await expect(saveExpense({ ...expense, description: ' ' })).rejects.toThrow(
      'descripción',
    )
    await expect(
      saveExpense({ ...expense, incurred_on: '2025-02-30' }),
    ).rejects.toThrow('fecha')
    await expect(
      saveExpense({ ...expense, incurred_on: '2099-01-01' }),
    ).rejects.toThrow('fecha')
    expect((await getFinanceData()).expenses).toHaveLength(0)
    expect(todayDate()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
