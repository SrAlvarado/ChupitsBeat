/**
 * POST /api/dj — la IA a los platos.
 *
 * Recibe el estado de la consola (emisora + ambientes + diales) y devuelve el
 * próximo tema *escrito en Strudel*. Función serverless de Vercel (runtime
 * Node), en formato Web estándar: un `export default function(req)` a secas se
 * interpretaría como handler de Node `(req, res)` y `req.json()` reventaría.
 *
 * Funciona con dos proveedores, según la clave que haya en el entorno:
 *   ANTHROPIC_API_KEY → Claude
 *   XAI_API_KEY       → Grok
 * Si están las dos, manda DJ_PROVIDER ("claude" | "grok"), y por defecto Claude.
 */
import Anthropic from '@anthropic-ai/sdk'

type Provider = 'claude' | 'grok'

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

/** Qué proveedor toca, según las claves que haya puestas. */
function pickProvider(): Provider | null {
  const forced = process.env.DJ_PROVIDER as Provider | undefined
  if (forced === 'grok' && process.env.XAI_API_KEY) return 'grok'
  if (forced === 'claude' && process.env.ANTHROPIC_API_KEY) return 'claude'
  if (process.env.ANTHROPIC_API_KEY) return 'claude'
  if (process.env.XAI_API_KEY) return 'grok'
  return null
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
  return JSON.parse(text) as Brief
}

/**
 * Traduce el error de xAI a algo que un humano pueda accionar. El cuerpo llega
 * como {"code": "...", "error": "..."} y sin esto acaba volcado en pantalla.
 */
function explainXai(status: number, body: string): string {
  let code = ''
  let detail = ''
  try {
    const parsed = JSON.parse(body) as { code?: string; error?: string | { message?: string } }
    code = parsed.code ?? ''
    detail = typeof parsed.error === 'string' ? parsed.error : (parsed.error?.message ?? '')
  } catch {
    detail = body
  }

  if (/credits or licenses/i.test(detail)) {
    return 'tu equipo de xAI no tiene saldo — añade crédito en console.x.ai y vuelve a darle'
  }
  if (status === 401 || code === 'unauthenticated') {
    return 'xAI no acepta la clave — revisa XAI_API_KEY en Vercel'
  }
  if (status === 403) {
    return `xAI deniega el permiso${detail ? `: ${detail.slice(0, 120)}` : ''}`
  }
  if (status === 404) {
    return `xAI no conoce el modelo "${process.env.XAI_MODEL ?? 'grok-4.6'}" — cámbialo con XAI_MODEL`
  }
  if (status === 429) {
    return 'xAI te está limitando el ritmo — prueba en un minuto'
  }
  if (status >= 500) {
    return 'xAI está teniendo problemas — prueba en un rato'
  }
  return `xAI respondió ${status}${detail ? `: ${detail.slice(0, 120)}` : ''}`
}

/** xAI es compatible con OpenAI, así que basta con fetch: sin dependencia extra. */
async function composeWithGrok(vibe: Vibe): Promise<Brief> {
  const res = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.XAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.XAI_MODEL ?? 'grok-4.6',
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: userPrompt(vibe) },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'tema', schema: SCHEMA, strict: true },
      },
    }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(explainXai(res.status, body))
  }
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('xAI devolvió una respuesta vacía')
  return JSON.parse(content) as Brief
}

export async function POST(req: Request): Promise<Response> {
  const provider = pickProvider()
  if (!provider) {
    return json(
      { error: 'el DJ no tiene clave: añade XAI_API_KEY o ANTHROPIC_API_KEY en Vercel' },
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

  try {
    const brief = provider === 'grok' ? await composeWithGrok(vibe) : await composeWithClaude(vibe)
    return json({ ...brief, by: provider }, 200)
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      return json({ error: 'demasiadas peticiones — prueba en un minuto' }, 429)
    }
    if (err instanceof Anthropic.AuthenticationError) {
      return json({ error: 'Anthropic no acepta la clave — revisa ANTHROPIC_API_KEY en Vercel' }, 502)
    }
    if (err instanceof Anthropic.APIError) {
      return json({ error: `Anthropic respondió ${err.status}` }, 502)
    }
    return json({ error: err instanceof Error ? err.message : 'fallo desconocido' }, 502)
  }
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
