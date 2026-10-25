import { useCallback, useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { getProducts } from './lib/products'
import type { Product } from './lib/products'
import { isDemo, supabase } from './lib/supabase'
import Storefront from './components/Storefront'
import OwnerAccess from './components/OwnerAccess'
import Admin from './components/Admin'

export default function App() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(!supabase)
  const [owner, setOwner] = useState(false)
  const [ownerName, setOwnerName] = useState('Propietario')
  const [authError, setAuthError] = useState('')
  const [demoOpen, setDemoOpen] = useState(false)
  const isAdmin = window.location.pathname.replace(/\/$/, '') === '/admin'
  const fetchCounter = useRef(0)
  const refresh = useCallback(async () => {
    const count = ++fetchCounter.current
    setLoading(true)
    try {
      const rows = await getProducts()
      if (fetchCounter.current === count) {
        setProducts(rows)
        setError('')
      }
    } catch (e) {
      if (fetchCounter.current === count)
        setError(
          e instanceof Error ? e.message : 'No se pudieron cargar las prendas.',
        )
      throw e
    } finally {
      if (fetchCounter.current === count) setLoading(false)
    }
  }, [])
  useEffect(() => {
    void refresh().catch(() => {})
  }, [refresh])
  useEffect(() => {
    if (!supabase) return
    let active = true
    // The callback remains synchronous: Supabase auth callbacks must not await RPCs.
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      if (active) {
        setSession(next)
        setOwner(false)
        setAuthReady(!next)
      }
    })
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!active) return
        if (error) {
          setAuthError(
            'No pudimos recuperar tu sesión. Intentá iniciar sesión de nuevo.',
          )
          setAuthReady(true)
        } else {
          setSession(data.session)
          setAuthReady(!data.session)
        }
      })
      .catch(() => {
        if (active) {
          setAuthError('No pudimos comprobar tu sesión.')
          setAuthReady(true)
        }
      })
    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])
  useEffect(() => {
    if (!supabase || !session) return
    let active = true
    const client = supabase
    async function authorize() {
      try {
        const { data, error } = await client.rpc('is_owner')
        if (error) throw error
        if (!active) return
        setOwner(data === true)
        setAuthError('')
        if (data === true) {
          const profile = await client
            .from('owner_accounts')
            .select('display_name')
            .eq('user_id', session!.user.id)
            .single()
          if (active) setOwnerName(profile.data?.display_name || 'Propietario')
        }
      } catch {
        if (active)
          setAuthError(
            'No pudimos verificar los permisos. Revisá la conexión y que el SQL de configuración esté aplicado.',
          )
      } finally {
        if (active) {
          setAuthReady(true)
          void refresh().catch(() => {})
        }
      }
    }
    void authorize()
    return () => {
      active = false
    }
  }, [session, refresh])
  async function logout() {
    if (supabase) {
      const { error } = await supabase.auth.signOut()
      if (error) {
        setAuthError('No se pudo cerrar la sesión. Volvé a intentarlo.')
        return
      }
    }
    setOwner(false)
    setDemoOpen(false)
    setSession(null)
    setProducts([])
    void refresh().catch(() => {})
  }
  useEffect(() => {
    const update = () => {
      if (document.visibilityState === 'visible') void refresh().catch(() => {})
    }
    window.addEventListener('storage', update)
    document.addEventListener('visibilitychange', update)
    return () => {
      window.removeEventListener('storage', update)
      document.removeEventListener('visibilitychange', update)
    }
  }, [refresh])
  if (!isAdmin)
    return (
      <Storefront
        products={products}
        loading={loading}
        error={error}
        retry={() => void refresh().catch(() => {})}
      />
    )
  if (!authReady)
    return (
      <div className="session-loading" role="status">
        <img src="/images/brand.svg" alt="" />
        <p>Preparando tu espacio…</p>
      </div>
    )
  if (owner || (isDemo && demoOpen))
    return (
      <>
        {(error || authError) && (
          <div className="app-error" role="alert">
            {error || authError}
            <button onClick={() => void refresh().catch(() => {})}>
              Reintentar
            </button>
          </div>
        )}
        <Admin
          products={products}
          refresh={refresh}
          onLogout={() => void logout()}
          ownerName={isDemo ? 'Demo local' : ownerName}
        />
      </>
    )
  return (
    <OwnerAccess
      onDemo={() => {
        setDemoOpen(true)
        void refresh().catch(() => {})
      }}
      denied={!!session && !owner}
      authError={authError}
      onLogout={() => void logout()}
    />
  )
}
