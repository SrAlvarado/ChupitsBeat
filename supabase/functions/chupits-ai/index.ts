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

    const body = await req.json();
    const { prompt, currentEditorState, directive, otherTrackCode, previousCode, guidance } = body;

    // ── Bloque de directrices del Director (sesión coherente) ──────────────
    // Si llega `directive`, el Director gobierna la sesión: tonalidad, BPM,
    // fase del set y presupuesto de densidad están FIJADOS. El generador solo
    // rellena su rol dentro de esas reglas y en coherencia con el otro track.
    const directorBlock = directive ? `
  ══════════════════════════════════════════
  DIRECCIÓN DE SESIÓN (OBLIGATORIO — lo fija el Director, NO lo cambies)
  ══════════════════════════════════════════
  Género:   ${directive.genre} — ${directive.vibe}
  Tu rol:   ${directive.role === 'drums' ? 'TRACK A — RITMO (kick + percusión)' : 'TRACK B — BAJO + MELODÍA'}
  Fase del set: ${directive.phase} → energía ${directive.energy}
  Tonalidad BLOQUEADA: ${directive.key}  (TODA nota debe pertenecer a esta tonalidad)
  Sonidos a usar (paleta): ${directive.palette.join(', ')}
  Carácter: ${directive.soundHint}

  PRESUPUESTO DE DENSIDAD (NO superar — esto evita la "pared de sonido"):
  - Máximo ${directive.budget.maxLayers} capas dentro del stack.
  - Máximo ~${directive.budget.maxEventsPerCycle} eventos sonoros por ciclo.
  - ${directive.budget.note}

  COHERENCIA — esto es lo que está sonando AHORA en el otro track. Encájate con
  ello (no dupliques sus golpes, complementa, respeta su tonalidad y groove):
  --- OTRO TRACK ---
  ${otherTrackCode || '(silencio)'}
  ------------------
  ${previousCode ? `Esto es lo que tú tocabas hasta ahora. EVOLUCIONA a partir de ello (no repitas idéntico, varía 1-2 elementos):\n  --- TU TRACK ANTERIOR ---\n  ${previousCode}\n  -------------------------` : ''}

  REGLAS DE TEMPO: NO escribas setCps ni setCpm. El tempo lo fija la sesión (${directive.bpm} BPM). Solo emites el stack(...).play() de TU rol.
  VISUAL sugerido: ${directive.visual}
  ` : '';

    const systemInstruction = `Eres "Chupits Beat", experto en live coding de Strudel (audio) + Hydra (visuales) para techno.
  Responde SOLO con código JavaScript ejecutable. Sin markdown, sin \`\`\`, sin explicaciones.

  REGLAS INAMOVIBLES:
  1. Emite SOLO el stack(...).play() de tu rol + una línea de visual Hydra terminada en .out().
  2. NUNCA escribas setCps() ni setCpm() — el tempo lo fija la sesión.
  3. .s() SIEMPRE recibe un string ("bd", "sawtooth"...) — JAMÁS un número.
  4. note() SIEMPRE con nombres de nota ("c1","eb2","f#3") — JAMÁS números MIDI. Toda línea note()/n() debe llevar .s("...").
  5. Efectos válidos: .gain(0-1) .lpf(hz) .hpf(hz) .speed(x) .delay(0-1) .room(0-1) .pan(-1..1) .attack(s) .release(s) .distort(0-1) .euclid(n,m) .struct("~ x ..").
     NUNCA uses .f(), .filter() ni métodos fuera de esta lista.
  6. Usa el silencio (~) y acentos con .gain("<..>") y evolución con <> para que respire. No satures.
  7. La DIRECCIÓN DE SESIÓN de abajo es OBLIGATORIA: tonalidad, paleta, rol y presupuesto de densidad mandan.

  SONIDOS — percusión con s(): bd sd hh oh cp cr rim perc (variantes con :0 :1 ..), RolandTR909_bd/hh/sd/cp, RolandTR808_bd/hh/sd.
  SINTES con note()+s(): "sawtooth" "square" "triangle" "sine".

  EJEMPLO (ritmo, groove euclídeo, SIN setCps):
  stack(
    s("bd:0*4").gain("<1.0 0.85 0.9 0.8>"),
    s("hh:0").euclid(7,16).gain(0.4).pan("<-0.3 0.3>"),
    s("sd:0").struct("~ x ~ x").gain(0.65)
  ).play();
  osc(40, 0.01, 1).diff(osc(3, 0.2, 0.8)).color(0.9, 0.1, 0.05).out();
  ${directorBlock}
  ${currentEditorState ? `Estado actual del editor:\n  ${currentEditorState}` : ''}`;

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
          {
            role: "user",
            content: directive
              ? `Genera el código de TU ROL (${directive.role === 'drums' ? 'TRACK A — ritmo' : 'TRACK B — bajo/melodía'}) para ${directive.genre}, fase ${directive.phase}, en la tonalidad ${directive.key}, respetando el presupuesto de densidad y en coherencia con el otro track.${guidance ? ` Indicación extra del DJ: ${guidance}` : ''}`
              : `Directriz del DJ (Vibe/Estilo): ${prompt}`,
          }
        ],
        temperature: 0.7,
        max_tokens: 400,
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
