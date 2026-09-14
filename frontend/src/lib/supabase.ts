import { tr } from '../i18n'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(tr("Supabase 환경변수가 설정되지 않았습니다. Google 로그인은 비활성화됩니다."))
}

export const supabase = createClient(
  supabaseUrl ?? 'https://missing-supabase-url.supabase.co',
  supabaseAnonKey ?? 'missing-supabase-anon-key',
)

export function isSupabaseConfigured() {
  return Boolean(supabaseUrl && supabaseAnonKey)
}
