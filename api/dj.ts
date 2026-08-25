/**
 * POST /api/dj — Claude a los platos.
 *
 * Recibe el estado de la consola (ambientes + diales) y devuelve el próximo
 * tema *escrito en Strudel*. Función serverless de Vercel (runtime Node).
 *
 * Necesita ANTHROPIC_API_KEY en el entorno del proyecto.
 */
import Anthropic from '@anthropic-ai/sdk'

interface Vibe {
  genre: 'lofi' | 'house' | 'schranz'
  moods: string[]
  tempo: number
  tapeWear: number
  rain: number
}

const SYSTEM = `Eres el DJ residente de K-LOFI, una emisora lofi generativa cuyo
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

Ajusta el carácter a las etiquetas de ambiente y a los diales: "suciedad" alta
significa filtro más cerrado, .coarse/.crush/.shape mayores y más .vibmod; el
dial de "calle" sólo afecta a la ambientación (no la escribas tú).`

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

/**
 * Vercel espera uno de los formatos Web estándar en /api: o `export default
 * { fetch }`, o un export por método. Un `export default function(req)` a secas
 * lo trataría como handler de Node (req, res) y `req.json()` reventaría.
 */
export async function POST(req: Request): Promise<Response> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return json({ error: 'falta ANTHROPIC_API_KEY en el entorno' }, 500)
  }

  let vibe: Vibe
  try {
    const body = (await req.json()) as { vibe?: Vibe }
    if (!body.vibe) throw new Error('falta vibe')
    vibe = body.vibe
  } catch {
    return json({ error: 'cuerpo inválido' }, 400)
  }

  const client = new Anthropic()

  try {
    const response = await client.messages.create({
      model: 'claude-opus-5',
      max_tokens: 16000,
      system: SYSTEM,
      thinking: { type: 'adaptive' },
      output_config: {
        effort: 'medium',
        format: { type: 'json_schema', schema: SCHEMA },
      },
      messages: [
        {
          role: 'user',
          content: `Emisora: ${vibe.genre}
Ambiente: ${vibe.moods.join(', ') || 'ninguno'}
Tempo: ${vibe.tempo} bpm
Suciedad: ${vibe.tapeWear}%
Calle: ${vibe.rain}%

Escribe el próximo tema para la emisora ${vibe.genre}.`,
        },
      ],
    })

    if (response.stop_reason === 'refusal') {
      return json({ error: 'el DJ ha preferido no pinchar esta' }, 502)
    }

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')

    const brief = JSON.parse(text) as { title: string; line: string; code: string; bars: number }
    return json(brief, 200)
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      return json({ error: 'demasiadas peticiones — prueba en un minuto' }, 429)
    }
    if (err instanceof Anthropic.APIError) {
      return json({ error: `la API respondió ${err.status}` }, 502)
    }
    return json({ error: err instanceof Error ? err.message : 'fallo desconocido' }, 500)
  }
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
