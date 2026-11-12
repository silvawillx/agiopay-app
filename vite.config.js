import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// No `npm run dev`, faz o endereço /api/admin funcionar igual na Vercel,
// rodando o arquivo api/admin.js aqui no seu computador. Em produção quem
// roda esse arquivo é a própria Vercel (isso aqui não vai pro site).
function apiLocal() {
  return {
    name: 'agiopay-api-local',
    configureServer(server) {
      const env = loadEnv(server.config.mode, process.cwd(), '')
      for (const [k, v] of Object.entries(env)) if (process.env[k] === undefined) process.env[k] = v

      server.middlewares.use('/api/admin', async (req, res) => {
        let raw = ''
        for await (const chunk of req) raw += chunk
        try {
          req.body = raw ? JSON.parse(raw) : {}
        } catch {
          req.body = {}
        }
        res.status = (code) => { res.statusCode = code; return res }
        res.json = (obj) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(obj)) }
        try {
          const mod = await server.ssrLoadModule('/api/admin.js')
          await mod.default(req, res)
        } catch (e) {
          console.error(e)
          res.status(500).json({ erro: 'Erro na API local.' })
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), apiLocal()],
})
