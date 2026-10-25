import type { Product } from './products'

export const WHATSAPP_NUMBER = '595981917788'
const priceFormatter = new Intl.NumberFormat('es-PY', {
  maximumFractionDigits: 0,
})
export function formatPrice(price: number | null): string {
  return price === null ? 'A consultar' : `Gs. ${priceFormatter.format(price)}`
}
export function whatsappUrl(
  product?: Pick<Product, 'name' | 'sku' | 'size'>,
): string {
  const message = product
    ? `¡Hola, Eterna Belleza! Me interesa ${product.name} (código ${product.sku}${product.size ? `, talle ${product.size}` : ''}). ¿Me pasan más información?`
    : '¡Hola, Eterna Belleza! Quisiera consultar por sus prendas.'
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`
}

// Spreadsheet software can execute formulas even when the CSV field is quoted.
// Prefix suspicious input (including leading whitespace/control chars) with an apostrophe.
export function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? '' : String(value)
  if (/^[\s\u0000-\u001f]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text))
    text = `'${text}`
  return `"${text.replaceAll('"', '""')}"`
}
export function productsToCsv(products: Product[]): string {
  const rows: unknown[][] = [
    [
      'Nombre',
      'Código / SKU',
      'Categoría',
      'Talle',
      'Precio (Gs.)',
      'Stock',
      'Visible',
      'Archivada',
    ],
  ]
  for (const p of products)
    rows.push([
      p.name,
      p.sku,
      p.category,
      p.size,
      p.price,
      p.stock,
      p.visible ? 'Sí' : 'No',
      p.archived ? 'Sí' : 'No',
    ])
  return '\uFEFF' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n')
}
export function exportProductsCsv(products: Product[]): void {
  const blob = new Blob([productsToCsv(products)], {
    type: 'text/csv;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `eterna-belleza-inventario-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
