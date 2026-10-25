import { describe, expect, it } from 'vitest'
import { initializeSupabase } from './supabase'

describe('Supabase public configuration', () => {
  it('uses local demo only when neither binding is provided', () => {
    const configuration = initializeSupabase('', '')
    expect(configuration.isDemo).toBe(true)
    expect(configuration.isConfigured).toBe(false)
    expect(configuration.configError).toBe(null)
    expect(configuration.configError).toBe(null)
  })
  it.each([
    ['https://example.supabase.co', ''],
    ['', 'sb_publishable_example'],
  ])(
    'reports partial configuration instead of silently enabling demo',
    (url, key) => {
      const configuration = initializeSupabase(url, key)
      expect(configuration.isDemo).toBe(false)
      expect(configuration.supabase).toBe(null)
      expect(configuration.configError).toContain('incompleta')
    },
  )
  it.each([
    'not a URL',
    'ftp://example.com',
    'https://user:secret@example.com',
    'https://example.supabase.co/rest/v1',
  ])('does not crash module import with invalid project URL %s', (url) => {
    const configuration = initializeSupabase(url, 'sb_publishable_example')
    expect(configuration.isDemo).toBe(false)
    expect(configuration.isConfigured).toBe(false)
    expect(configuration.configError).toContain('No se pudo inicializar')
    expect(configuration.configError).not.toContain(url)
  })
  it.each([
    'sb_secret_example',
    'invalid-key',
    `e30.${btoa(JSON.stringify({ role: 'service_role' }))}.signature`,
  ])('rejects private or malformed keys without showing them', (key) => {
    const configuration = initializeSupabase('https://example.supabase.co', key)
    expect(configuration.isConfigured).toBe(false)
    expect(configuration.isDemo).toBe(false)
    expect(configuration.configError).toContain('clave de Supabase')
    expect(configuration.configError).not.toContain(key)
  })
  it('accepts a public publishable key and project URL', () => {
    const configuration = initializeSupabase(
      'https://example.supabase.co',
      'sb_publishable_example',
    )
    expect(configuration.configError).toBe(null)
    expect(configuration.isConfigured).toBe(true)
    expect(configuration.isDemo).toBe(false)
  })
})
