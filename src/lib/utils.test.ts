import { describe, expect, it } from 'vitest'
import { csvCell, formatPrice, productsToCsv, whatsappUrl } from './utils'
import { seedProducts, validateProduct } from './products'

describe('public product formatting', () => {
  it('distinguishes a missing price from a free product', () => {
    expect(formatPrice(null)).toBe('A consultar')
    expect(formatPrice(0)).toBe('Gs. 0')
    expect(formatPrice(125000)).toContain('125.000')
  })
  it('sends the real contact number and encoded product information', () => {
    const url = new URL(
      whatsappUrl({ name: 'Top & falda', sku: 'EB-01', size: 'M' }),
    )
    expect(url.pathname).toBe('/595981917788')
    expect(url.searchParams.get('text')).toContain(
      'Top & falda (código EB-01, talle M)',
    )
  })
})
describe('CSV export', () => {
  it('escapes commas, line breaks, and quotes while preserving content', () => {
    expect(csvCell('Top, "rosa"\nM')).toBe('"Top, ""rosa""\nM"')
  })
  it('neutralizes spreadsheet formula injection, even after whitespace', () => {
    for (const input of [
      '=HYPERLINK("evil")',
      '+SUM(1)',
      '@SUM(1)',
      '-1+1',
      '  =1+1',
      '\t=1+1',
    ]) {
      expect(csvCell(input).startsWith('"\'')).toBe(true)
    }
  })
  it('exports the selected inventory and does not turn null into zero', () => {
    const text = productsToCsv([seedProducts[0]])
    expect(text).toContain('"DEMO-001"')
    expect(text).toContain('"A confirmar","","1"')
    expect(text.split('\r\n')).toHaveLength(2)
  })
})
describe('product input validation', () => {
  it('normalizes text fields', () => {
    expect(
      validateProduct({ ...seedProducts[0], name: '  Vestido  ' }).name,
    ).toBe('Vestido')
  })
  it.each([-1, 0.5, Infinity, NaN, 1_000_001])(
    'rejects invalid stock %s',
    (stock) => {
      expect(() => validateProduct({ ...seedProducts[0], stock })).toThrow(
        'stock',
      )
    },
  )
  it('rejects invalid prices and categories', () => {
    expect(() => validateProduct({ ...seedProducts[0], price: -1 })).toThrow(
      'precio',
    )
    expect(() =>
      validateProduct({ ...seedProducts[0], category: 'No existe' }),
    ).toThrow('categoría')
  })
})
