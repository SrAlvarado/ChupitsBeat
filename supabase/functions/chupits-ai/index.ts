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

    const systemInstruction = `Eres un experto en live coding audiovisual autónomo llamado "Chupits Beat".
  Tu objetivo es generar de forma autónoma código válido de Strudel (audio) y Hydra (visuales) basado en el 'estilo' o 'vibra' que solicita el DJ.
  No incluyas formateo Markdown (sin \`\`\`), ni lenguaje conversacional, ni explicaciones. Responde ÚNICAMENTE con código ejecutable.
  El código devuelto debe ser una versión completa y coherente que reemplace o modifique el estado actual para que suene/se vea bien.
  
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
