import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  LoaderCircle,
  Plus,
  ReceiptText,
  RotateCcw,
  ShoppingBag,
  TrendingUp,
  Wallet,
  X,
} from 'lucide-react'
import type { Product } from '../lib/products'
import {
  currentMonth,
  deleteExpense,
  getFinanceData,
  monthlySummary,
  recordSale,
  saveExpense,
  todayDate,
  voidSale,
} from '../lib/finance'
import type { Expense, Sale } from '../lib/finance'
import { formatPrice } from '../lib/utils'
import { Modal } from './Modal'
import '../finance.css'

interface FinanceProps {
  products: Product[]
  costs: Record<string, number>
  onInventoryChange: () => Promise<void>
}
const message = (e: unknown) =>
  e instanceof Error
    ? e.message
    : 'No pudimos completar la operación. Intentá de nuevo.'
const monthLabel = (month: string) =>
  new Intl.DateTimeFormat('es-PY', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${month}-15T12:00:00Z`))
const shortDate = (date: string) =>
  new Intl.DateTimeFormat('es-PY', {
    day: '2-digit',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`))
function moveMonth(month: string, delta: number) {
  const [year, number] = month.split('-').map(Number)
  const date = new Date(Date.UTC(year, number - 1 + delta, 1))
  return date.toISOString().slice(0, 7)
}

function AnimatedAmount({
  value,
  currency = true,
}: {
  value: number
  currency?: boolean
}) {
  const [shown, setShown] = useState(value)
  const previous = useRef(value)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(value)
      previous.current = value
      return
    }
    const from = previous.current
    previous.current = value
    const start = performance.now()
    let frame = 0
    function tick(now: number) {
      const progress = Math.min(1, (now - start) / 650)
      setShown(
        Math.round(from + (value - from) * (1 - Math.pow(1 - progress, 3))),
      )
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value])
  return (
    <>
      <span aria-hidden="true">
        {currency ? formatPrice(shown) : shown.toLocaleString('es-PY')}
      </span>
      <span className="finance-sr-only">
        {currency ? formatPrice(value) : value}
      </span>
    </>
  )
}

function FormHeader({
  title,
  label,
  close,
  busy,
}: {
  title: string
  label: string
  close: () => void
  busy: boolean
}) {
  return (
    <header className="finance-modal-header">
      <div>
        <span className="eyebrow">{label}</span>
        <h2>{title}</h2>
      </div>
      <button
        type="button"
        className="finance-close"
        onClick={close}
        disabled={busy}
        aria-label="Cerrar formulario"
      >
        <X size={19} />
      </button>
    </header>
  )
}

function SaleForm({
  products,
  costs,
  close,
  saved,
}: {
  products: Product[]
  costs: Record<string, number>
  close: () => void
  saved: () => Promise<void>
}) {
  const available = products.filter((p) => !p.archived && p.stock > 0)
  const [productId, setProductId] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [price, setPrice] = useState('')
  const [date, setDate] = useState(todayDate())
  const [payment, setPayment] = useState<'Efectivo' | 'Transferencia'>(
    'Efectivo',
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const requestId = useRef(crypto.randomUUID())
  const product = available.find((p) => p.id === productId)
  const hasCost = !!product && costs[product.id] !== undefined
  const units = Number(quantity)
  const unitPrice = Number(price)
  const valid =
    !!product &&
    hasCost &&
    quantity !== '' &&
    Number.isSafeInteger(units) &&
    units > 0 &&
    units <= product.stock &&
    price !== '' &&
    Number.isSafeInteger(unitPrice) &&
    unitPrice >= 0 &&
    unitPrice <= 1_000_000_000 &&
    !!date &&
    date <= todayDate()
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid || busy || !product) return
    setBusy(true)
    setError('')
    try {
      await recordSale({
        product_id: product.id,
        quantity: units,
        unit_price: unitPrice,
        sold_on: date,
        payment_method: payment,
        request_id: requestId.current,
      })
    } catch (e) {
      setError(message(e))
      setBusy(false)
      return
    }
    // A completed sale must never be submitted again because refreshing failed.
    try {
      await saved()
    } finally {
      close()
    }
  }
  return (
    <Modal
      title="Registrar venta"
      className="finance-modal"
      onClose={() => {
        if (!busy) close()
      }}
    >
      <FormHeader
        title="Un nuevo flechazo."
        label="REGISTRAR UNA VENTA"
        close={close}
        busy={busy}
      />
      <form onSubmit={(e) => void submit(e).catch(() => {})}>
        <div className="finance-form-content">
          <p className="finance-form-intro">
            Registrá lo que cobraste. El stock se descuenta al confirmar y el
            costo queda guardado en esta venta.
          </p>
          <label className="finance-field">
            Prenda
            <select
              aria-label="Prenda"
              required
              autoFocus
              value={productId}
              onChange={(e) => {
                setProductId(e.target.value)
                const p = available.find((p) => p.id === e.target.value)
                setPrice(p?.price?.toString() ?? '')
                setQuantity('1')
              }}
              disabled={busy}
            >
              <option value="">Elegí una prenda</option>
              {available.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.sku} · {p.name} · {p.stock} en stock
                </option>
              ))}
            </select>
          </label>
          {available.length === 0 && (
            <p className="finance-inline-note">
              No hay prendas con stock. Agregá o reponé una prenda desde
              Inventario.
            </p>
          )}
          {product && !hasCost && (
            <p className="finance-error" role="alert">
              Esta prenda todavía no tiene precio de compra. Cargalo desde
              Inventario → Editar antes de registrar la venta. Si fue una
              donación, ingresá 0.
            </p>
          )}
          <div className="finance-form-grid">
            <label className="finance-field">
              Unidades
              <input
                type="number"
                min="1"
                max={product?.stock ?? 1}
                step="1"
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                disabled={busy}
              />
            </label>
            <label className="finance-field">
              Precio de venta por unidad (Gs.)
              <input
                type="number"
                min="0"
                max="1000000000"
                step="1"
                required
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                disabled={busy}
              />
            </label>
            <label className="finance-field">
              Fecha de venta
              <input
                type="date"
                required
                max={todayDate()}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                disabled={busy}
              />
            </label>
            <label className="finance-field">
              Medio de pago
              <select
                aria-label="Medio de pago"
                value={payment}
                onChange={(e) => setPayment(e.target.value as typeof payment)}
                disabled={busy}
              >
                <option>Efectivo</option>
                <option>Transferencia</option>
              </select>
            </label>
          </div>
          <div className="finance-sale-preview">
            <span>
              Total cobrado
              <strong>
                {formatPrice(price !== '' && units > 0 ? unitPrice * units : 0)}
              </strong>
            </span>
            <span>
              Costo de las prendas
              <strong>
                {hasCost && product
                  ? formatPrice(costs[product.id] * units)
                  : 'A completar'}
              </strong>
            </span>
            <span>
              Ganancia bruta
              <strong>
                {valid && product
                  ? formatPrice((unitPrice - costs[product.id]) * units)
                  : '—'}
              </strong>
            </span>
          </div>
          <p className="finance-field-help">
            La ganancia neta mensual también descuenta los gastos del negocio.
          </p>
          {error && (
            <p className="finance-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="finance-form-footer">
          <button
            className="admin-outline-button"
            type="button"
            onClick={close}
            disabled={busy}
          >
            Cancelar
          </button>
          <button
            className="admin-primary-button"
            type="submit"
            disabled={!valid || busy}
          >
            {busy ? (
              <LoaderCircle size={16} className="finance-spin" />
            ) : (
              <Check size={16} />
            )}
            {busy ? 'Registrando…' : 'Confirmar venta'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function ExpenseForm({
  expense,
  close,
  saved,
}: {
  expense?: Expense
  close: () => void
  saved: () => Promise<void>
}) {
  const [description, setDescription] = useState(expense?.description ?? '')
  const [category, setCategory] = useState(expense?.category ?? 'Otros')
  const [amount, setAmount] = useState(expense?.amount.toString() ?? '')
  const [date, setDate] = useState(expense?.incurred_on ?? todayDate())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const valid =
    description.trim().length > 0 &&
    description.trim().length <= 200 &&
    amount !== '' &&
    Number.isSafeInteger(Number(amount)) &&
    Number(amount) > 0 &&
    Number(amount) <= 1_000_000_000 &&
    !!date &&
    date <= todayDate()
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid || busy) return
    setBusy(true)
    setError('')
    try {
      await saveExpense(
        {
          description: description.trim(),
          category,
          amount: Number(amount),
          incurred_on: date,
        },
        expense?.id,
      )
    } catch (e) {
      setError(message(e))
      setBusy(false)
      return
    }
    try {
      await saved()
    } finally {
      close()
    }
  }
  return (
    <Modal
      title={expense ? 'Editar gasto' : 'Registrar gasto'}
      className="finance-modal"
      onClose={() => {
        if (!busy) close()
      }}
    >
      <FormHeader
        title={expense ? 'Editá este gasto.' : 'Cada detalle cuenta.'}
        label={expense ? 'EDITAR GASTO' : 'REGISTRAR UN GASTO'}
        close={close}
        busy={busy}
      />
      <form onSubmit={(e) => void submit(e).catch(() => {})}>
        <div className="finance-form-content">
          <p className="finance-form-intro">
            Anotá gastos como alquiler, transporte o publicidad. El costo de las
            prendas vendidas ya se descuenta por separado.
          </p>
          <label className="finance-field">
            Descripción
            <input
              autoFocus
              required
              maxLength={200}
              placeholder="Ej. Envío del pedido de octubre"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={busy}
            />
          </label>
          <div className="finance-form-grid">
            <label className="finance-field">
              Categoría del gasto
              <select
                aria-label="Categoría del gasto"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                disabled={busy}
              >
                {[
                  'Alquiler',
                  'Servicios',
                  'Transporte',
                  'Publicidad',
                  'Embalaje',
                  'Otros',
                ].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="finance-field">
              Importe (Gs.)
              <input
                type="number"
                required
                min="1"
                max="1000000000"
                step="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={busy}
              />
            </label>
            <label className="finance-field">
              Fecha del gasto
              <input
                type="date"
                required
                max={todayDate()}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                disabled={busy}
              />
            </label>
          </div>
          {error && (
            <p className="finance-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="finance-form-footer">
          <button
            type="button"
            className="admin-outline-button"
            onClick={close}
            disabled={busy}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="admin-primary-button"
            disabled={!valid || busy}
          >
            <Check size={16} />
            {busy ? 'Guardando…' : 'Guardar gasto'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default function Finance({
  products,
  costs,
  onInventoryChange,
}: FinanceProps) {
  const [sales, setSales] = useState<Sale[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [month, setMonth] = useState(currentMonth())
  const [tab, setTab] = useState<'sales' | 'expenses'>('sales')
  const [loading, setLoading] = useState(true)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [saleOpen, setSaleOpen] = useState(false)
  const [expenseOpen, setExpenseOpen] = useState<Expense | 'new' | null>(null)
  const [confirm, setConfirm] = useState<{
    kind: 'sale' | 'expense'
    id: string
  } | null>(null)
  const [busy, setBusy] = useState(false)
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getFinanceData()
      setSales(data.sales)
      setExpenses(data.expenses)
      setLoaded(true)
      setError('')
    } catch (e) {
      setError(message(e))
      throw e
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => {
    void load().catch(() => {})
  }, [load])
  const summary = monthlySummary(sales, expenses, month)
  const chart = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => {
        const key = moveMonth(month, i - 5)
        return { key, ...monthlySummary(sales, expenses, key) }
      }),
    [month, sales, expenses],
  )
  const scale = Math.max(
    1,
    ...chart.flatMap((m) => [m.revenue, Math.abs(m.profit)]),
  )
  const shownSales = sales
    .filter((s) => s.sold_on.startsWith(month))
    .sort((a, b) => b.sold_on.localeCompare(a.sold_on))
  const shownExpenses = expenses
    .filter((e) => e.incurred_on.startsWith(month))
    .sort((a, b) => b.incurred_on.localeCompare(a.incurred_on))
  async function saved(kind: 'sale' | 'expense') {
    setNotice(
      kind === 'sale'
        ? 'Venta registrada. El stock y las ganancias se actualizaron.'
        : 'Gasto guardado correctamente.',
    )
    try {
      await Promise.all([load(), onInventoryChange()])
    } catch {
      setError(
        'El movimiento se guardó, pero no pudimos actualizar la vista. Reintentá la carga; no lo registres nuevamente.',
      )
      throw new Error('Refresh failed')
    }
  }
  async function remove() {
    if (!confirm || busy) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      if (confirm.kind === 'sale') await voidSale(confirm.id)
      else await deleteExpense(confirm.id)
      const kind = confirm.kind
      setConfirm(null)
      setNotice(
        kind === 'sale'
          ? 'Venta anulada. Las unidades volvieron al inventario.'
          : 'Gasto eliminado.',
      )
      await Promise.all([load(), onInventoryChange()])
    } catch (e) {
      setError(message(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="finance-shell" aria-label="Finanzas del negocio">
      <div className="admin-page-heading">
        <div>
          <span className="eyebrow">NÚMEROS CLAROS, DECISIONES LINDAS</span>
          <h1>Tu negocio, en números.</h1>
          <p>
            Ventas, gastos y lo que ganaste de verdad. Todo en un mismo lugar.
          </p>
        </div>
        <div className="finance-heading-actions">
          <button
            className="admin-outline-button"
            onClick={() => setExpenseOpen('new')}
          >
            <Plus size={15} />
            Cargar gasto
          </button>
          <button
            className="admin-primary-button"
            onClick={() => setSaleOpen(true)}
          >
            <Plus size={15} />
            Registrar venta
          </button>
        </div>
      </div>
      <div className="finance-period">
        <div>
          <CalendarDays size={17} />
          <span>
            Resumen de <strong>{monthLabel(month)}</strong>
          </span>
        </div>
        <div className="finance-month-picker">
          <button
            aria-label="Mes anterior"
            onClick={() => setMonth(moveMonth(month, -1))}
          >
            <ChevronLeft size={17} />
          </button>
          <label>
            <span className="finance-sr-only">Mes del resumen</span>
            <input
              type="month"
              value={month}
              onChange={(e) => {
                if (/^\d{4}-\d{2}$/.test(e.target.value))
                  setMonth(e.target.value)
              }}
            />
          </label>
          <button
            aria-label="Mes siguiente"
            onClick={() => setMonth(moveMonth(month, 1))}
          >
            <ChevronRight size={17} />
          </button>
          <button
            className="finance-current-month"
            onClick={() => setMonth(currentMonth())}
          >
            Este mes
          </button>
        </div>
      </div>
      {error && (
        <div role="alert" className="finance-error">
          {error}
          <button type="button" onClick={() => void load().catch(() => {})}>
            Volver a cargar
          </button>
        </div>
      )}
      {notice && (
        <div role="status" className="finance-success">
          <Check size={15} />
          {notice}
        </div>
      )}
      {loading ? (
        <div className="finance-loading" role="status">
          <LoaderCircle size={23} className="finance-spin" />
          Preparando tus números…
        </div>
      ) : !loaded ? (
        <div className="finance-empty">
          <ReceiptText size={30} strokeWidth={1.2} />
          <h3>Tus números necesitan una conexión.</h3>
          <p>
            Volvé a cargar cuando se resuelva el error para ver los resultados
            del negocio.
          </p>
        </div>
      ) : (
        <>
          <div className="finance-summary">
            <article
              aria-label="Ganancia neta"
              className={`finance-stat finance-profit ${summary.profit < 0 ? 'is-loss' : ''}`}
            >
              <div>
                <span>
                  {summary.profit < 0
                    ? 'Resultado neto · Pérdida'
                    : 'Ganancia neta'}
                </span>
                <TrendingUp size={20} />
              </div>
              <strong>
                <AnimatedAmount value={summary.profit} />
              </strong>
              <p>Ingresos − costo de prendas − gastos</p>
              <small>
                {summary.revenue > 0
                  ? `${summary.margin.toFixed(1)}% de margen neto`
                  : 'Registrá ventas para comenzar'}
              </small>
            </article>
            <article aria-label="Ingresos" className="finance-stat">
              <div>
                <span>Ingresos por ventas</span>
                <ArrowUpRight size={17} />
              </div>
              <strong>
                <AnimatedAmount value={summary.revenue} />
              </strong>
              <p>
                {summary.salesCount}{' '}
                {summary.salesCount === 1
                  ? 'venta registrada'
                  : 'ventas registradas'}
              </p>
            </article>
            <article aria-label="Costo de prendas" className="finance-stat">
              <div>
                <span>Costo de prendas vendidas</span>
                <ShoppingBag size={17} />
              </div>
              <strong>
                <AnimatedAmount value={summary.costOfGoods} />
              </strong>
              <p>
                {summary.unitsSold}{' '}
                {summary.unitsSold === 1
                  ? 'unidad vendida'
                  : 'unidades vendidas'}
              </p>
            </article>
            <article aria-label="Gastos" className="finance-stat">
              <div>
                <span>Gastos del negocio</span>
                <Wallet size={17} />
              </div>
              <strong>
                <AnimatedAmount value={summary.expenses} />
              </strong>
              <p>
                {shownExpenses.length}{' '}
                {shownExpenses.length === 1
                  ? 'gasto registrado'
                  : 'gastos registrados'}
              </p>
            </article>
          </div>
          <div className="finance-chart-panel">
            <div className="finance-panel-heading">
              <div>
                <span className="eyebrow">PASO A PASO, MES A MES</span>
                <h2>Así viene tu negocio.</h2>
              </div>
              <div className="finance-chart-legend">
                <span>
                  <i />
                  Ingresos
                </span>
                <span>
                  <i />
                  Resultado neto
                </span>
              </div>
            </div>
            <div
              className={`finance-chart ${chart.some((m) => m.profit < 0) ? 'has-negative' : ''}`}
              role="img"
              aria-label={`Ingresos y resultado neto de los últimos seis meses hasta ${monthLabel(month)}`}
            >
              <div className="finance-chart-baseline" />
              {chart.map((m, i) => (
                <div className="finance-chart-month" key={m.key}>
                  <div className="finance-chart-bars">
                    <div
                      className="finance-bar revenue"
                      style={{
                        height: `${Math.max(2, (m.revenue / scale) * 125)}px`,
                        animationDelay: `${i * 55}ms`,
                      }}
                      title={`Ingresos ${formatPrice(m.revenue)}`}
                    >
                      <span>{formatPrice(m.revenue)}</span>
                    </div>
                    <div
                      className={`finance-bar profit ${m.profit < 0 ? 'negative' : ''}`}
                      style={{
                        height: `${Math.max(2, (Math.abs(m.profit) / scale) * 125)}px`,
                        animationDelay: `${i * 55 + 25}ms`,
                      }}
                      title={`Resultado ${formatPrice(m.profit)}`}
                    >
                      <span>{formatPrice(m.profit)}</span>
                    </div>
                  </div>
                  <b>
                    {new Intl.DateTimeFormat('es-PY', {
                      month: 'short',
                      timeZone: 'UTC',
                    }).format(new Date(`${m.key}-15T12:00:00Z`))}
                  </b>
                  <small className={m.profit < 0 ? 'finance-negative' : ''}>
                    {formatPrice(m.profit)}
                  </small>
                  <span className="finance-sr-only">
                    {monthLabel(m.key)}: ingresos {formatPrice(m.revenue)},
                    resultado {formatPrice(m.profit)}.
                  </span>
                </div>
              ))}
            </div>
            <p className="finance-chart-note">
              Los valores negativos indican pérdida. Las ventas anuladas no se
              incluyen.
            </p>
          </div>
          <div className="finance-ledger">
            <div className="finance-ledger-heading">
              <div
                className="finance-tabs"
                role="group"
                aria-label="Movimientos financieros"
              >
                <button
                  className={tab === 'sales' ? 'active' : ''}
                  aria-pressed={tab === 'sales'}
                  onClick={() => setTab('sales')}
                >
                  <Banknote size={16} />
                  Ventas <span>{shownSales.length}</span>
                </button>
                <button
                  className={tab === 'expenses' ? 'active' : ''}
                  aria-pressed={tab === 'expenses'}
                  onClick={() => setTab('expenses')}
                >
                  <ReceiptText size={16} />
                  Gastos <span>{shownExpenses.length}</span>
                </button>
              </div>
              <span>{monthLabel(month)}</span>
            </div>
            {tab === 'sales' ? (
              shownSales.length ? (
                <div
                  className="finance-table-scroll"
                  tabIndex={0}
                  role="region"
                  aria-label="Ventas del mes"
                >
                  <table className="finance-table">
                    <thead>
                      <tr>
                        <th>Prenda / fecha</th>
                        <th>Unidades</th>
                        <th>Medio de pago</th>
                        <th>Ingreso</th>
                        <th>Ganancia bruta</th>
                        <th>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shownSales.map((s) => (
                        <tr
                          key={s.id}
                          className={s.voided_at ? 'finance-voided' : ''}
                        >
                          <td>
                            <strong>{s.product_name}</strong>
                            <small>
                              {s.product_sku} · {shortDate(s.sold_on)}
                            </small>
                          </td>
                          <td>{s.quantity}</td>
                          <td>
                            <span className="finance-payment">
                              {s.payment_method === 'Efectivo' ? (
                                <Banknote size={13} />
                              ) : (
                                <CreditCard size={13} />
                              )}{' '}
                              {s.payment_method}
                            </span>
                          </td>
                          <td>{formatPrice(s.unit_price * s.quantity)}</td>
                          <td
                            className={
                              (s.unit_price - s.unit_cost) * s.quantity < 0
                                ? 'finance-negative'
                                : ''
                            }
                          >
                            {formatPrice(
                              (s.unit_price - s.unit_cost) * s.quantity,
                            )}
                          </td>
                          <td>
                            {s.voided_at ? (
                              <span className="finance-badge voided">
                                Anulada
                              </span>
                            ) : (
                              <div className="finance-row-actions">
                                <span className="finance-badge">
                                  Registrada
                                </span>
                                <button
                                  onClick={() =>
                                    setConfirm({ kind: 'sale', id: s.id })
                                  }
                                >
                                  <RotateCcw size={11} />
                                  Anular
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="finance-empty">
                  <ShoppingBag size={30} strokeWidth={1.2} />
                  <h3>Tu próxima venta empieza acá.</h3>
                  <p>No hay ventas registradas en {monthLabel(month)}.</p>
                  <button
                    className="admin-primary-button"
                    onClick={() => setSaleOpen(true)}
                  >
                    Registrar venta <Plus size={15} />
                  </button>
                </div>
              )
            ) : shownExpenses.length ? (
              <div
                className="finance-table-scroll"
                tabIndex={0}
                role="region"
                aria-label="Gastos del mes"
              >
                <table className="finance-table">
                  <thead>
                    <tr>
                      <th>Descripción / fecha</th>
                      <th>Categoría</th>
                      <th>Importe</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shownExpenses.map((e) => (
                      <tr key={e.id}>
                        <td>
                          <strong>{e.description}</strong>
                          <small>{shortDate(e.incurred_on)}</small>
                        </td>
                        <td>{e.category}</td>
                        <td>{formatPrice(e.amount)}</td>
                        <td>
                          <div className="finance-expense-actions">
                            <button onClick={() => setExpenseOpen(e)}>
                              Editar
                            </button>
                            <button
                              onClick={() =>
                                setConfirm({ kind: 'expense', id: e.id })
                              }
                            >
                              Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="finance-empty">
                <ReceiptText size={30} strokeWidth={1.2} />
                <h3>Cada gasto, en su lugar.</h3>
                <p>Todavía no hay gastos registrados en {monthLabel(month)}.</p>
                <button
                  className="admin-outline-button"
                  onClick={() => setExpenseOpen('new')}
                >
                  Cargar gasto <Plus size={15} />
                </button>
              </div>
            )}
          </div>
          <div className="finance-explanation">
            <ArrowDownLeft size={18} />
            <p>
              <strong>Una cuenta clara.</strong> El precio de compra se
              descuenta cuando vendés la prenda. Las compras de stock no deben
              cargarse otra vez como gasto para evitar descontarlas dos veces.
              Los ajustes manuales de stock no registran ventas.
            </p>
          </div>
        </>
      )}
      {saleOpen && (
        <SaleForm
          products={products}
          costs={costs}
          close={() => setSaleOpen(false)}
          saved={() => saved('sale')}
        />
      )}
      {expenseOpen && (
        <ExpenseForm
          expense={expenseOpen === 'new' ? undefined : expenseOpen}
          close={() => setExpenseOpen(null)}
          saved={() => saved('expense')}
        />
      )}
      {confirm && (
        <Modal
          title={confirm.kind === 'sale' ? 'Anular venta' : 'Eliminar gasto'}
          className="finance-confirm"
          onClose={() => {
            if (!busy) setConfirm(null)
          }}
        >
          <FormHeader
            title={
              confirm.kind === 'sale'
                ? '¿Anular esta venta?'
                : '¿Eliminar este gasto?'
            }
            label="CONFIRMAR CAMBIO"
            close={() => setConfirm(null)}
            busy={busy}
          />
          <div className="finance-form-content">
            <p>
              {confirm.kind === 'sale'
                ? 'Las unidades volverán al inventario y esta venta dejará de contar en las ganancias. Conservará su registro como anulada.'
                : 'Este gasto se eliminará y el resultado del mes se recalculará.'}
            </p>
            {error && (
              <p className="finance-error" role="alert">
                {error}
              </p>
            )}
          </div>
          <div className="finance-form-footer">
            <button
              className="admin-outline-button"
              onClick={() => setConfirm(null)}
              disabled={busy}
            >
              Volver
            </button>
            <button
              className="admin-primary-button"
              onClick={() => void remove()}
              disabled={busy}
            >
              {busy
                ? 'Procesando…'
                : confirm.kind === 'sale'
                  ? 'Confirmar anulación'
                  : 'Eliminar gasto'}
            </button>
          </div>
        </Modal>
      )}
    </section>
  )
}
