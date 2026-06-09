import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import mime from 'mime-types';
import WebSocket from 'ws';

// Leer variables de entorno (proporcionadas por GitHub Actions)
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET_NAME = 'chupits-hosting';
const BUILD_DIR = './dist';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Error: Faltan variables de entorno SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

// Configurar el cliente usando 'ws' para compatibilidad con Node < 22 en GitHub Actions
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    persistSession: false
  },
  global: {
    fetch: fetch
  },
  realtime: {
    transport: WebSocket
  }
});

// Recorre recursivamente el directorio de build
function getFiles(dir, filesList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      getFiles(filePath, filesList);
    } else {
      filesList.push(filePath);
    }
  }
  return filesList;
}

async function deploy() {
  console.log(`Iniciando despliegue al bucket: ${BUCKET_NAME}`);
  
  if (!fs.existsSync(BUILD_DIR)) {
    console.error(`Error: El directorio de build ${BUILD_DIR} no existe. Ejecuta 'npm run build' primero.`);
    process.exit(1);
  }

  const allFiles = getFiles(BUILD_DIR);
  
  for (const filePath of allFiles) {
    // Calcular ruta relativa dentro del bucket
    const relativePath = path.relative(BUILD_DIR, filePath).replace(/\\/g, '/');
    const fileContent = fs.readFileSync(filePath);
    const contentType = mime.lookup(filePath) || 'application/octet-stream';

    console.log(`Subiendo: ${relativePath} (${contentType})`);

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(relativePath, fileContent, {
        contentType,
        upsert: true, // Forzar reescritura
        cacheControl: '3600'
      });

    if (error) {
      console.error(`Fallo al subir ${relativePath}:`, error.message);
    } else {
      console.log(`Éxito: ${relativePath}`);
    }
  }

  console.log("¡Despliegue finalizado con éxito!");
}

deploy();
