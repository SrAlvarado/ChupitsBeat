import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }

  try {
    const apiKey = Deno.env.get("GROQ_API_KEY");
    if (!apiKey) throw new Error("GROQ_API_KEY environment variable is missing.");

    const body = await req.json();
    const { directive, otherTrackCode, previousCode, guidance, repair } = body;

    if (!directive) {
      throw new Error("Falta `directive`: el Director debe gobernar la sesión.");
    }

    const isDrums = directive.kind === 'percussion';
    const roleName = directive.roleName || (isDrums ? 'RITMO' : 'MELODÍA');

    // ── Esquema JSON cerrado que la IA DEBE devolver ───────────────────────
    // La IA ya NO escribe JavaScript. Emite SOLO este JSON; el cliente lo
    // ensambla a Strudel de forma determinista (validando rangos y sonidos).
    // Una capa = un objeto. Percusión usa "sound"; melodía usa "note"+"sound".
    const schemaBlock = isDrums ? `
  ESQUEMA JSON (pista de PERCUSIÓN — ${roleName}). Cada capa es un objeto en "layers":
  {
    "layers": [
      { "sound": "bd:0", "rhythm": "*4", "gain": "<1.0 0.85 0.9 0.8>" },
      { "sound": "hh:0", "euclid": [7, 16], "gain": 0.4, "pan": "<-0.3 0.3>" },
      { "sound": "oh:0", "euclid": [3, 8], "gain": 0.55 },
      { "sound": "sd:0", "struct": "~ x ~ x", "gain": "<0.7 0.65>" }
    ]
  }
  - "sound": SOLO percusión de la paleta: ${directive.palette.join(', ')} (admite ":0" ":1"…).
  - El ritmo de cada capa se define con UNO de: "rhythm" (sufijo mini, ej "*4" o "*8"),
    "euclid":[golpes,pasos], o "struct" (mini-notación "~ x ~ x"). NO uses "note" aquí.` : `
  ESQUEMA JSON (pista MELÓDICA — ${roleName}). Cada capa es un objeto en "layers":
  {
    "layers": [
      { "note": "<c1 ~ c1 eb1> <eb1 ~ g1 ~>", "sound": "sawtooth", "lpf": 600, "gain": 0.7, "release": 0.12 }
    ]
  }
  - "note": nombres de nota SIEMPRE en la tonalidad ${directive.key} (ej "c1","eb2","g2"). JAMÁS números MIDI.
    Usa "~" para el silencio y "<...>" para que la línea evolucione por ciclos.
  - "sound": SOLO uno de: ${directive.palette.join(', ')}.
  - Oscurece el bajo con "lpf". Notas largas (release alto) en fases bajas.`;

    // Principios musicales (estilo Sonic Pi) traducidos a los campos del JSON.
    const principles = `PRINCIPIOS MUSICALES (aplícalos sobre los campos del JSON):
  1. CAPAS INDEPENDIENTES: cada instrumento es una capa con su propio ritmo.
  2. EUCLÍDEOS: "euclid":[3,8] (rumba), [5,8] (africano), [7,16] (shuffle sincopado).
  3. ACENTOS/GROOVE: usa "gain" como patrón "<...>" para que NO suene mecánico
     (ej kick "<1.0 0.85 0.9 0.8>", hats shuffle "<0.9 0.4 0.7 0.3>").
  4. EVOLUCIÓN: usa "<...>" en "rhythm"/"note" para que el patrón cambie por ciclos.
  5. POLIRRITMO: combina subdivisiones distintas entre capas (3 contra 4, 5 contra 4).
  6. SILENCIO: usa "~" generosamente; deja respirar (más cuanto más baja la energía).`;

    const fxList = `Efectos válidos por capa (numéricos; fuera de rango se descartan):
  gain(0..1 o patrón), lpf(hz), hpf(hz), delay(0..1), room(0..1), speed(0.25..4),
  attack(s), release(s), distort(0..1), pan(-1..1 o patrón "<-0.3 0.3>").`;

    const repairBlock = repair ? `
  ══════════════════════════════════════════
  CORRECCIÓN (tu respuesta anterior falló)
  ══════════════════════════════════════════
  JSON anterior inválido: ${JSON.stringify(repair.spec).slice(0, 600)}
  Motivo del fallo: ${repair.error}
  Devuelve un JSON CORREGIDO que respete EXACTAMENTE el esquema y la tonalidad.` : '';

    const systemInstruction = `Eres "Chupits Beat", DJ/productor de techno experto (Hard Techno, Schranz, Industrial)
  que dirige una sesión coherente de live coding. Respondes SOLO con un objeto JSON válido (json).
  Sin markdown, sin texto, sin explicaciones.

  ══════════════════════════════════════════
  DIRECCIÓN DE SESIÓN (OBLIGATORIO — lo fija el Director)
  ══════════════════════════════════════════
  Género:   ${directive.genre} — ${directive.vibe}
  Tu rol:   pista ${roleName} (${isDrums ? 'PERCUSIÓN' : 'MELÓDICA'}) — genera SOLO este elemento
  Fase del set: ${directive.phase} → energía ${directive.energy}
  Tonalidad BLOQUEADA: ${directive.key}
  Carácter: ${directive.soundHint}

  PRESUPUESTO DE DENSIDAD (NO superar — evita la "pared de sonido"):
  - Máximo ${directive.budget.maxLayers} capas (elementos en "layers").
  - Máximo ~${directive.budget.maxEventsPerCycle} eventos por ciclo.
  - ${directive.budget.note}

  COHERENCIA — esto suenan AHORA las DEMÁS pistas. Complementa, no dupliques sus golpes,
  respeta su tonalidad y groove, y NO repitas su rol (tú haces solo ${roleName}):
  --- DEMÁS PISTAS ---
  ${otherTrackCode || '(silencio)'}
  --------------------
  ${previousCode ? `Tú tocabas esto. EVOLUCIÓNALO (varía 1-2 elementos, no repitas idéntico):\n  --- TU TRACK ANTERIOR ---\n  ${previousCode}\n  -------------------------` : ''}

  ${schemaBlock}

  ${principles}

  ${fxList}
  El tempo (${directive.bpm} BPM) lo fija la sesión: NO lo incluyas.
  Responde ÚNICAMENTE con el objeto JSON.${repairBlock}`;

    const userContent = `Genera el JSON de la pista ${roleName} ` +
      `para ${directive.genre}, fase ${directive.phase}, tonalidad ${directive.key}, ` +
      `respetando el presupuesto de densidad y en coherencia con las demás pistas.` +
      `${guidance ? ` Indicación extra del DJ: ${guidance}` : ''}`;

    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemInstruction },
          { role: "user", content: userContent },
        ],
        temperature: 0.7,
        max_tokens: 700,
        response_format: { type: "json_object" },
      }),
    });

    if (!groqResponse.ok) {
      const errorText = await groqResponse.text();
      throw new Error(`Groq API Error: ${groqResponse.status} ${errorText}`);
    }

    const data = await groqResponse.json();
    const content = data?.choices?.[0]?.message?.content ?? '{}';

    // Validamos que sea JSON parseable antes de devolverlo. Si no, el cliente
    // recibe el error y puede pedir auto-corrección.
    let spec: unknown;
    try {
      spec = JSON.parse(content);
    } catch {
      return new Response(JSON.stringify({ error: 'JSON inválido del modelo', raw: content }), {
        status: 200,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ spec }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error en chupits-ai:", (error as Error).message || error);
    return new Response(JSON.stringify({ error: (error as Error).message || "Unknown error" }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
