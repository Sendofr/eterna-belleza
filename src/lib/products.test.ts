import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  archiveProduct,
  getProducts,
  saveProduct,
  seedProducts,
  setStock,
} from './products'

let data: Map<string, string>
beforeEach(() => {
  data = new Map()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
  })
})

describe('local inventory demonstration', () => {
  it('starts with five independent examples and persists creates and edits', async () => {
    expect(await getProducts()).toHaveLength(5)
    const created = await saveProduct({
      ...seedProducts[0],
      name: 'Prenda real',
      sku: 'EB-001',
      stock: 8,
      is_example: false,
    })
    expect(created.id).not.toBe(seedProducts[0].id)
    expect(await getProducts()).toHaveLength(6)
    await saveProduct(
      { ...created, visible: false, name: 'Prenda actualizada' },
      created.id,
    )
    expect(
      (await getProducts()).find((item) => item.id === created.id),
    ).toMatchObject({ name: 'Prenda actualizada', visible: false })
  })
  it('ignores supplied codes, generates unique automatic codes and preserves the code on edit', async () => {
    const first = await saveProduct({
      ...seedProducts[0],
      sku: 'demo-001',
      name: '',
    })
    const second = await saveProduct({ ...seedProducts[0], sku: 'demo-001' })
    expect(first.sku).toBe('EB-0001')
    expect(second.sku).toBe('EB-0002')
    expect(first.name).toBe('Vestidos · A confirmar')
    const edited = await saveProduct({ ...first, sku: 'EB-9999' }, first.id)
    expect(edited.sku).toBe('EB-0001')
    await archiveProduct(second.id, true)
    expect((await saveProduct({ ...seedProducts[0] })).sku).toBe('EB-0003')
    expect(await getProducts()).toHaveLength(8)
  })
  it('archives and restores without deleting a product', async () => {
    await archiveProduct(seedProducts[0].id, true)
    expect((await getProducts())[0].archived).toBe(true)
    await archiveProduct(seedProducts[0].id, false)
    expect((await getProducts())[0].archived).toBe(false)
  })
  it('applies stock changes to current persisted value and disallows underflow', async () => {
    const stale = seedProducts[0]
    await setStock(stale, 1)
    const updated = await setStock(stale, 1)
    expect(updated.stock).toBe(3)
    await expect(setStock(updated, -4)).rejects.toThrow('stock')
    expect((await getProducts())[0].stock).toBe(3)
  })
  it('shows corrupt storage as an error instead of losing the saved inventory', async () => {
    data.set('eterna-belleza-products-v1', '{broken')
    await expect(getProducts()).rejects.toThrow('No se pudo leer')
    expect(data.get('eterna-belleza-products-v1')).toBe('{broken')
  })
  it('reports a write failure instead of claiming the product was saved', async () => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota exceeded')
      },
    })
    await expect(
      saveProduct({ ...seedProducts[0], sku: 'EB-002' }),
    ).rejects.toThrow('No se pudo guardar')
  })
})
