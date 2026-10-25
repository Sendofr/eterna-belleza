import { beforeEach, describe, expect, it, vi } from 'vitest'

const mock = vi.hoisted(() => ({
  select: vi.fn(),
  eq: vi.fn(),
  from: vi.fn(),
  storageFrom: vi.fn(),
  remove: vi.fn(),
}))
vi.mock('./supabase', () => ({
  assertConfiguration: () => {},
  isConfigured: true,
  supabase: {
    from: mock.from,
    storage: { from: mock.storageFrom },
  },
}))
import { removeProductImage } from './products'

beforeEach(() => {
  vi.clearAllMocks()
  mock.from.mockReturnValue({ select: mock.select })
  mock.select.mockReturnValue({ eq: mock.eq })
  mock.eq.mockResolvedValue({ count: 0, error: null })
  mock.storageFrom.mockReturnValue({ remove: mock.remove })
  mock.remove.mockResolvedValue({ error: null })
})

describe('unused inventory photo cleanup', () => {
  it.each(['/images/tropical.webp', 'data:image/webp;base64,abc', ''])(
    'preserves bundled and local photos: %s',
    async (path) => {
      await removeProductImage(path)
      expect(mock.from).not.toHaveBeenCalled()
      expect(mock.remove).not.toHaveBeenCalled()
    },
  )
  it('removes an uploaded photo only after checking no product refers to it', async () => {
    await removeProductImage('owner/photo.webp')
    expect(mock.from).toHaveBeenCalledWith('products')
    expect(mock.select).toHaveBeenCalledWith('id', {
      count: 'exact',
      head: true,
    })
    expect(mock.eq).toHaveBeenCalledWith('image_path', 'owner/photo.webp')
    expect(mock.storageFrom).toHaveBeenCalledWith('product-images')
    expect(mock.remove).toHaveBeenCalledWith(['owner/photo.webp'])
  })
  it('preserves a photo shared with another product', async () => {
    mock.eq.mockResolvedValue({ count: 1, error: null })
    await removeProductImage('owner/photo.webp')
    expect(mock.remove).not.toHaveBeenCalled()
  })
  it('keeps the photo when checking references fails', async () => {
    mock.eq.mockResolvedValue({
      count: null,
      error: { message: 'network unavailable' },
    })
    await expect(removeProductImage('owner/photo.webp')).rejects.toThrow(
      'se conservó el archivo',
    )
    expect(mock.remove).not.toHaveBeenCalled()
  })
  it('keeps the photo when the reference count is unknown', async () => {
    mock.eq.mockResolvedValue({ count: null, error: null })
    await expect(removeProductImage('owner/photo.webp')).rejects.toThrow(
      'se conservó el archivo',
    )
    expect(mock.remove).not.toHaveBeenCalled()
  })
  it('reports cleanup failure without pretending the product save failed', async () => {
    mock.remove.mockResolvedValue({ error: { message: 'not authorized' } })
    await expect(removeProductImage('owner/photo.webp')).rejects.toThrow(
      'La prenda se conservó',
    )
  })
})
