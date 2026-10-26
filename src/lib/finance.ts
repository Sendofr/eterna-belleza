import { assertConfiguration, supabase } from './supabase'
import { errorMessage, readDemoState, transactDemo } from './products'

export type PaymentMethod = 'Efectivo' | 'Transferencia'
export interface ProductCost {
  product_id: string
  purchase_cost: number
}
export interface Sale {
  id: string
  product_id: string
  product_name: string
  product_sku: string
  quantity: number
  unit_price: number
  unit_cost: number
  sold_on: string
  payment_method: PaymentMethod
  voided_at: string | null
  request_id: string
}
export interface Expense {
  id: string
  description: string
  category: string
  amount: number
  incurred_on: string
}
export type ExpenseInput = Omit<Expense, 'id'>
export interface SaleInput {
  product_id: string
  quantity: number
  unit_price: number
  sold_on: string
  payment_method: PaymentMethod
  request_id: string
}

/** Business dates follow Paraguay, independently of the device's timezone. */
export function todayDate(): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Asuncion',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const part = (type: string) => parts.find((item) => item.type === type)!.value
  return `${part('year')}-${part('month')}-${part('day')}`
}
export function currentMonth(): string {
  return todayDate().slice(0, 7)
}

function validDate(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  )
}
function money(value: number, label: string, allowZero = true): void {
  if (
    !Number.isSafeInteger(value) ||
    value < (allowZero ? 0 : 1) ||
    value > 1_000_000_000
  )
    throw new Error(
      `${label} debe ser un importe entero ${allowZero ? 'desde 0' : 'mayor que 0'} y hasta 1.000.000.000 Gs.`,
    )
}
function businessDate(date: string): void {
  if (!validDate(date) || date > todayDate())
    throw new Error('Elegí una fecha válida que no sea futura.')
}

export async function getProductCosts(): Promise<Record<string, number>> {
  assertConfiguration()
  if (!supabase) return readDemoState().costs
  const costs: Record<string, number> = {}
  for (let start = 0; ; start += 500) {
    const { data, error } = await supabase
      .from('product_costs')
      .select('product_id,purchase_cost')
      .order('product_id')
      .range(start, start + 499)
    if (error)
      throw errorMessage(
        error,
        'No pudimos cargar los costos de compra. Intentá nuevamente.',
      )
    for (const item of (data ?? []) as ProductCost[])
      costs[item.product_id] = Number(item.purchase_cost)
    if (!data || data.length < 500) return costs
  }
}

export async function getFinanceData(): Promise<{
  sales: Sale[]
  expenses: Expense[]
}> {
  assertConfiguration()
  if (!supabase) {
    const state = readDemoState()
    return { sales: state.sales, expenses: state.expenses }
  }
  // Explicit paging avoids silently omitting older months at Supabase's default row limit.
  async function allRows<T>(table: string, date: string): Promise<T[]> {
    const rows: T[] = []
    for (let start = 0; ; start += 500) {
      const { data, error } = await supabase!
        .from(table)
        .select('*')
        .order(date, { ascending: false })
        .order('id', { ascending: true })
        .range(start, start + 499)
      if (error)
        throw errorMessage(
          error,
          'No pudimos cargar las finanzas. Intentá nuevamente.',
        )
      rows.push(...((data ?? []) as T[]))
      if (!data || data.length < 500) return rows
    }
  }
  const [sales, expenses] = await Promise.all([
    allRows<Sale>('sales', 'sold_on'),
    allRows<Expense>('expenses', 'incurred_on'),
  ])
  return { sales, expenses }
}

export async function recordSale(input: SaleInput): Promise<Sale> {
  assertConfiguration()
  if (
    !Number.isSafeInteger(input.quantity) ||
    input.quantity < 1 ||
    input.quantity > 1_000_000
  )
    throw new Error('La cantidad debe ser un entero entre 1 y 1.000.000.')
  money(input.unit_price, 'El precio de venta')
  businessDate(input.sold_on)
  if (!['Efectivo', 'Transferencia'].includes(input.payment_method))
    throw new Error('Elegí Efectivo o Transferencia como medio de pago.')
  if (!/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(input.request_id))
    throw new Error(
      'No pudimos identificar la venta. Cerrá el formulario y volvé a intentarlo.',
    )
  if (!supabase)
    return transactDemo((state) => {
      const previous = state.sales.find(
        (sale) => sale.request_id === input.request_id,
      )
      if (previous) {
        if (
          previous.product_id !== input.product_id ||
          previous.quantity !== input.quantity ||
          previous.unit_price !== input.unit_price ||
          previous.sold_on !== input.sold_on ||
          previous.payment_method !== input.payment_method
        )
          throw new Error(
            'Esta solicitud ya se usó para otra venta. Abrí un formulario nuevo.',
          )
        return previous
      }
      const product = state.products.find(
        (item) => item.id === input.product_id,
      )
      if (!product) throw new Error('La prenda ya no existe en el inventario.')
      if (product.archived)
        throw new Error(
          'Restaurá la prenda archivada antes de registrar su venta.',
        )
      if (product.stock < input.quantity)
        throw new Error(
          'No hay suficiente stock para esa cantidad. Actualizá el inventario.',
        )
      const cost = state.costs[product.id]
      if (cost === undefined)
        throw new Error(
          'Cargá primero el precio de compra de esta prenda para calcular su ganancia.',
        )
      const sale: Sale = {
        ...input,
        id: crypto.randomUUID(),
        product_name: product.name,
        product_sku: product.sku,
        unit_cost: cost,
        voided_at: null,
      }
      product.stock -= input.quantity
      state.sales.unshift(sale)
      return sale
    })
  const { data, error } = await supabase.rpc('record_sale', {
    p_product_id: input.product_id,
    p_quantity: input.quantity,
    p_unit_price: input.unit_price,
    p_sold_on: input.sold_on,
    p_payment_method: input.payment_method,
    p_request_id: input.request_id,
  })
  if (error)
    throw errorMessage(
      error,
      'No pudimos registrar la venta. Revisá los datos e intentá nuevamente.',
    )
  return (Array.isArray(data) ? data[0] : data) as Sale
}

export async function voidSale(id: string): Promise<void> {
  assertConfiguration()
  if (!supabase)
    return transactDemo((state) => {
      const sale = state.sales.find((item) => item.id === id)
      if (!sale) throw new Error('No se encontró la venta.')
      if (sale.voided_at) return
      const product = state.products.find((item) => item.id === sale.product_id)
      if (!product)
        throw new Error('No se encontró la prenda para devolver el stock.')
      if (product.stock + sale.quantity > 1_000_000)
        throw new Error(
          'No se puede devolver el stock porque superaría el límite de unidades. Revisá el inventario antes de anular.',
        )
      product.stock += sale.quantity
      sale.voided_at = new Date().toISOString()
    })
  const { error } = await supabase.rpc('void_sale', { p_sale_id: id })
  if (error)
    throw errorMessage(error, 'No pudimos anular la venta. Intentá nuevamente.')
}

export async function saveExpense(
  input: ExpenseInput,
  id?: string,
): Promise<Expense> {
  assertConfiguration()
  const clean = {
    description: input.description.trim(),
    category: input.category.trim(),
    amount: input.amount,
    incurred_on: input.incurred_on,
  }
  if (!clean.description || clean.description.length > 200)
    throw new Error(
      'Escribí una descripción del gasto de hasta 200 caracteres.',
    )
  if (!clean.category || clean.category.length > 80)
    throw new Error('Elegí una categoría para el gasto.')
  money(clean.amount, 'El gasto', false)
  businessDate(clean.incurred_on)
  if (!supabase)
    return transactDemo((state) => {
      const expense = { ...clean, id: id ?? crypto.randomUUID() }
      if (id) {
        const index = state.expenses.findIndex((item) => item.id === id)
        if (index < 0)
          throw new Error('No se encontró el gasto. Actualizá la lista.')
        state.expenses[index] = expense
      } else state.expenses.unshift(expense)
      return expense
    })
  const query = id
    ? supabase.from('expenses').update(clean).eq('id', id)
    : supabase.from('expenses').insert(clean)
  const { data, error } = await query.select('*').single()
  if (error)
    throw errorMessage(
      error,
      'No pudimos guardar el gasto. Revisá los datos e intentá nuevamente.',
    )
  return data as Expense
}

export async function deleteExpense(id: string): Promise<void> {
  assertConfiguration()
  if (!supabase)
    return transactDemo((state) => {
      if (!state.expenses.some((item) => item.id === id))
        throw new Error('El gasto ya no existe. Actualizá la lista.')
      state.expenses = state.expenses.filter((item) => item.id !== id)
    })
  const { data, error } = await supabase
    .from('expenses')
    .delete()
    .eq('id', id)
    .select('id')
  if (error)
    throw errorMessage(
      error,
      'No pudimos eliminar el gasto. Intentá nuevamente.',
    )
  if (!data?.length)
    throw new Error(
      'El gasto ya no existe o tu cuenta no tiene permiso para eliminarlo.',
    )
}

export function monthlySummary(
  sales: Sale[],
  expenses: Expense[],
  month: string,
) {
  const currentSales = sales.filter(
    (sale) => !sale.voided_at && sale.sold_on.slice(0, 7) === month,
  )
  const revenue = currentSales.reduce(
    (sum, sale) => sum + sale.unit_price * sale.quantity,
    0,
  )
  const costOfGoods = currentSales.reduce(
    (sum, sale) => sum + sale.unit_cost * sale.quantity,
    0,
  )
  const spent = expenses
    .filter((expense) => expense.incurred_on.slice(0, 7) === month)
    .reduce((sum, expense) => sum + expense.amount, 0)
  const profit = revenue - costOfGoods - spent
  return {
    revenue,
    costOfGoods,
    expenses: spent,
    profit,
    unitsSold: currentSales.reduce((sum, sale) => sum + sale.quantity, 0),
    salesCount: currentSales.length,
    margin: revenue ? (profit / revenue) * 100 : 0,
  }
}
