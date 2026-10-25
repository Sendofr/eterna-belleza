export function Brand({ footer = false }: { footer?: boolean }) {
  return (
    <a
      href="/"
      className={`brand ${footer ? 'brand-footer' : ''}`}
      aria-label="Eterna Belleza, inicio"
    >
      <img src="/images/brand.svg" alt="" width="64" height="64" />
      <span>
        Eterna Belleza<small>ONLINE SHOP · TU ESTILO, TU ESENCIA</small>
      </span>
    </a>
  )
}
