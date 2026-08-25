/**
 * POST /api/dj — la IA a los platos.
 *
 * Recibe el estado de la consola (emisora + ambientes + diales) y devuelve el
 * próximo tema *escrito en Strudel*. Función serverless de Vercel (runtime
 * Node), en formato Web estándar: un `export default function(req)` a secas se
 * interpretaría como handler de Node `(req, res)` y `req.json()` reventaría.
 *
 * Funciona con tres proveedores, según la clave que haya en el entorno:
 *   ANTHROPIC_API_KEY → Claude
 *   XAI_API_KEY       → Grok
 *   GEMINI_API_KEY    → Gemini
 * Si hay varias, manda DJ_PROVIDER; si no, se prueban en ese orden y se pasa a
 * la siguiente cuando una falla por saldo, cuota o clave: así una variable
 * olvidada en el entorno no deja la radio sin DJ.
 *
 * xAI y Gemini exponen endpoint compatible con OpenAI, así que comparten
 * camino: sólo cambian la URL, la clave y el modelo.
 */
import Anthropic from '@anthropic-ai/sdk'

type Provider = 'claude' | 'grok' | 'gemini'

interface OpenAICompatible {
  label: string
  url: string
  key: string
  model: string
  /** Gemini rechaza additionalProperties/strict en su capa OpenAI. */
  strict: boolean
}

/** Configuración de cada proveedor compatible con OpenAI. */
function openAiConfig(provider: 'grok' | 'gemini'): OpenAICompatible {
  return provider === 'grok'
    ? {
        label: 'xAI',
        url: 'https://api.x.ai/v1/chat/completions',
        key: process.env.XAI_API_KEY!,
        model: process.env.XAI_MODEL ?? 'grok-4.6',
        strict: true,
      }
    : {
        label: 'Gemini',
        url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
        key: (process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY)!,
        model: process.env.GEMINI_MODEL ?? 'gemini-3.7-flash',
        strict: false,
      }
}

interface Vibe {
  genre: 'lofi' | 'house' | 'schranz'
  moods: string[]
  tempo: number
  tapeWear: number
  rain: number
}

interface Brief {
  title: string
  line: string
  code: string
  bars: number
}

const SYSTEM = `Eres el DJ residente de ChupitBeats, una radio generativa cuyo
motor es Strudel (live coding de patrones sobre Web Audio).

Escribes el próximo tema como un programa de Strudel completo. Reglas del motor:

- Empieza siempre con setcpm(TEMPO/4) usando el tempo que te den.
- Cada capa va en su propia línea "$: ...".
- Sonidos sintetizados disponibles en .sound(): "sine", "triangle", "square", "sawtooth".
- Percusión por samples con s("bd sd hh oh rim cp") + .bank("RolandTR808" |
  "RolandTR909" | "RolandTR707" | "LinnLM1" | "AkaiLinn" | "RhythmAce").
- Efectos válidos: .lpf .lpq .hpf .room .roomsize .delay .delaytime .delayfeedback
  .vib .vibmod .coarse .crush .gain .pan .attack .decay .sustain .release .legato
  .degradeBy .sometimesBy .swingBy .late .arp .struct .fast .slow .add
- Termina CADA capa con .analyze(1) para que el visualizador reciba señal.
- .arp() toma un patrón de ÍNDICES numéricos, p. ej. .arp("0 1 2 3 2 1"), NO
  nombres de modo como "up".
- Las notas van en nombres tipo "c4 eb4 g4"; los acordes como "[c4,eb4,g4]";
  la alternancia por compás como "<[..] [..] [..] [..]>".
- Nada de samples de melodía, nada de import, nada de código fuera de Strudel.

IMPORTANTE: no todas las cajas tienen los mismos sonidos. bd, sd, hh y oh
existen siempre; rim y cp NO están en RhythmAce, y rim tampoco en AkaiLinn.
Si no estás seguro, usa sd.

Hay tres emisoras y escribes en la que te digan:

- LOFI (60-92 bpm) — jazz de habitación: séptimas y novenas, piano eléctrico con
  .sound("sine"), bajo escaso, batería suave con .swingBy(1/24, 4), mucha reverb
  y filtro cerrado. Cajas suaves: RolandTR808, LinnLM1, AkaiLinn, RhythmAce.
- HOUSE (112-132 bpm) — sótano: s("bd*4") sin perdón, palmas en el 2 y el 4,
  charles abierto a contratiempo con s("~ oh").fast(4), bajo de corcheas en
  .sound("sawtooth") con .lpf bajo y .lpq alto, stabs de acordes cortos con
  envolvente percusiva. Caja: RolandTR909 o RolandTR707.
- SCHRANZ (140-172 bpm) — nave industrial: bombo a negras muy distorsionado
  (.shape .crush), percusión rodante de charles, línea ácida en sawtooth con
  .lpf modulado por perlin y .lpq muy alto, drone grave por debajo. Sin acordes
  bonitos: esto es chapa. Caja: RolandTR909.

Ajusta el carácter a las etiquetas de ambiente y a los diales: "textura" alta
significa filtro más cerrado, .coarse/.crush/.shape mayores y más .vibmod; el
dial de "ambiente" sólo afecta a la ambientación (no la escribas tú).`

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'line', 'code', 'bars'],
  properties: {
    title: { type: 'string', description: 'Título del tema, en minúsculas, 2-4 palabras, en español' },
    line: { type: 'string', description: 'Una frase de DJ presentando el tema, en español, máx. 90 caracteres' },
    code: { type: 'string', description: 'El programa de Strudel completo' },
    bars: { type: 'integer', minimum: 16, maximum: 48, description: 'Duración del tema en compases' },
  },
} as const

const userPrompt = (vibe: Vibe) => `Emisora: ${vibe.genre}
Ambiente: ${vibe.moods.join(', ') || 'ninguno'}
Tempo: ${vibe.tempo} bpm
Textura: ${vibe.tapeWear}%
Ambiente de calle: ${vibe.rain}%

Escribe el próximo tema para la emisora ${vibe.genre}.`

/** Proveedores con clave, en el orden en que se van a intentar. */
function pickProviders(): Provider[] {
  const has: Record<Provider, boolean> = {
    claude: !!process.env.ANTHROPIC_API_KEY,
    grok: !!process.env.XAI_API_KEY,
    gemini: !!(process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY),
  }
  const order = (['claude', 'grok', 'gemini'] as Provider[]).filter((p) => has[p])
  const forced = process.env.DJ_PROVIDER as Provider | undefined
  if (forced && has[forced]) return [forced, ...order.filter((p) => p !== forced)]
  return order
}

async function composeWithClaude(vibe: Vibe): Promise<Brief> {
  const client = new Anthropic()
  const response = await client.messages.create({
    model: 'claude-opus-5',
    max_tokens: 16000,
    system: SYSTEM,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA } },
    messages: [{ role: 'user', content: userPrompt(vibe) }],
  })
  if (response.stop_reason === 'refusal') {
    throw new Error('el DJ ha preferido no pinchar esta')
  }
  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
  return parseBrief(text)
}

/**
 * Traduce el error de xAI a algo que un humano pueda accionar. El cuerpo llega
 * como {"code": "...", "error": "..."} y sin esto acaba volcado en pantalla.
 */
function explainProvider(cfg: OpenAICompatible, status: number, body: string): string {
  let code = ''
  let detail = ''
  try {
    const parsed = JSON.parse(body) as {
      code?: string
      error?: string | { message?: string; status?: string }
    }
    code = parsed.code ?? ''
    if (typeof parsed.error === 'string') {
      detail = parsed.error
    } else {
      detail = parsed.error?.message ?? ''
      code = code || (parsed.error?.status ?? '')
    }
  } catch {
    detail = body
  }

  const envVar = cfg.label === 'xAI' ? 'XAI_API_KEY' : 'GEMINI_API_KEY'
  const modelVar = cfg.label === 'xAI' ? 'XAI_MODEL' : 'GEMINI_MODEL'

  if (/credits or licenses|billing|quota.*exceeded|insufficient/i.test(detail)) {
    return `${cfg.label} dice que no hay saldo o cuota disponible — revisa la facturación de tu cuenta`
  }
  if (status === 401 || /api key not valid|invalid.*api key/i.test(detail) || code === 'unauthenticated') {
    return `${cfg.label} no acepta la clave — revisa ${envVar} en Vercel`
  }
  if (status === 403) {
    return `${cfg.label} deniega el permiso${detail ? `: ${detail.slice(0, 120)}` : ''}`
  }
  if (status === 404 || /not found|unsupported model/i.test(detail)) {
    return `${cfg.label} no conoce el modelo "${cfg.model}" — cámbialo con ${modelVar}`
  }
  if (status === 429) {
    return `${cfg.label} te está limitando el ritmo — prueba en un minuto`
  }
  if (status >= 500) {
    return `${cfg.label} está teniendo problemas (${status})${detail ? `: ${detail.slice(0, 160)}` : ''}`
  }
  return `${cfg.label} respondió ${status}${detail ? `: ${detail.slice(0, 120)}` : ''}`
}

/**
 * Algunos modelos devuelven el JSON envuelto en un bloque markdown pese al
 * response_format. Se extrae el objeto antes de parsear.
 */
function parseBrief(raw: string): Brief {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim()
  try {
    return JSON.parse(cleaned) as Brief
  } catch {
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start === -1 || end <= start) throw new Error('la respuesta no traía JSON')
    return JSON.parse(cleaned.slice(start, end + 1)) as Brief
  }
}

/** xAI y Gemini hablan OpenAI, así que basta con fetch: sin dependencia extra. */
async function composeWithOpenAI(cfg: OpenAICompatible, vibe: Vibe): Promise<Brief> {
  // Gemini no admite additionalProperties ni strict en su capa de compatibilidad
  const { additionalProperties, ...loose } = SCHEMA
  const schema = cfg.strict ? SCHEMA : loose

  const strictFormat = {
    type: 'json_schema',
    json_schema: cfg.strict ? { name: 'tema', schema, strict: true } : { name: 'tema', schema },
  }

  // Primero con el esquema; si el proveedor lo rechaza, se repite pidiendo JSON
  // a secas y describiendo la forma en el prompt. Algunos modelos tropiezan con
  // la capa de structured outputs pero devuelven el objeto sin problema.
  const attempts: Array<{ format: unknown; hint: string }> = [
    { format: strictFormat, hint: '' },
    {
      format: { type: 'json_object' },
      hint: '\n\nResponde ÚNICAMENTE con un objeto JSON con estas claves: ' +
        'title (string), line (string), code (string con el programa de Strudel) ' +
        'y bars (entero entre 16 y 48). Sin texto alrededor.',
    },
  ]

  let last = ''
  for (const attempt of attempts) {
    const res = await fetch(cfg.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.key}` },
      body: JSON.stringify({
        model: cfg.model,
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: userPrompt(vibe) + attempt.hint },
        ],
        response_format: attempt.format,
      }),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.error(`[dj] ${cfg.label} ${res.status}: ${body.slice(0, 500)}`)
      last = explainProvider(cfg, res.status, body)
      continue
    }
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
    const content = data.choices?.[0]?.message?.content
    if (!content) {
      last = `${cfg.label} devolvió una respuesta vacía`
      continue
    }
    return parseBrief(content)
  }
  throw new Error(last || `${cfg.label} no ha devuelto nada aprovechable`)
}

export async function POST(req: Request): Promise<Response> {
  const providers = pickProviders()
  if (providers.length === 0) {
    return json(
      { error: 'el DJ no tiene clave: añade GEMINI_API_KEY, XAI_API_KEY o ANTHROPIC_API_KEY en Vercel' },
      500,
    )
  }

  let vibe: Vibe
  try {
    const body = (await req.json()) as { vibe?: Vibe }
    if (!body.vibe) throw new Error('falta vibe')
    vibe = body.vibe
  } catch {
    return json({ error: 'cuerpo inválido' }, 400)
  }

  const failures: string[] = []
  for (const provider of providers) {
    try {
      const brief =
        provider === 'claude'
          ? await composeWithClaude(vibe)
          : await composeWithOpenAI(openAiConfig(provider), vibe)
      return json({ ...brief, by: provider }, 200)
    } catch (err) {
      failures.push(describe(err))
    }
  }
  // todas han fallado: se cuenta la primera, que es la del proveedor preferido
  return json({ error: failures[0] ?? 'fallo desconocido', tried: providers }, 502)
}

/** Un error de proveedor, ya masticado para enseñarlo en pantalla. */
function describe(err: unknown): string {
  if (err instanceof Anthropic.RateLimitError) {
    return 'Anthropic te está limitando el ritmo — prueba en un minuto'
  }
  if (err instanceof Anthropic.AuthenticationError) {
    return 'Anthropic no acepta la clave — revisa ANTHROPIC_API_KEY en Vercel'
  }
  if (err instanceof Anthropic.APIError) {
    return `Anthropic respondió ${err.status}`
  }
  return err instanceof Error ? err.message : 'fallo desconocido'
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
