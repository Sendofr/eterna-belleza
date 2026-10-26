import { assertConfiguration, isConfigured, supabase } from './supabase'
import type { Expense, Sale } from './finance'

export { isConfigured }

export const CATEGORIES = [
  'Vestidos',
  'Tops',
  'Sport',
  'Pantalones',
  'Shorts',
  'Blazers',
  'Camisas',
  'Infantiles',
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
export type ProductInput = Omit<Product, 'id' | 'sku'> & { sku?: string }

const STORAGE_KEY = 'eterna-belleza-products-v1'
export const DEMO_STATE_KEY = 'eterna-belleza-state-v2'
export interface DemoState {
  products: Product[]
  costs: Record<string, number>
  sales: Sale[]
  expenses: Expense[]
  skuSequence: number
}
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

export function errorMessage(error: unknown, fallback: string): Error {
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String(error.code)
      : ''
  const message =
    error && typeof error === 'object' && 'message' in error
      ? String(error.message)
      : ''
  if (code === '23505')
    return new Error(
      'Ese registro ya existe. Actualizá la lista antes de volver a guardar.',
    )
  if (code === '42501')
    return new Error(
      'Tu cuenta no tiene permiso para esta acción. Iniciá sesión con la cuenta autorizada.',
    )
  if (['PGRST202', 'PGRST205', '42883', '42P01'].includes(code))
    return new Error(
      'Falta actualizar la base de datos. Aplicá el SQL de inventario y finanzas indicado en la guía.',
    )
  if (
    /costo|stock|cantidad|precio|fecha|pago|archivad|existe|solicitud/i.test(
      message,
    ) &&
    !/column|relation|constraint|syntax|permission|schema|query/i.test(message)
  )
    return new Error(message)
  return new Error(fallback)
}

export function validateProduct(input: ProductInput): ProductInput {
  const clean = {
    ...input,
    name:
      input.name.trim() ||
      `${input.category}${input.size.trim() ? ` · ${input.size.trim()}` : ''}`,
    size: input.size.trim(),
  }
  if (!clean.name || clean.name.length > 160)
    throw new Error('Ingresá un nombre de hasta 160 caracteres.')
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
    (!Number.isSafeInteger(clean.price) ||
      clean.price < 0 ||
      clean.price > 1_000_000_000)
  ) {
    throw new Error(
      'El precio debe ser un número entre 0 y 1.000.000.000, o quedar vacío.',
    )
  }
  return clean
}

export function readDemoState(): DemoState {
  try {
    const stored = localStorage.getItem(DEMO_STATE_KEY)
    const legacy = stored ? null : localStorage.getItem(STORAGE_KEY)
    const state: DemoState = stored
      ? JSON.parse(stored)
      : {
          products: legacy
            ? JSON.parse(legacy)
            : seedProducts.map((product) => ({ ...product })),
          costs: {},
          sales: [],
          expenses: [],
          skuSequence: 0,
        }
    if (
      !Array.isArray(state.products) ||
      !state.costs ||
      !Array.isArray(state.sales) ||
      !Array.isArray(state.expenses) ||
      !Number.isSafeInteger(state.skuSequence) ||
      state.skuSequence < 0
    )
      throw new Error('Formato inválido')
    for (const item of state.products) {
      if (!item || typeof item !== 'object' || typeof item.id !== 'string')
        throw new Error('Formato inválido')
      if (typeof item.sku !== 'string' || !item.sku.trim())
        throw new Error('Formato inválido')
      validateProduct(item as Product)
    }
    return state
  } catch {
    throw new Error(
      'No se pudo leer el inventario local. Revisá los permisos de almacenamiento de este navegador; tus datos no se reemplazaron.',
    )
  }
}

function writeLocal(state: DemoState): void {
  try {
    localStorage.setItem(DEMO_STATE_KEY, JSON.stringify(state))
  } catch {
    throw new Error(
      'No se pudo guardar en este navegador. Puede faltar espacio o estar bloqueado el almacenamiento. Probá una imagen más pequeña.',
    )
  }
}

/** A single storage write commits stock, codes and accounting together. Web Locks serialize browser tabs. */
export async function transactDemo<T>(
  operation: (state: DemoState) => T,
): Promise<T> {
  const commit = () => {
    const state = readDemoState()
    const result = operation(state)
    writeLocal(state)
    return result
  }
  if (typeof window !== 'undefined' && navigator.locks)
    return navigator.locks.request('eterna-belleza-inventory', commit)
  return commit()
}

function nextSku(state: DemoState): string {
  const existingMax = state.products.reduce(
    (max, product) =>
      /^EB-\d+$/i.test(product.sku)
        ? Math.max(max, Number(product.sku.slice(3)))
        : max,
    0,
  )
  state.skuSequence = Math.max(state.skuSequence, existingMax) + 1
  if (!Number.isSafeInteger(state.skuSequence))
    throw new Error('No se pudo generar un código. Contactá a soporte.')
  return `EB-${String(state.skuSequence).padStart(4, '0')}`
}

export async function getProducts(): Promise<Product[]> {
  assertConfiguration()
  if (!supabase) return readDemoState().products
  const products: Product[] = []
  for (let start = 0; ; start += 500) {
    const { data, error } = await supabase
      .from('products')
      .select(
        'id,name,sku,category,size,price,stock,image_path,visible,archived,is_example',
      )
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(start, start + 499)
    if (error)
      throw errorMessage(
        error,
        'No se pudo cargar el catálogo. Revisá tu conexión e intentá nuevamente.',
      )
    products.push(...((data ?? []) as Product[]))
    if (!data || data.length < 500) return products
  }
}

export async function saveProduct(
  input: ProductInput,
  id?: string,
  purchaseCost?: number | null,
): Promise<Product> {
  assertConfiguration()
  const clean = validateProduct(input)
  if (
    purchaseCost !== undefined &&
    purchaseCost !== null &&
    (!Number.isSafeInteger(purchaseCost) ||
      purchaseCost < 0 ||
      purchaseCost > 1_000_000_000)
  )
    throw new Error(
      'El costo de compra debe ser un importe entero entre 0 y 1.000.000.000 Gs.',
    )
  // Explicit whitelist: never send IDs, purchase costs or caller-supplied codes into public product fields.
  const publicFields = {
    name: clean.name,
    category: clean.category,
    size: clean.size,
    price: clean.price,
    stock: clean.stock,
    image_path: clean.image_path,
    visible: clean.visible,
    archived: clean.archived,
    is_example: clean.is_example,
  }
  if (!supabase) {
    return transactDemo((state) => {
      const products = state.products
      const previous = id ? products.find((item) => item.id === id) : null
      const product = {
        ...publicFields,
        sku: previous?.sku ?? nextSku(state),
        id: id ?? crypto.randomUUID(),
      }
      if (id) {
        const index = products.findIndex((item) => item.id === id)
        if (index === -1)
          throw new Error(
            'La prenda ya no está en el inventario. Actualizá la lista.',
          )
        products[index] = product
      } else products.push(product)
      if (purchaseCost !== undefined && purchaseCost !== null)
        state.costs[product.id] = purchaseCost
      else if (purchaseCost === null) delete state.costs[product.id]
      return product
    })
  }
  // Omitted cost means "unchanged" on edit; explicit null means "unknown".
  let cost = purchaseCost
  if (id && cost === undefined) {
    const { data, error } = await supabase
      .from('product_costs')
      .select('purchase_cost')
      .eq('product_id', id)
      .maybeSingle()
    if (error)
      throw errorMessage(
        error,
        'No pudimos comprobar el costo de compra. La prenda no se modificó.',
      )
    cost = data?.purchase_cost ?? null
  }
  const { data, error } = await supabase.rpc('save_inventory_product', {
    product_data: publicFields,
    purchase_cost: cost ?? null,
    product_id: id ?? null,
  })
  if (error) throw errorMessage(error, 'No se pudo guardar la prenda')
  return (Array.isArray(data) ? data[0] : data) as Product
}

export async function archiveProduct(
  id: string,
  archived: boolean,
): Promise<Product> {
  assertConfiguration()
  if (!supabase) {
    return transactDemo((state) => {
      const products = state.products
      const product = products.find((item) => item.id === id)
      if (!product) throw new Error('No se encontró la prenda.')
      product.archived = archived
      return product
    })
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
    return transactDemo((state) => {
      const products = state.products
      const current = products.find((item) => item.id === product.id)
      if (!current) throw new Error('No se encontró la prenda.')
      const next = current.stock + delta
      if (next < 0 || next > 1_000_000)
        throw new Error('El stock debe quedar entre 0 y 1.000.000.')
      current.stock = next
      return current
    })
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
