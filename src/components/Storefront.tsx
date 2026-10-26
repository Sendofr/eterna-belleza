import { useMemo, useState } from 'react'
import {
  ArrowDown,
  ArrowUpRight,
  Banknote,
  Check,
  Clock3,
  Copy,
  Heart,
  MapPin,
  Menu,
  MessageCircle,
  Search,
  SlidersHorizontal,
  Sparkles,
  Landmark,
  X,
} from 'lucide-react'
import { CATEGORIES, imageUrl } from '../lib/products'
import type { Product } from '../lib/products'
import { isConfigured } from '../lib/supabase'
import { formatPrice, whatsappUrl, WHATSAPP_NUMBER } from '../lib/utils'
import { Brand } from './Brand'
import { Modal } from './Modal'

export const MAP_URL =
  'https://www.google.com/maps/search/?api=1&query=-27.2820707%2C-55.8104614'
const INSTAGRAM = 'https://www.instagram.com/eternabellezapy/'
const TIKTOK = 'https://www.tiktok.com/@eternabelleza34'
const tags = [
  'Un toque de color',
  'Para destacar',
  'Color en tu día',
  'En movimiento',
  'Con personalidad',
]

function External({
  href,
  children,
  className,
  label,
}: {
  href: string
  children: React.ReactNode
  className?: string
  label?: string
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      aria-label={label}
    >
      {children}
    </a>
  )
}

function PaymentMethods({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`payment-methods ${compact ? 'payment-methods-compact' : ''}`}
      aria-label="Medios de pago"
    >
      <span className="payment-methods-title">Medios de pago</span>
      <div>
        <span>
          <Landmark size={12} aria-hidden="true" />
          Transferencia
        </span>
        <span>
          <Banknote size={13} aria-hidden="true" />
          Efectivo
        </span>
      </div>
    </div>
  )
}

export default function Storefront({
  products,
  loading,
  error,
  retry,
}: {
  products: Product[]
  loading: boolean
  error: string
  retry: () => void
}) {
  const [menu, setMenu] = useState(false)
  const [category, setCategory] = useState('Todas')
  const [query, setQuery] = useState('')
  const [stock, setStock] = useState('all')
  const [sort, setSort] = useState('recent')
  const [selected, setSelected] = useState<Product | null>(null)
  const [copyStatus, setCopyStatus] = useState('')
  const publicProducts = useMemo(
    () => products.filter((p) => p.visible && !p.archived),
    [products],
  )
  const filtered = useMemo(() => {
    const q = query.toLocaleLowerCase('es').trim()
    return publicProducts
      .filter(
        (p) =>
          (category === 'Todas' || p.category === category) &&
          (stock === 'all' || p.stock > 0) &&
          `${p.name} ${p.sku} ${p.size}`.toLocaleLowerCase('es').includes(q),
      )
      .sort((a, b) =>
        sort === 'price-asc'
          ? (a.price ?? Infinity) - (b.price ?? Infinity)
          : sort === 'price-desc'
            ? (b.price ?? -1) - (a.price ?? -1)
            : sort === 'name'
              ? a.name.localeCompare(b.name)
              : 0,
      )
  }, [publicProducts, category, query, stock, sort])
  const open = (p: Product) => {
    setSelected(p)
    setCopyStatus('')
  }
  const consultation = selected
    ? `¡Hola, Eterna Belleza! Vi ${selected.name} (código ${selected.sku}${selected.size ? `, talle ${selected.size}` : ''}) en el catálogo. ${selected.stock === 0 ? '¿Me avisan si vuelve a estar disponible?' : '¿Me cuentan más sobre esta prenda y si sigue disponible?'}`
    : ''
  async function copy() {
    try {
      await navigator.clipboard.writeText(consultation)
      setCopyStatus('¡Consulta copiada! Ya podés pegarla en WhatsApp.')
    } catch {
      setCopyStatus(
        'No pudimos copiar. Podés seleccionar el mensaje o enviarlo directamente por WhatsApp.',
      )
    }
  }
  return (
    <>
      <a className="skip-link" href="#coleccion">
        Saltar al catálogo
      </a>
      <div className="announcement">
        <span>ROPA AMERICANA Y BRASILERA · ENCARNACIÓN</span>
        <span>
          Tu próxima favorita te espera <ArrowUpRight size={11} />
        </span>
      </div>
      <header className="header wrap">
        <Brand />
        <nav
          id="main-nav"
          aria-label="Navegación principal"
          className={menu ? 'open' : ''}
        >
          <a href="#coleccion" onClick={() => setMenu(false)}>
            La colección
          </a>
          <a href="#esencia" onClick={() => setMenu(false)}>
            Nuestra esencia
          </a>
          <a href="#visitanos" onClick={() => setMenu(false)}>
            Visitanos
          </a>
          <a href="/admin">Soy el dueño</a>
        </nav>
        <External href={whatsappUrl()} className="btn header-contact">
          Hablemos <ArrowUpRight size={15} />
        </External>
        <button
          className="menu"
          aria-label={menu ? 'Cerrar menú' : 'Abrir menú'}
          aria-controls="main-nav"
          aria-expanded={menu}
          onClick={() => setMenu(!menu)}
        >
          {menu ? <X /> : <Menu />}
        </button>
      </header>
      <main>
        <section className="hero wrap" id="inicio">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="dot" /> ESTILO QUE VUELVE A ENAMORAR
            </div>
            <h1>
              Tu estilo.
              <br />
              Tu esencia.
              <br />
              <em>Tu belleza.</em>
              <span className="asterisk" aria-hidden="true">
                ✧
              </span>
            </h1>
            <p>
              Prendas con personalidad, cómodas y a la moda. Encontrá ese look
              que se siente tan vos.
            </p>
            <div className="hero-actions">
              <a className="btn" href="#coleccion">
                Encontrá tu próxima favorita <ArrowUpRight size={16} />
              </a>
              <a className="text-link" href="#visitanos">
                Conocé la tienda <ArrowDown size={12} />
              </a>
            </div>
            <div className="hero-note">
              <Heart className="loop" size={27} strokeWidth={1.2} />
              <span>
                Elegida con amor.
                <br />
                <strong>Para todos tus gustos y ocasiones.</strong>
              </span>
            </div>
          </div>
          <div className="hero-visual">
            <div className="photo photo-main">
              <img
                src="/images/tropical.webp"
                alt="Vestido con estampado tropical, fotografía de referencia"
                fetchPriority="high"
              />
              <span className="photo-label">PIEZAS QUE HABLAN DE VOS</span>
            </div>
            <div className="photo photo-side">
              <img
                src="/images/white.webp"
                alt="Vestido blanco, fotografía de referencia"
                fetchPriority="high"
              />
            </div>
            <div className="round-seal">
              <span>ETERNA BELLEZA</span>
              <b>
                elegida
                <br />
                con amor.
              </b>
              <span>PARA VOS</span>
            </div>
            <div className="visual-caption">
              <span>
                Tu próxima favorita.
                <br />
                <i>La historia la escribís vos.</i>
              </span>
              <ArrowUpRight size={32} strokeWidth={1} />
            </div>
          </div>
        </section>
        <div className="values-strip">
          <div className="wrap">
            <span>PRENDAS CON PERSONALIDAD</span>
            <b>✧</b>
            <span>ROPA AMERICANA Y BRASILERA</span>
            <b>✧</b>
            <span>ATENCIÓN POR WHATSAPP</span>
            <b>✧</b>
            <span>ENCONTRANOS EN ENCARNACIÓN</span>
          </div>
        </div>
        <section className="collection wrap" id="coleccion">
          <div className="section-heading">
            <div>
              <div className="eyebrow">EL PLACER DE ENCONTRAR</div>
              <h2>
                Ese look que <em>es para vos.</em>
              </h2>
            </div>
            <p>
              Encontrá tu próxima prenda favorita.
              <br />
              Consultanos talles, precios y disponibilidad.
            </p>
          </div>
          <div className="filters" role="group" aria-label="Filtrar prendas">
            {['Todas', ...CATEGORIES].map((c) => (
              <button
                key={c}
                className={category === c ? 'active' : ''}
                aria-pressed={category === c}
                onClick={() => setCategory(c)}
              >
                {c === 'Todas' ? (
                  <>
                    Ver todo{' '}
                    <span>
                      {String(publicProducts.length).padStart(2, '0')}
                    </span>
                  </>
                ) : (
                  c
                )}
              </button>
            ))}
            <span className="result-count" role="status">
              {loading
                ? 'Cargando colección…'
                : `${filtered.length} ${filtered.length === 1 ? 'prenda' : 'prendas'} para descubrir`}
            </span>
          </div>
          <div className="catalog-tools">
            <label className="catalog-search">
              <Search size={15} />
              <span className="sr-only">Buscar prendas</span>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscá tu próxima favorita…"
              />
            </label>
            <label>
              <span className="sr-only">Disponibilidad</span>
              <select
                aria-label="Disponibilidad"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
              >
                <option value="all">Todas las prendas</option>
                <option value="available">Solo disponibles</option>
              </select>
            </label>
            <label>
              <SlidersHorizontal size={13} />
              <span className="sr-only">Ordenar prendas</span>
              <select
                aria-label="Ordenar prendas"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                <option value="recent">Orden original</option>
                <option value="name">Nombre: A a Z</option>
                <option value="price-asc">Menor precio</option>
                <option value="price-desc">Mayor precio</option>
              </select>
            </label>
          </div>
          {!isConfigured && (
            <p className="demo-note">
              <span /> Colección de muestra · Fotos de referencia. Stock y
              precios ilustrativos.
            </p>
          )}
          {error ? (
            <div className="catalog-state" role="alert">
              <h3>No pudimos cargar la colección.</h3>
              <p>{error}</p>
              <button className="btn" onClick={retry}>
                Volver a intentar
              </button>
            </div>
          ) : loading ? (
            <div
              className="products"
              aria-label="Cargando catálogo"
              aria-busy="true"
            >
              {Array.from({ length: 5 }, (_, i) => (
                <div key={i} className="product-skeleton" />
              ))}
            </div>
          ) : (
            <div className="products">
              {filtered.map((p, i) => (
                <article className="product" key={p.id}>
                  <button
                    className="product-photo"
                    aria-label={`Ver y consultar ${p.name}`}
                    onClick={() => open(p)}
                  >
                    <img
                      src={imageUrl(p.image_path)}
                      alt={p.name}
                      loading="lazy"
                    />
                    <span
                      className={`product-tag ${p.stock === 0 ? 'sold-out' : ''}`}
                    >
                      {p.stock === 0
                        ? 'Agotada'
                        : p.is_example
                          ? 'Ejemplo'
                          : tags[i % tags.length]}
                    </span>
                    <span className="photo-arrow" aria-hidden="true">
                      <ArrowUpRight size={16} />
                    </span>
                  </button>
                  <div className="product-info">
                    <span className="product-category">
                      {p.category}
                      {p.size ? ` · ${p.size}` : ''}
                    </span>
                    <h3>{p.name}</h3>
                    <p className="catalog-price">{formatPrice(p.price)}</p>
                    <PaymentMethods compact />
                    <button onClick={() => open(p)}>
                      {p.stock === 0
                        ? 'Consultar reposición'
                        : 'Consultar esta prenda'}
                      <ArrowUpRight size={13} />
                    </button>
                  </div>
                </article>
              ))}
              {filtered.length === 0 && (
                <div className="catalog-state">
                  <Sparkles size={28} strokeWidth={1} />
                  <h3>
                    {publicProducts.length
                      ? 'Todavía no encontramos ese look.'
                      : 'Algo lindo está por llegar.'}
                  </h3>
                  <p>
                    {publicProducts.length
                      ? 'Probá otra categoría o cambiá tu búsqueda.'
                      : 'Estamos preparando nuestra colección. Mientras tanto, escribinos.'}
                  </p>
                  {publicProducts.length > 0 ? (
                    <button
                      className="btn outline"
                      onClick={() => {
                        setCategory('Todas')
                        setQuery('')
                        setStock('all')
                      }}
                    >
                      Limpiar filtros
                    </button>
                  ) : (
                    <External href={whatsappUrl()} className="btn">
                      Consultar por WhatsApp <ArrowUpRight size={14} />
                    </External>
                  )}
                </div>
              )}
            </div>
          )}
          <div className="catalog-note">
            <span>¿Buscás algo en particular? Te ayudamos a encontrarlo.</span>
            <External href={whatsappUrl()}>
              Consultanos por WhatsApp ↗
            </External>
          </div>
        </section>
        <section className="story" id="esencia">
          <div className="wrap story-grid">
            <div className="story-mark" aria-hidden="true">
              <div className="story-symbol">
                <img src="/images/brand.svg" alt="" />
              </div>
              <p>
                Un poquito de rosa.
                <br />
                <em>Mucho de vos.</em>
              </p>
            </div>
            <div className="story-copy">
              <div className="eyebrow">LA ESENCIA ETERNA BELLEZA</div>
              <h2>
                La moda cambia.
                <br />
                <em>Tu esencia se queda.</em>
              </h2>
              <p>
                Creemos en ese flechazo frente al espejo. En descubrir una
                prenda, imaginar nuevas combinaciones y sentir que encontraste
                algo muy tuyo.
              </p>
              <p>
                Ropa americana y brasilera con estilo único, para todos los
                gustos y ocasiones. Elegida con amor, pensada para vos.
              </p>
              <External className="text-link" href={INSTAGRAM}>
                Inspirate en nuestro Instagram <ArrowUpRight size={13} />
              </External>
            </div>
          </div>
        </section>
        <section className="how wrap">
          <div className="eyebrow">ASÍ DE SIMPLE</div>
          <h2>
            Del flechazo <em>a tu placard.</em>
          </h2>
          <div className="steps">
            {[
              [
                'Encontrá tu look',
                'Explorá las prendas y elegí las que van con vos.',
              ],
              [
                'Escribinos',
                'Confirmamos precio, talle y disponibilidad por WhatsApp.',
              ],
              [
                'Elegí cómo recibirlo',
                'Coordiná con nosotras el retiro o consultá las opciones de envío.',
              ],
            ].map(([title, text], i) => (
              <article key={title}>
                <span>0{i + 1}</span>
                <div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
        <section className="visit wrap" id="visitanos">
          <div className="visit-copy">
            <div className="eyebrow">ENCONTRANOS EN ENCARNACIÓN</div>
            <h2>
              Vení a encontrar
              <br />
              <em>tu próxima favorita.</em>
            </h2>
            <div className="visit-detail">
              <MapPin size={22} strokeWidth={1.4} />
              <div>
                <strong>Residencia Benitez Bogado</strong>
                <p>Encarnación, Paraguay · Ubicación de Eterna Belleza</p>
              </div>
            </div>
            <div className="visit-detail">
              <Clock3 size={22} strokeWidth={1.4} />
              <div>
                <strong>Coordiná tu visita con nosotras</strong>
                <p>Consultanos los horarios por WhatsApp.</p>
              </div>
            </div>
            <External href={MAP_URL} className="btn">
              Cómo llegar <ArrowUpRight size={16} />
            </External>
          </div>
          <External
            href={MAP_URL}
            className="map"
            label="Abrir ubicación de Eterna Belleza en Google Maps"
          >
            <div className="map-art">
              <div className="map-road road-one" />
              <div className="map-road road-two" />
              <div className="map-road road-three" />
              <div className="map-road road-four" />
              <span className="map-label">ENCARNACIÓN</span>
              <span className="map-pin">
                <MapPin size={32} fill="currentColor" />
                <b>
                  Eterna Belleza<small>Tu próxima favorita está acá.</small>
                </b>
              </span>
              <span className="map-disclaimer">
                Ubicación ilustrativa · Ver punto exacto en Google Maps
              </span>
            </div>
            <div className="map-caption">
              <span>
                <b>Nos vemos en Eterna Belleza.</b>
                <small>Abrí la ubicación en Google Maps</small>
              </span>
              <ArrowUpRight size={28} strokeWidth={1} />
            </div>
          </External>
        </section>
        <section className="last-cta">
          <div className="wrap">
            <span className="eyebrow">¿HABLAMOS DE TU PRÓXIMO LOOK?</span>
            <h2>El flechazo empieza acá.</h2>
            <External href={whatsappUrl()} className="btn light">
              Escribinos por WhatsApp <ArrowUpRight size={16} />
            </External>
          </div>
        </section>
      </main>
      <footer className="wrap">
        <div className="footer-top">
          <Brand footer />
          <div>
            <External href={INSTAGRAM}>Instagram ↗</External>
            <External href={TIKTOK}>TikTok ↗</External>
            <External href={whatsappUrl()}>WhatsApp ↗</External>
            <a href="#visitanos">Ubicación ↗</a>
            <a href="/admin">Acceso propietario ↗</a>
          </div>
        </div>
        <div className="footer-bottom">
          <span>
            © {new Date().getFullYear()} Eterna Belleza · Encarnación, Paraguay
          </span>
          <span>
            {isConfigured
              ? 'Elegida con amor. Pensada para vos.'
              : 'Primera versión · Catálogo de demostración'}
          </span>
        </div>
      </footer>
      <External
        href={whatsappUrl()}
        className="floating-wa"
        label="Consultar a Eterna Belleza por WhatsApp"
      >
        <MessageCircle size={23} strokeWidth={1.6} />
        <span>¿Te ayudamos?</span>
      </External>
      {selected && (
        <Modal
          title={`Detalle de ${selected.name}`}
          onClose={() => setSelected(null)}
        >
          <button
            className="close-dialog"
            onClick={() => setSelected(null)}
            aria-label="Cerrar detalle"
          >
            <X size={20} />
          </button>
          <div className="dialog-grid">
            <img src={imageUrl(selected.image_path)} alt={selected.name} />
            <div className="dialog-info">
              <span className="eyebrow">TU PRÓXIMO FLECHAZO</span>
              <h2>{selected.name}</h2>
              <p className="detail-meta">
                {selected.category} · {selected.size || 'Talle a confirmar'}
                <br />
                {formatPrice(selected.price)} ·{' '}
                {selected.stock > 0 ? 'Disponible' : 'Agotada'}
              </p>
              <PaymentMethods />
              <p>
                Confirmá el precio, los talles y la disponibilidad de esta
                prenda con nosotras.
              </p>
              <label htmlFor="query-message">Tu consulta</label>
              <textarea
                id="query-message"
                readOnly
                rows={5}
                value={consultation}
              />
              <button className="btn" onClick={copy}>
                {copyStatus.startsWith('¡')
                  ? 'Consulta copiada'
                  : 'Copiar consulta'}
                {copyStatus.startsWith('¡') ? (
                  <Check size={15} />
                ) : (
                  <Copy size={15} />
                )}
              </button>
              <External
                className="btn light-outline"
                href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(consultation)}`}
              >
                Abrir WhatsApp <ArrowUpRight size={16} />
              </External>
              <p className="copy-feedback" role="status">
                {copyStatus ||
                  'Tu consulta se abrirá lista para enviar por WhatsApp.'}
              </p>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
