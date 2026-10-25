import { useState } from 'react'
import {
  ArrowLeft,
  ArrowUpRight,
  Eye,
  EyeOff,
  LockKeyhole,
  Sparkles,
} from 'lucide-react'
import { Brand } from './Brand'
import { configError, isDemo, supabase } from '../lib/supabase'

export default function OwnerAccess({
  onDemo,
  denied,
  authError,
  onLogout,
}: {
  onDemo: () => void
  denied: boolean
  authError: string
  onLogout: () => void
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function login(e: React.FormEvent) {
    e.preventDefault()
    if (!supabase || busy) return
    setBusy(true)
    setError('')
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (error) throw error
    } catch {
      setError(
        'No pudimos iniciar sesión. Revisá tu correo y contraseña e intentá de nuevo.',
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <main className="owner-access">
      <section className="owner-editorial">
        <Brand />
        <div>
          <div className="eyebrow">TU TIENDA, EN TUS MANOS</div>
          <h1>
            Más tiempo
            <br />
            para hacer
            <br />
            <em>brillar tu marca.</em>
          </h1>
          <p>
            Todo tu inventario, en un solo lugar.
            <br />
            Organizá las prendas y mantené el stock al día.
          </p>
          <Sparkles size={50} strokeWidth={1} />
        </div>
        <small>Eterna Belleza. Elegida con amor.</small>
      </section>
      <section className="owner-login">
        <a className="back-store" href="/">
          <ArrowLeft size={15} /> Volver a la tienda
        </a>
        <div className="login-card">
          <span className="login-icon">
            <LockKeyhole size={24} strokeWidth={1.3} />
          </span>
          <div className="eyebrow">ESPACIO DEL PROPIETARIO</div>
          <h2>Hola de nuevo.</h2>
          <p>Tu inventario te está esperando.</p>
          {(authError || error || configError) && (
            <div className="form-error" role="alert">
              {authError || error || configError}
            </div>
          )}
          {denied ? (
            <>
              <div className="form-error" role="alert">
                Esta cuenta no tiene acceso al inventario. Autorizá su UUID en{' '}
                <code>owner_accounts</code> desde Supabase.
              </div>
              <button className="btn login-submit" onClick={onLogout}>
                Cerrar sesión
              </button>
            </>
          ) : isDemo ? (
            <>
              <div className="local-access-notice">
                <strong>Probá la primera versión</strong>
                <p>
                  Supabase todavía no está conectado. Podés explorar un
                  inventario de ejemplo guardado solo en este navegador. No es
                  el acceso a la cuenta de Zuni Bogado.
                </p>
              </div>
              <button className="btn login-submit" onClick={onDemo}>
                Explorar inventario de ejemplo <ArrowUpRight size={16} />
              </button>
              <p className="login-help">
                La guía <code>docs/SUPABASE.md</code> explica cómo conectar la
                base y habilitar tu cuenta.
              </p>
            </>
          ) : (
            <form onSubmit={login}>
              <label htmlFor="owner-email">Correo electrónico</label>
              <input
                id="owner-email"
                type="email"
                autoComplete="username"
                placeholder="tu@correo.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={busy || !!configError}
              />
              <label htmlFor="owner-password">Contraseña</label>
              <div className="password-input">
                <input
                  id="owner-password"
                  type={show ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={busy || !!configError}
                />
                <button
                  type="button"
                  onClick={() => setShow(!show)}
                  aria-label={
                    show ? 'Ocultar contraseña' : 'Mostrar contraseña'
                  }
                >
                  {show ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
              <button
                className="btn login-submit"
                type="submit"
                disabled={busy || !!configError}
              >
                {busy ? 'Ingresando…' : 'Ingresar a mi inventario'}
                <ArrowUpRight size={15} />
              </button>
              <p className="login-help">
                Acceso exclusivo para cuentas autorizadas. Para recuperar tu
                contraseña, usá el correo de recuperación desde Supabase
                Authentication.
              </p>
            </form>
          )}
          <div className="login-secure">
            <LockKeyhole size={12} />{' '}
            {isDemo
              ? 'Demostración local · Sin datos en la nube'
              : 'Acceso seguro con Supabase Auth'}
          </div>
        </div>
        <small className="login-bottom">
          Un espacio para cuidar lo que hace única a tu tienda.
        </small>
      </section>
    </main>
  )
}
