import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'

const env = (
  import.meta as ImportMeta & { env: Record<string, string | undefined> }
).env
const url = env.VITE_SUPABASE_URL?.trim() ?? ''
const key =
  (env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY)?.trim() ??
  ''

export interface SupabaseConfiguration {
  supabase: SupabaseClient | null
  isDemo: boolean
  isConfigured: boolean
  configError: string | null
}

function isPublicKey(value: string): boolean {
  if (
    value.startsWith('sb_publishable_') &&
    value.length > 'sb_publishable_'.length
  )
    return true
  // Legacy anon keys are JWTs. Reading this public claim only catches accidental
  // service_role configuration; the database still verifies every real request.
  const parts = value.split('.')
  if (parts.length !== 3) return false
  try {
    const payload = parts[1].replaceAll('-', '+').replaceAll('_', '/')
    const parsed = JSON.parse(atob(payload)) as { role?: string }
    return parsed.role === 'anon'
  } catch {
    return false
  }
}

export function initializeSupabase(
  projectUrl: string,
  publicKey: string,
): SupabaseConfiguration {
  const url = projectUrl.trim()
  const key = publicKey.trim()
  // Only the absence of both bindings enables local demonstration data.
  const isDemo = !url && !key
  let client: SupabaseClient | null = null
  let configurationError: string | null = null
  if (!isDemo) {
    if (!url || !key) {
      configurationError =
        'La configuración de Supabase está incompleta. Definí VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY.'
    } else {
      try {
        const parsed = new URL(url)
        const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(
          parsed.hostname,
        )
        if (
          (parsed.protocol !== 'https:' &&
            !(parsed.protocol === 'http:' && isLocal)) ||
          parsed.username ||
          parsed.password ||
          parsed.search ||
          parsed.hash ||
          parsed.pathname.replaceAll('/', '')
        ) {
          throw new Error('Invalid project URL')
        }
        if (!isPublicKey(key)) {
          configurationError =
            'La clave de Supabase no es pública o no tiene un formato válido. Usá una clave publishable o anon; nunca una clave secreta ni service_role.'
        } else {
          client = createClient(url, key, {
            auth: {
              persistSession: true,
              autoRefreshToken: true,
              detectSessionInUrl: true,
            },
          })
        }
      } catch {
        // Do not expose the configured URL/key in error output or crash module loading.
        configurationError =
          'No se pudo inicializar Supabase. Revisá la URL pública del proyecto y su clave publishable / anon en la configuración del entorno.'
      }
    }
  }

  return {
    supabase: client,
    isConfigured: Boolean(client),
    isDemo,
    configError: configurationError,
  }
}

export const { supabase, isConfigured, isDemo, configError } =
  initializeSupabase(url, key)

export function assertConfiguration(): void {
  if (configError) throw new Error(configError)
}
