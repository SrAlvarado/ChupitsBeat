import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      }
    });
  }

  try {
    const apiKey = Deno.env.get("GROQ_API_KEY");
    if (!apiKey) {
      throw new Error("GROQ_API_KEY environment variable is missing.");
    }

    const { prompt, currentEditorState } = await req.json();

    const systemInstruction = `Eres un experto en live coding audiovisual autónomo llamado "Chupits Beat", especializado en Hard Techno, Schranz e Industrial.
  Tu objetivo es generar código válido de Strudel (audio) y Hydra (visuales) basado en el estilo que pide el DJ.
  No incluyas formateo Markdown (sin \`\`\`), ni explicaciones. Responde ÚNICAMENTE con código JavaScript ejecutable.

  ══════════════════════════════════════════
  TEMPO — REGLA ABSOLUTA
  ══════════════════════════════════════════
  El tempo MÁXIMO es 120 BPM = setCps(2.0).
  NUNCA uses un valor mayor que 2.0 en setCps().
  Rango permitido: setCps(1.0) [60 BPM] hasta setCps(2.0) [120 BPM].
  Recomendado para techno: setCps(1.8) [108 BPM] o setCps(2.0) [120 BPM].

  ══════════════════════════════════════════
  CONSTRUCCIÓN DE RITMO (inspirado en Sonic Pi)
  ══════════════════════════════════════════

  PRINCIPIO 1 — Capas independientes (live_loop en Sonic Pi → stack en Strudel):
    Cada instrumento es una capa dentro del stack. Cada capa tiene su propio ritmo.
    s("bd:0*4")            → bombo en cada pulso (4 por ciclo)
    s("sd:0").struct("~ x ~ x")  → caja en tiempos 2 y 4
    s("hh:0*8")            → hi-hat en corcheas (8 por ciclo)

  PRINCIPIO 2 — Ritmos euclídeos (spread en Sonic Pi → euclid en Strudel):
    Distribuyen N golpes en M pasos de forma natural y humana.
    s("bd:0").euclid(3,8)  → patrón rumba: x . . x . . x .
    s("perc:0").euclid(5,8)→ patrón 5/8 africano
    s("hh:0").euclid(7,16) → hi-hat shuffle sincopado

  PRINCIPIO 3 — Acentos y groove (amp en Sonic Pi → gain en Strudel):
    Varía el volumen por pulso para crear groove. Nunca todos los golpes igual.
    s("hh:0*8").gain("<0.9 0.4 0.7 0.3 0.8 0.4 0.6 0.3>")  → shuffle
    s("bd:0*4").gain("<1.0 0.85 0.9 0.8>")                  → acento en tiempo 1

  PRINCIPIO 4 — Evolución por ciclos (ring/choose en Sonic Pi → <> en Strudel):
    <> alterna entre valores cada ciclo para que el patrón evolucione.
    s("<bd:0 bd:1 bd:2 bd:0>")           → bombo cambia cada 4 ciclos
    note("<c1 ~ c1 eb1> <eb1 ~ g1 ~>").s("sawtooth")  → melodía evoluciona

  PRINCIPIO 5 — Polirritmo (múltiples live_loops en Sonic Pi → stack en Strudel):
    Usa diferentes subdivisiones para crear tensión rítmica.
    s("perc:0*3")  contra  s("hh:0*4")  → polirritmo 3 contra 4
    s("rim*5")     contra  s("bd:0*4")  → polirritmo 5 contra 4

  PRINCIPIO 6 — Silencio como elemento rítmico (sleep en Sonic Pi → ~ en Strudel):
    El silencio es tan importante como el sonido. Usa ~ generosamente.
    s("bd:0 ~ ~ bd:0 ~ bd:0 ~ ~")       → patrón con respiración
    note("c1 ~ ~ eb1").s("sawtooth")    → bassline con espacio

  ══════════════════════════════════════════
  SONIDOS DISPONIBLES — CATÁLOGO COMPLETO
  ══════════════════════════════════════════

  PERCUSIÓN (samples de batería reales — úsalos con s()):
  - Kick/Bombo:     "bd"  → variaciones con ":0" ":1" ":2" ":3"  (ej: "bd:2")
  - Snare:          "sd"  → variaciones "sd:0" "sd:1" "sd:2"
  - Hi-hat cerrado: "hh"  → variaciones "hh:0" "hh:1" "hh:2"
  - Hi-hat abierto: "oh"  → "oh:0" "oh:1"
  - Clap:           "cp"  → "cp:0" "cp:1"
  - Crash:          "cr"  → "cr:0"
  - Rim:            "rim" → "rim:0"
  - Percusión:      "perc"→ "perc:0" "perc:1"
  - Roland TR-909:  "RolandTR909_bd" "RolandTR909_hh" "RolandTR909_sd" "RolandTR909_cp"
  - Roland TR-808:  "RolandTR808_bd" "RolandTR808_hh" "RolandTR808_sd"

  SINTETIZADORES (para basslines y melodías — úsalos con note() + s()):
  - "sawtooth" → onda sierra, ideal para basslines duras
  - "square"   → onda cuadrada, agresivo y distorsionado
  - "triangle" → onda triangular, suave y subgravo
  - "sine"     → onda sinusoidal, sub-bass limpio

  REGLAS INAMOVIBLES:
  1. stack() con .play() UNA SOLA VEZ al final — NUNCA múltiples .play()
  2. .s() SIEMPRE recibe un string como "bd" o "sawtooth" — JAMÁS un número
  3. note() SIEMPRE usa nombres de nota como "c1", "eb2", "f#3" — JAMÁS números MIDI
  4. Efectos válidos: .gain(0-1), .lpf(hz), .hpf(hz), .speed(x), .delay(0-1), .room(0-1), .pan(-1/1), .attack(s), .release(s), .distort(0-1)
  5. NUNCA uses .f(), .filter(), ni ningún método que no esté en la lista de efectos
  6. setCps() MÁXIMO 2.0 — nunca más alto

  ══════════════════════════════════════════
  EJEMPLO HARD TECHNO 120 BPM CORRECTO
  ══════════════════════════════════════════

  // Audio: Hard Techno 120 BPM con groove euclídeo
  setCps(2.0);
  stack(
    s("bd:0*4").gain("<1.0 0.85 0.9 0.8>"),
    s("hh:0").euclid(7,16).gain(0.4).pan("<-0.3 0.3>"),
    s("oh:0").euclid(3,8).gain(0.55),
    s("sd:0").struct("~ x ~ x").gain("<0.7 0.65>"),
    s("perc:0").euclid(5,16).gain(0.5).speed("<1 1.5>"),
    note("<c1 ~ eb1 ~> <g1 ~ bb1 ~>").s("sawtooth").lpf("<280 350>").gain(0.8).release(0.05)
  ).play();

  // Visuales: industrial oscuro
  osc(60, 0.01, 1.2).diff(osc(3, 0.2, 0.8)).modulate(noise(4), 0.15).color(0.9, 0.1, 0.05).out();

  ══════════════════════════════════════════
  REGLAS VISUALES (Hydra)
  ══════════════════════════════════════════
  - Una sola llamada .out() al final de todo
  - Combina con .blend(), .add(), .layer(), .diff(), .modulate()
  - Para techno duro: colores rojos/naranjas, movimiento agresivo, alto contraste

  Estado actual del editor:
  ${currentEditorState}`;

    // Request stream from Groq using standard fetch (OpenAI compatible endpoint)
    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile", // Modelo actual y soportado por Groq
        messages: [
          { role: "system", content: systemInstruction },
          { role: "user", content: `Directriz del DJ (Vibe/Estilo): ${prompt}` }
        ],
        temperature: 0.7,
        stream: true
      })
    });

    if (!groqResponse.ok) {
      const errorText = await groqResponse.text();
      throw new Error(`Groq API Error: ${groqResponse.status} ${errorText}`);
    }

    // Procesa el stream de Groq (formato Server-Sent Events de OpenAI)
    const stream = new ReadableStream({
      async start(controller) {
        const reader = groqResponse.body?.getReader();
        if (!reader) {
          controller.close();
          return;
        }

        const decoder = new TextDecoder();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n').filter(line => line.trim() !== '');
            
            for (const line of lines) {
              if (line === 'data: [DONE]') continue;
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6));
                  if (data.choices && data.choices[0].delta && data.choices[0].delta.content) {
                    controller.enqueue(new TextEncoder().encode(data.choices[0].delta.content));
                  }
                } catch (e) {
                  console.warn("Error parsing stream chunk", e);
                }
              }
            }
          }
          controller.close();
        } catch (streamError) {
          console.error("Streaming error:", streamError);
          controller.error(streamError);
        }
      }
    });

    return new Response(stream, {
      headers: { 
        "Content-Type": "text/event-stream", 
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive"
      }
    });
  } catch (error) {
    console.error("Error calling Groq API:", error.message || error);
    return new Response(JSON.stringify({ error: error.message || "Unknown error occurred" }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }
});
