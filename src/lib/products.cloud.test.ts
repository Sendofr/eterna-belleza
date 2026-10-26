import { beforeEach, describe, expect, it, vi } from 'vitest'

const mock = vi.hoisted(() => ({
  from: vi.fn(),
  select: vi.fn(),
  order: vi.fn(),
  range: vi.fn(),
  rpc: vi.fn(),
  eq: vi.fn(),
  maybeSingle: vi.fn(),
}))
vi.mock('./supabase', () => ({
  assertConfiguration: () => {},
  isConfigured: true,
  supabase: { from: mock.from, rpc: mock.rpc },
}))
import { getProducts, saveProduct, seedProducts } from './products'
import { getProductCosts } from './finance'

beforeEach(() => {
  vi.clearAllMocks()
  mock.from.mockReturnValue({ select: mock.select })
  mock.select.mockReturnValue({ order: mock.order, eq: mock.eq })
  mock.eq.mockReturnValue({ maybeSingle: mock.maybeSingle })
  mock.order.mockReturnValue({ order: mock.order, range: mock.range })
})
describe('Supabase inventory requests', () => {
  it('paginates public products so a catalogue above the server default limit is complete', async () => {
    mock.range
      .mockResolvedValueOnce({
        data: Array.from({ length: 500 }, (_, id) => ({
          ...seedProducts[0],
          id: String(id),
        })),
        error: null,
      })
      .mockResolvedValueOnce({
        data: Array.from({ length: 500 }, (_, id) => ({
          ...seedProducts[0],
          id: String(500 + id),
        })),
        error: null,
      })
      .mockResolvedValueOnce({
        data: [{ ...seedProducts[0], id: '1000' }],
        error: null,
      })
    expect(await getProducts()).toHaveLength(1001)
    expect(mock.range.mock.calls).toEqual([
      [0, 499],
      [500, 999],
      [1000, 1499],
    ])
  })
  it('paginates private costs independently of public product rows', async () => {
    mock.range
      .mockResolvedValueOnce({
        data: Array.from({ length: 500 }, (_, id) => ({
          product_id: String(id),
          purchase_cost: 100,
        })),
        error: null,
      })
      .mockResolvedValueOnce({
        data: [{ product_id: 'last', purchase_cost: 250 }],
        error: null,
      })
    const costs = await getProductCosts()
    expect(Object.keys(costs)).toHaveLength(501)
    expect(costs.last).toBe(250)
    expect(mock.from).toHaveBeenCalledWith('product_costs')
  })
  it('sends cost only as a private RPC argument and strips caller IDs and codes from product fields', async () => {
    mock.rpc.mockResolvedValue({
      data: { ...seedProducts[0], sku: 'EB-0001' },
      error: null,
    })
    const input = {
      ...seedProducts[0],
      name: '',
      sku: 'CUSTOM',
      purchase_cost: 999999,
    }
    await saveProduct(input, undefined, 35000)
    expect(mock.rpc).toHaveBeenCalledWith('save_inventory_product', {
      product_data: {
        name: 'Vestidos · A confirmar',
        category: 'Vestidos',
        size: 'A confirmar',
        price: null,
        stock: 1,
        image_path: '/images/tropical.webp',
        visible: true,
        archived: false,
        is_example: true,
      },
      purchase_cost: 35000,
      product_id: null,
    })
  })
  it('explains missing migration without exposing server internals or falling back to demo', async () => {
    mock.rpc.mockResolvedValue({
      data: null,
      error: { code: 'PGRST202', message: 'unknown schema internal routine' },
    })
    await expect(saveProduct(seedProducts[0])).rejects.toThrow(
      'Falta actualizar la base de datos',
    )
  })
  it('preserves an existing private cost when edit callers omit the cost argument', async () => {
    mock.maybeSingle.mockResolvedValue({
      data: { purchase_cost: 42000 },
      error: null,
    })
    mock.rpc.mockResolvedValue({ data: seedProducts[0], error: null })
    await saveProduct(
      { ...seedProducts[0], name: 'Nueva descripción' },
      seedProducts[0].id,
    )
    expect(mock.rpc.mock.calls[0][1].purchase_cost).toBe(42000)
    expect(mock.eq).toHaveBeenCalledWith('product_id', seedProducts[0].id)
  })
})
