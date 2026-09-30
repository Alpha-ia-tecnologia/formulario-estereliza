import { useEffect, useState } from 'react'
import { type ApiClient, apiBase, detectApi } from './api'

/** Cliente do servidor de respostas quando ele existe; null enquanto não se sabe ou quando não há. */
export function useApi(): ApiClient | null {
  const [api, setApi] = useState<ApiClient | null>(null)

  useEffect(() => {
    let active = true
    void detectApi(apiBase()).then((client) => {
      if (active && client) setApi(client)
    })
    return () => {
      active = false
    }
  }, [])

  return api
}
