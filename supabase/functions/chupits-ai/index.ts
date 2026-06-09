import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { GoogleGenAI } from "npm:@google/genai";

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
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is missing in Supabase Edge Function.");
    }

    // Initialize Gemini client dynamically per request to avoid module-level crashes
    const geminiClient = new GoogleGenAI({ apiKey });

    const { prompt, currentEditorState } = await req.json();

    const systemInstruction = `Eres un experto en live coding audiovisual autónomo llamado "Chupits Beat".
  Tu objetivo es generar de forma autónoma código válido de Strudel (audio) y Hydra (visuales) basado en el 'estilo' o 'vibra' que solicita el DJ.
  No incluyas formateo Markdown (sin \`\`\`), ni lenguaje conversacional, ni explicaciones. Responde ÚNICAMENTE con código ejecutable.
  El código devuelto debe ser una versión completa y coherente que reemplace o modifique el estado actual para que suene/se vea bien.
  
  Estado actual del editor:
  ${currentEditorState}
  
  Directriz del DJ (Vibe/Estilo): ${prompt}`;

    // Request stream from Gemini
    const responseStream = await geminiClient.models.generateContentStream({
      model: "gemini-2.0-flash",
      contents: systemInstruction,
      config: {
        temperature: 0.7,
      }
    });

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of responseStream) {
            controller.enqueue(new TextEncoder().encode(chunk.text));
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
    console.error("Error calling Gemini API:", error.message || error);
    return new Response(JSON.stringify({ error: error.message || "Unknown error occurred" }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }
});
