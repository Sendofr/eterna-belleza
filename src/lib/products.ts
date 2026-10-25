import { assertConfiguration, isConfigured, supabase } from './supabase'

export { isConfigured }

export const CATEGORIES = [
  'Vestidos',
  'Tops',
  'Sport',
  'Pantalones',
  'Otros',
] as const
export type Category = (typeof CATEGORIES)[number]
export interface Product {
  id: string
  name: string
  sku: string
  category: string
  size: string
  price: number | null
  stock: number
  image_path: string | null
  visible: boolean
  archived: boolean
  is_example: boolean
}
export type ProductInput = Omit<Product, 'id'>

const STORAGE_KEY = 'eterna-belleza-products-v1'
const defaults = {
  price: null,
  stock: 1,
  size: 'A confirmar',
  visible: true,
  archived: false,
  is_example: true,
}
export const seedProducts: Product[] = [
  {
    ...defaults,
    id: '00000000-0000-4000-a000-000000000001',
    name: 'Vestido tropical',
    sku: 'DEMO-001',
    category: 'Vestidos',
    image_path: '/images/tropical.webp',
  },
  {
    ...defaults,
    id: '00000000-0000-4000-a000-000000000002',
    name: 'Vestido blanco',
    sku: 'DEMO-002',
    category: 'Vestidos',
    image_path: '/images/white.webp',
  },
  {
    ...defaults,
    id: '00000000-0000-4000-a000-000000000003',
    name: 'Top naranja',
    sku: 'DEMO-003',
    category: 'Tops',
    image_path: '/images/orange.webp',
  },
  {
    ...defaults,
    id: '00000000-0000-4000-a000-000000000004',
    name: 'Look sport',
    sku: 'DEMO-004',
    category: 'Sport',
    image_path: '/images/sport.webp',
  },
  {
    ...defaults,
    id: '00000000-0000-4000-a000-000000000005',
    name: 'Top rojo',
    sku: 'DEMO-005',
    category: 'Tops',
    image_path: '/images/rose.webp',
  },
]

function errorMessage(error: unknown, fallback: string): Error {
  if (error && typeof error === 'object' && 'message' in error) {
    return new Error(`${fallback}: ${String(error.message)}`)
  }
  return new Error(fallback)
}

export function validateProduct(input: ProductInput): ProductInput {
  const clean = {
    ...input,
    name: input.name.trim(),
    sku: input.sku.trim(),
    size: input.size.trim(),
  }
  if (!clean.name || clean.name.length > 160)
    throw new Error('Ingresá un nombre de hasta 160 caracteres.')
  if (!clean.sku || clean.sku.length > 64)
    throw new Error('Ingresá un código / SKU de hasta 64 caracteres.')
  if (!CATEGORIES.includes(clean.category as Category))
    throw new Error('Elegí una categoría válida.')
  if (clean.size.length > 80)
    throw new Error('El talle no puede superar los 80 caracteres.')
  if (
    !Number.isSafeInteger(clean.stock) ||
    clean.stock < 0 ||
    clean.stock > 1_000_000
  ) {
    throw new Error('El stock debe ser un número entero entre 0 y 1.000.000.')
  }
  if (
    clean.price !== null &&
    (!Number.isFinite(clean.price) ||
      clean.price < 0 ||
      clean.price > 1_000_000_000)
  ) {
    throw new Error(
      'El precio debe ser un número entre 0 y 1.000.000.000, o quedar vacío.',
    )
  }
  return clean
}

function localProducts(): Product[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return seedProducts.map((product) => ({ ...product }))
    const parsed: unknown = JSON.parse(stored)
    if (!Array.isArray(parsed)) throw new Error('Formato inválido')
    for (const item of parsed) {
      if (!item || typeof item !== 'object' || typeof item.id !== 'string')
        throw new Error('Formato inválido')
      validateProduct(item as Product)
    }
    return parsed as Product[]
  } catch {
    throw new Error(
      'No se pudo leer el inventario local. Revisá los permisos de almacenamiento de este navegador; tus datos no se reemplazaron.',
    )
  }
}

function writeLocal(products: Product[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(products))
  } catch {
    throw new Error(
      'No se pudo guardar en este navegador. Puede faltar espacio o estar bloqueado el almacenamiento. Probá una imagen más pequeña.',
    )
  }
}

export async function getProducts(): Promise<Product[]> {
  assertConfiguration()
  if (!supabase) return localProducts()
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) throw errorMessage(error, 'No se pudo cargar el catálogo')
  return (data ?? []) as Product[]
}

export async function saveProduct(
  input: ProductInput,
  id?: string,
): Promise<Product> {
  assertConfiguration()
  const clean = validateProduct(input)
  if (!supabase) {
    const products = localProducts()
    if (
      products.some(
        (product) =>
          product.id !== id &&
          product.sku.toLocaleLowerCase() === clean.sku.toLocaleLowerCase(),
      )
    ) {
      throw new Error('Ya existe una prenda con ese código / SKU.')
    }
    const product = { ...clean, id: id ?? crypto.randomUUID() }
    if (id) {
      const index = products.findIndex((item) => item.id === id)
      if (index === -1)
        throw new Error(
          'La prenda ya no está en el inventario. Actualizá la lista.',
        )
      products[index] = product
    } else products.push(product)
    writeLocal(products)
    return product
  }
  const query = id
    ? supabase.from('products').update(clean).eq('id', id)
    : supabase.from('products').insert(clean)
  const { data, error } = await query.select('*').single()
  if (error) throw errorMessage(error, 'No se pudo guardar la prenda')
  return data as Product
}

export async function archiveProduct(
  id: string,
  archived: boolean,
): Promise<Product> {
  assertConfiguration()
  if (!supabase) {
    const products = localProducts()
    const product = products.find((item) => item.id === id)
    if (!product) throw new Error('No se encontró la prenda.')
    product.archived = archived
    writeLocal(products)
    return product
  }
  const { data, error } = await supabase
    .from('products')
    .update({ archived })
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw errorMessage(error, 'No se pudo actualizar la prenda')
  return data as Product
}

/** Database RPC performs an atomic update so two owners cannot overwrite each other's stock. */
export async function setStock(
  product: Product,
  delta: number,
): Promise<Product> {
  assertConfiguration()
  if (!Number.isSafeInteger(delta) || Math.abs(delta) > 1_000_000)
    throw new Error('El ajuste de stock no es válido.')
  if (!supabase) {
    const products = localProducts()
    const current = products.find((item) => item.id === product.id)
    if (!current) throw new Error('No se encontró la prenda.')
    const next = current.stock + delta
    if (next < 0 || next > 1_000_000)
      throw new Error('El stock debe quedar entre 0 y 1.000.000.')
    current.stock = next
    writeLocal(products)
    return current
  }
  const { data, error } = await supabase.rpc('adjust_stock', {
    product_id: product.id,
    delta,
  })
  if (error) throw errorMessage(error, 'No se pudo ajustar el stock')
  const result = Array.isArray(data) ? data[0] : data
  if (!result)
    throw new Error(
      'No se encontró la prenda o no tenés permiso para modificarla.',
    )
  return result as Product
}

export function imageUrl(path: string | null): string {
  if (!path) return '/images/brand.svg'
  if (path.startsWith('/') || path.startsWith('data:image/')) return path
  if (!supabase) return '/images/brand.svg'
  return supabase.storage.from('product-images').getPublicUrl(path).data
    .publicUrl
}

export async function uploadProductImage(blob: Blob): Promise<string> {
  assertConfiguration()
  if (blob.type !== 'image/webp')
    throw new Error('La imagen debe convertirse a WebP antes de subirla.')
  if (blob.size > 2 * 1024 * 1024)
    throw new Error('La imagen WebP no puede superar los 2 MB.')
  if (!supabase) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () =>
        reject(new Error('No se pudo guardar la imagen en modo demostración.'))
      reader.readAsDataURL(blob)
    })
  }
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user)
    throw new Error('Iniciá sesión como propietario para subir una foto.')
  const path = `${user.id}/${crypto.randomUUID()}.webp`
  const { error } = await supabase.storage
    .from('product-images')
    .upload(path, blob, {
      contentType: 'image/webp',
      cacheControl: '31536000',
      upsert: false,
    })
  if (error) throw errorMessage(error, 'No se pudo subir la imagen')
  return path
}

/** Remove only an unused uploaded object, never a shared product photograph. */
export async function removeProductImage(path: string): Promise<void> {
  assertConfiguration()
  if (!supabase || !path || path.startsWith('/') || path.startsWith('data:'))
    return
  const { count, error: referenceError } = await supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('image_path', path)
  if (referenceError)
    throw errorMessage(
      referenceError,
      'No se pudo comprobar si la foto sigue en uso; se conservó el archivo',
    )
  if (count === null)
    throw new Error(
      'No se pudo comprobar si la foto sigue en uso; se conservó el archivo.',
    )
  if (count > 0) return
  const { error } = await supabase.storage.from('product-images').remove([path])
  if (error)
    throw errorMessage(
      error,
      'La prenda se conservó, pero no se pudo eliminar la foto que ya no se usa',
    )
}
