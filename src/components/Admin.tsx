import { useEffect, useRef, useState } from 'react'
import {
  Archive,
  ArrowDownToLine,
  ArrowUpRight,
  Check,
  ChevronDown,
  CircleHelp,
  Grid2X2,
  Leaf,
  LogOut,
  Minus,
  Package,
  Plus,
  Search,
  Sparkles,
  X,
} from 'lucide-react'
import {
  CATEGORIES,
  archiveProduct,
  imageUrl,
  removeProductImage,
  saveProduct,
  setStock,
  uploadProductImage,
} from '../lib/products'
import type { Product, ProductInput } from '../lib/products'
import { isConfigured } from '../lib/supabase'
import { convertToWebP } from '../lib/images'
import { exportProductsCsv, formatPrice } from '../lib/utils'
import { Modal } from './Modal'
import '../admin.css'

interface AdminProps {
  products: Product[]
  refresh: () => Promise<void>
  onLogout: () => void
  ownerName: string
}
const getError = (error: unknown) =>
  error instanceof Error
    ? error.message
    : 'No se pudo completar la operación. Intentá de nuevo.'
const blank: ProductInput = {
  name: '',
  sku: '',
  category: 'Vestidos',
  size: '',
  price: null,
  stock: 1,
  image_path: null,
  visible: true,
  archived: false,
  is_example: false,
}

function ProductForm({
  product,
  onClose,
  onSaved,
  onWarning,
}: {
  product?: Product
  onClose: () => void
  onSaved: (warning?: string) => Promise<void>
  onWarning: (message: string) => void
}) {
  const [form, setForm] = useState<ProductInput>(
    product ? { ...product } : { ...blank },
  )
  const [price, setPrice] = useState(product?.price?.toString() ?? '')
  const [stock, setStockValue] = useState(String(product?.stock ?? 1))
  const [image, setImage] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [photoNote, setPhotoNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [converting, setConverting] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const unusedUploads = useRef(new Set<string>())
  useEffect(
    () => () => {
      for (const path of unusedUploads.current) {
        void removeProductImage(path).catch(() =>
          onWarning(
            'No se pudo limpiar una foto sin guardar. Revisá los archivos del bucket product-images en Supabase.',
          ),
        )
      }
    },
    [],
  )
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview)
    },
    [preview],
  )
  const valid =
    !!form.name.trim() &&
    !!form.sku.trim() &&
    stock !== '' &&
    Number.isInteger(Number(stock)) &&
    Number(stock) >= 0 &&
    Number(stock) <= 1_000_000 &&
    (price === '' ||
      (Number.isFinite(Number(price)) &&
        Number(price) >= 0 &&
        Number(price) <= 1_000_000_000))
  async function selectImage(file?: File) {
    if (!file) return
    setConverting(true)
    setError('')
    setPhotoNote('Convirtiendo imagen a WebP…')
    try {
      const webp = await convertToWebP(file)
      setImage(webp)
      setPreview(URL.createObjectURL(webp))
      setPhotoNote(
        `WebP listo · ${Math.ceil(webp.size / 1024)} KB. Se subirá al guardar.`,
      )
    } catch (e) {
      setError(getError(e))
      setPhotoNote('La foto anterior se conserva.')
    } finally {
      setConverting(false)
      if (input.current) input.current.value = ''
    }
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!valid || busy || converting) return
    setBusy(true)
    setError('')
    try {
      const path = image ? await uploadProductImage(image) : form.image_path
      // Reuse a successful upload if the product save needs to be retried.
      if (image && path) {
        unusedUploads.current.add(path)
        setForm((current) => ({ ...current, image_path: path }))
        setImage(null)
      }
      await saveProduct(
        {
          ...form,
          price: price === '' ? null : Number(price),
          stock: Number(stock),
          image_path: path,
        },
        product?.id,
      )
      if (path) unusedUploads.current.delete(path)
      let warning: string | undefined
      if (product?.image_path && product.image_path !== path) {
        try {
          await removeProductImage(product.image_path)
        } catch {
          warning =
            'Prenda guardada. No se pudo eliminar la foto anterior; revisá el almacenamiento de Supabase.'
        }
      }
      // The product is already saved. A failed refresh must not turn a retry into a duplicate creation.
      try {
        await onSaved(warning)
      } catch {
        /* The application displays refresh errors separately. */
      }
      onClose()
    } catch (e) {
      setError(getError(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal
      title={product ? 'Editá tu prenda.' : 'Una nueva prenda.'}
      onClose={() => {
        if (!busy) onClose()
      }}
      className="admin-product-modal"
    >
      <header className="admin-modal-heading">
        <div>
          <span className="eyebrow">INVENTARIO ETERNA BELLEZA</span>
          <h2>{product ? 'Editá tu prenda.' : 'Una nueva prenda.'}</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          aria-label="Cerrar formulario"
        >
          <X size={19} />
        </button>
      </header>
      <form onSubmit={submit}>
        <div className="admin-form-body">
          <div className="admin-photo-column">
            <button
              className={`admin-photo-upload ${preview || form.image_path ? 'has-photo' : ''}`}
              type="button"
              onClick={() => input.current?.click()}
              disabled={busy || converting}
              aria-label="Seleccionar foto de la prenda"
            >
              {preview || form.image_path ? (
                <img
                  src={preview ?? imageUrl(form.image_path)}
                  alt="Vista previa de la prenda"
                />
              ) : (
                <>
                  <Plus size={34} strokeWidth={1.4} />
                  <span>La foto de tu prenda</span>
                </>
              )}
            </button>
            <input
              ref={input}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              onChange={(e) => void selectImage(e.target.files?.[0])}
            />
            <button
              className="admin-outline-button admin-photo-change"
              type="button"
              onClick={() => input.current?.click()}
              disabled={busy || converting}
            >
              {converting ? 'Convirtiendo…' : 'Subir o cambiar foto'}
            </button>
            <small>JPG, PNG o WebP · Se optimiza a WebP</small>
            <small className="admin-photo-note" role="status">
              {photoNote || 'Máximo de salida: 2 MB'}
            </small>
          </div>
          <div className="admin-fields">
            <label className="admin-field admin-field-full">
              Nombre de la prenda
              <input
                autoFocus
                required
                maxLength={160}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ej. Vestido floral"
                disabled={busy}
              />
            </label>
            <label className="admin-field">
              Código / SKU
              <input
                required
                maxLength={64}
                value={form.sku}
                onChange={(e) => setForm({ ...form, sku: e.target.value })}
                placeholder="Ej. EB-001"
                disabled={busy}
              />
            </label>
            <label className="admin-field">
              Categoría
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                disabled={busy}
              >
                {CATEGORIES.map((category) => (
                  <option key={category}>{category}</option>
                ))}
              </select>
            </label>
            <label className="admin-field admin-field-full">
              Talle
              <input
                maxLength={80}
                value={form.size}
                onChange={(e) => setForm({ ...form, size: e.target.value })}
                placeholder="Ej. M, 38 o único"
                disabled={busy}
              />
            </label>
            <label className="admin-field">
              Precio (Gs.)
              <input
                aria-label="Precio (Gs.)"
                type="number"
                min="0"
                max="1000000000"
                step="1"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="A consultar"
                disabled={busy}
              />
              <small>Dejá vacío para consultar.</small>
            </label>
            <label className="admin-field">
              Unidades en stock
              <input
                aria-label="Unidades en stock"
                required
                type="number"
                min="0"
                max="1000000"
                step="1"
                value={stock}
                onChange={(e) => setStockValue(e.target.value)}
                disabled={busy}
              />
              <small>Con 0 se muestra agotada.</small>
            </label>
            <label className="admin-checkbox admin-field-full">
              <input
                type="checkbox"
                checked={form.visible}
                onChange={(e) =>
                  setForm({ ...form, visible: e.target.checked })
                }
                disabled={busy}
              />
              Mostrar en el catálogo de la tienda
            </label>
          </div>
        </div>
        {error && (
          <p className="admin-form-error" role="alert">
            {error}
          </p>
        )}
        <div className="admin-form-footer">
          <button
            className="admin-outline-button"
            type="button"
            onClick={onClose}
            disabled={busy}
          >
            Cancelar
          </button>
          <button
            className="admin-primary-button"
            type="submit"
            disabled={!valid || busy || converting}
          >
            {busy ? 'Guardando…' : 'Guardar prenda'}
            <Check size={17} />
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default function Admin({
  products,
  refresh,
  onLogout,
  ownerName,
}: AdminProps) {
  const [archived, setArchived] = useState(false)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [status, setStatus] = useState('all')
  const [editing, setEditing] = useState<Product | 'new' | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [sideOpen, setSideOpen] = useState(false)
  const activeProducts = products.filter((product) => !product.archived)
  const archiveProducts = products.filter((product) => product.archived)
  const displayedProducts = products
    .filter((product) => product.archived === archived)
    .filter((product) => category === 'all' || product.category === category)
    .filter(
      (product) =>
        status === 'all' ||
        (status === 'visible' && product.visible) ||
        (status === 'hidden' && !product.visible) ||
        (status === 'low' && product.stock > 0 && product.stock <= 2) ||
        (status === 'empty' && product.stock === 0),
    )
    .filter((product) =>
      `${product.name} ${product.sku} ${product.size}`
        .toLocaleLowerCase()
        .includes(search.toLocaleLowerCase().trim()),
    )
  async function mutate(action: () => Promise<unknown>, message: string) {
    if (busy) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await action()
      await refresh()
      setNotice(message)
    } catch (e) {
      setError(getError(e))
    } finally {
      setBusy(false)
    }
  }
  function navigateArchive(next: boolean) {
    setArchived(next)
    setStatus('all')
    setSearch('')
    setCategory('all')
    setSideOpen(false)
    setError('')
    setNotice('')
  }
  const metrics = [
    {
      title: 'Prendas activas',
      value: activeProducts.length,
      note: 'Referencias en tu inventario',
      icon: <Grid2X2 size={15} />,
    },
    {
      title: 'Unidades en stock',
      value: activeProducts.reduce((sum, p) => sum + p.stock, 0),
      note: 'Disponibles entre todos los talles',
      icon: <Package size={15} />,
    },
    {
      title: 'Pocas unidades',
      value: activeProducts.filter((p) => p.stock > 0 && p.stock <= 2).length,
      note: 'Prendas con 1 o 2 unidades',
      icon: <CircleHelp size={15} />,
    },
    {
      title: 'Agotadas',
      value: activeProducts.filter((p) => p.stock === 0).length,
      note: 'Revisá si querés reponerlas',
      icon: <span className="admin-metric-circle" />,
    },
  ]
  return (
    <div className="admin-shell">
      <button
        type="button"
        className="admin-mobile-toggle"
        onClick={() => setSideOpen(!sideOpen)}
        aria-expanded={sideOpen}
        aria-label={sideOpen ? 'Cerrar navegación' : 'Abrir navegación'}
      >
        {sideOpen ? <X size={20} /> : <Grid2X2 size={20} />}
      </button>
      {sideOpen && (
        <button
          className="admin-sidebar-scrim"
          onClick={() => setSideOpen(false)}
          aria-label="Cerrar navegación"
        />
      )}
      <aside className={`admin-sidebar ${sideOpen ? 'is-open' : ''}`}>
        <a href="/" className="admin-brand">
          <img src="/images/brand.svg" alt="" />
          <span>
            Eterna Belleza<small>ESPACIO DEL PROPIETARIO</small>
          </span>
        </a>
        <span className="admin-nav-heading">MI NEGOCIO</span>
        <nav aria-label="Administración">
          <button
            className={!archived ? 'active' : ''}
            onClick={() => navigateArchive(false)}
          >
            <Grid2X2 size={17} />
            <span>Inventario</span>
            <small>{activeProducts.length}</small>
          </button>
          <button
            className={archived ? 'active' : ''}
            onClick={() => navigateArchive(true)}
          >
            <Archive size={17} />
            <span>Archivadas</span>
            <small>{archiveProducts.length}</small>
          </button>
          <a href="/">
            <ArrowUpRight size={17} />
            <span>Ver tienda</span>
          </a>
        </nav>
        <div className="admin-sidebar-bottom">
          <div className="admin-sidebar-note">
            <Sparkles size={27} strokeWidth={1.5} />
            <h3>Cada prenda cuenta.</h3>
            <p>
              Mantené el stock al día para que tus clientes encuentren lo que
              buscan.
            </p>
          </div>
          <div className="admin-profile">
            <span className="admin-avatar">
              {ownerName.slice(0, 1).toUpperCase()}
            </span>
            <div>
              <strong>{ownerName}</strong>
              <small>
                {isConfigured ? 'Propietario' : 'Demostración local'}
              </small>
            </div>
            <button
              onClick={onLogout}
              title={
                isConfigured ? 'Cerrar sesión' : 'Salir de la demostración'
              }
              aria-label={
                isConfigured ? 'Cerrar sesión' : 'Salir de la demostración'
              }
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      <div className="admin-workspace">
        <header className="admin-topbar">
          <div>
            Administración <span>/</span>
            <strong>{archived ? 'Archivadas' : 'Inventario'}</strong>
          </div>
          <span className="admin-sync">
            <i />
            {busy
              ? 'Guardando…'
              : isConfigured
                ? 'Conectado a Supabase'
                : 'Guardado en este navegador'}
          </span>
        </header>
        <main className="admin-main">
          <div className="admin-page-heading">
            <div>
              <span className="eyebrow">TODO EN SU LUGAR</span>
              <h1>{archived ? 'Tus archivadas.' : 'Tu inventario.'}</h1>
              <p>
                {archived
                  ? 'Prendas guardadas, listas para una nueva oportunidad.'
                  : 'Prendas, precios y stock. El control de tu tienda, acá.'}
              </p>
            </div>
            <button
              className="admin-primary-button"
              onClick={() => setEditing('new')}
            >
              <Plus size={16} />
              Nueva prenda
            </button>
          </div>
          <div className="admin-metrics">
            {metrics.map((metric) => (
              <article className="admin-metric" key={metric.title}>
                <div>
                  <span>{metric.title}</span>
                  {metric.icon}
                </div>
                <strong>{String(metric.value).padStart(2, '0')}</strong>
                <small>{metric.note}</small>
              </article>
            ))}
          </div>
          {!isConfigured && (
            <div className="admin-info-notice">
              <Leaf size={16} />
              <span>
                <strong>Modo demostración.</strong> Los cambios se guardan solo
                en este navegador. Conectá Supabase para administrar el
                inventario real.
              </span>
            </div>
          )}
          {products.some((p) => p.is_example) && (
            <div className="admin-example-notice">
              <CircleHelp size={14} />
              <span>
                Las prendas marcadas «Ejemplo» tienen stock ilustrativo. Podés
                editarlas o archivarlas para preparar el catálogo real.
              </span>
            </div>
          )}
          {error && (
            <div role="alert" className="admin-error-notice">
              {error}
              <button onClick={() => setError('')} aria-label="Cerrar aviso">
                <X size={15} />
              </button>
            </div>
          )}
          {notice && (
            <div role="status" className="admin-success-notice">
              <Check size={15} />
              {notice}
            </div>
          )}
          <section
            className="admin-inventory-panel"
            aria-label={
              archived ? 'Prendas archivadas' : 'Inventario de prendas'
            }
          >
            <div className="admin-panel-heading">
              <h2>
                {archived ? 'Prendas archivadas' : 'Todas tus prendas'}
                <span>{displayedProducts.length} resultados</span>
              </h2>
              <button
                className="admin-outline-button admin-export"
                onClick={() => {
                  exportProductsCsv(displayedProducts)
                  setNotice('CSV exportado con las prendas del filtro actual.')
                }}
              >
                <ArrowDownToLine size={14} />
                Exportar CSV
              </button>
            </div>
            <div className="admin-filters">
              <label className="admin-search">
                <Search size={17} />
                <input
                  type="search"
                  placeholder="Buscar prenda, código o talle…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-label="Buscar prenda, código o talle"
                />
              </label>
              <label className="admin-select-label">
                <span className="admin-sr-only">Filtrar categoría</span>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="all">Todas las categorías</option>
                  {CATEGORIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
                <ChevronDown size={14} />
              </label>
              <label className="admin-select-label">
                <span className="admin-sr-only">Filtrar estado</span>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="all">
                    {archived ? 'Todas las archivadas' : 'Todas las activas'}
                  </option>
                  <option value="visible">Visibles en catálogo</option>
                  <option value="hidden">Ocultas del catálogo</option>
                  <option value="low">Pocas unidades</option>
                  <option value="empty">Agotadas</option>
                </select>
                <ChevronDown size={14} />
              </label>
            </div>
            <p className="admin-table-hint">
              Deslizá la tabla para ver stock y acciones →
            </p>
            <div
              className="admin-table-scroll"
              tabIndex={0}
              role="region"
              aria-label="Tabla de inventario con desplazamiento horizontal"
            >
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Prenda</th>
                    <th>Categoría / talle</th>
                    <th>Precio</th>
                    <th>Stock</th>
                    <th>Catálogo</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedProducts.map((product) => (
                    <tr key={product.id}>
                      <td>
                        <div className="admin-table-product">
                          <img src={imageUrl(product.image_path)} alt="" />
                          <div>
                            <strong>{product.name}</strong>
                            <small>
                              {product.sku}
                              {product.is_example && ' · Ejemplo'}
                            </small>
                          </div>
                        </div>
                      </td>
                      <td>
                        {product.category}
                        <small>{product.size || 'A confirmar'}</small>
                      </td>
                      <td>{formatPrice(product.price)}</td>
                      <td>
                        <div className="admin-stock-controls">
                          <button
                            disabled={busy || product.stock === 0}
                            aria-label={`Quitar una unidad de ${product.name}`}
                            onClick={() =>
                              void mutate(
                                () => setStock(product, -1),
                                `Stock de ${product.name} actualizado.`,
                              )
                            }
                          >
                            <Minus size={12} />
                          </button>
                          <span>{product.stock}</span>
                          <button
                            disabled={busy || product.stock >= 1_000_000}
                            aria-label={`Agregar una unidad de ${product.name}`}
                            onClick={() =>
                              void mutate(
                                () => setStock(product, 1),
                                `Stock de ${product.name} actualizado.`,
                              )
                            }
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                        {product.stock <= 2 && (
                          <small
                            className={
                              product.stock === 0
                                ? 'admin-out-of-stock'
                                : 'admin-low-stock'
                            }
                          >
                            {product.stock === 0 ? 'Agotada' : 'Pocas unidades'}
                          </small>
                        )}
                      </td>
                      <td>
                        <span
                          className={`admin-catalog-state ${!product.visible || product.archived ? 'is-hidden' : ''}`}
                        >
                          <i />
                          {product.archived
                            ? 'Archivada'
                            : product.visible
                              ? 'Visible'
                              : 'Oculta'}
                        </span>
                      </td>
                      <td>
                        <div className="admin-row-actions">
                          <button
                            onClick={() => setEditing(product)}
                            disabled={busy}
                          >
                            Editar <ArrowUpRight size={10} />
                          </button>
                          <button
                            onClick={() =>
                              void mutate(
                                () =>
                                  archiveProduct(product.id, !product.archived),
                                product.archived
                                  ? `${product.name} restaurada.`
                                  : `${product.name} archivada. Podés restaurarla desde Archivadas.`,
                              )
                            }
                            disabled={busy}
                          >
                            {product.archived ? 'Restaurar' : 'Archivar'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {displayedProducts.length === 0 && (
              <div className="admin-empty">
                <Archive size={28} strokeWidth={1.3} />
                <h3>
                  {search || category !== 'all' || status !== 'all'
                    ? 'No encontramos esas prendas.'
                    : archived
                      ? 'Todavía no hay prendas archivadas.'
                      : 'Tu próxima colección empieza acá.'}
                </h3>
                <p>
                  {search || category !== 'all' || status !== 'all'
                    ? 'Probá con otra búsqueda o cambiá los filtros.'
                    : archived
                      ? 'Las prendas que archives aparecerán en esta sección.'
                      : 'Agregá tu primera prenda para verla en el catálogo.'}
                </p>
                {!archived &&
                  !search &&
                  category === 'all' &&
                  status === 'all' && (
                    <button
                      className="admin-primary-button"
                      onClick={() => setEditing('new')}
                    >
                      <Plus size={15} />
                      Nueva prenda
                    </button>
                  )}
              </div>
            )}
          </section>
          <p className="admin-bottom-note">
            Eterna Belleza · Tu tienda, en tus manos.
          </p>
        </main>
      </div>
      {editing && (
        <ProductForm
          product={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={async (warning) => {
            setNotice(warning || 'Prenda guardada correctamente.')
            await refresh()
          }}
          onWarning={setNotice}
        />
      )}
    </div>
  )
}
