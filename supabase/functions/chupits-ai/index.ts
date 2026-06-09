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

  ══════════════════════════════════════════
  EJEMPLO HARD TECHNO / SCHRANZ CORRECTO
  ══════════════════════════════════════════

  // Audio: Hard Techno 150 BPM
  setCps(2.5);
  stack(
    s("bd:0*4").gain(0.95),
    s("hh:0*8").gain(0.35).pan("<-0.4 0.4>"),
    s("oh:0").struct("~ ~ ~ x").gain(0.5),
    s("sd:0").struct("~ x ~ x").gain(0.7),
    note("c1 ~ eb1 ~").s("sawtooth").lpf(300).gain(0.85),
    note("<c2 bb1 ab1 g1>").s("square").lpf(600).gain(0.5).release(0.1)
  ).play();

  // Visuales: industrial oscuro
  osc(80, 0.01, 1.2).diff(osc(3, 0.2, 0.8)).modulate(noise(4), 0.15).color(0.9, 0.1, 0.05).out();

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
