# **Evaluación Arquitectónica y Estado del Arte: Sistemas Autónomos de Live Coding Audiovisual Orientados al Techno**

## **Fundamentos del Ecosistema Live Coding y la Cultura Algorave**

El desarrollo de sistemas audiovisuales autónomos se inserta en un contexto histórico e interdisciplinar profundamente arraigado en la subcultura del *live coding* y el movimiento Algorave (raves algorítmicas). A diferencia de los paradigmas tradicionales de producción de música electrónica, donde el software opera como una interfaz gráfica opaca, el *live coding* expone el código fuente como un instrumento performático en sí mismo1. Este movimiento se fundamenta en la transparencia radical y la improvisación, exigiendo que las instrucciones informáticas se proyecten visualmente para que la audiencia pueda observar y decodificar la emisión de condicionales y ciclos repetitivos que estructuran la música y los visuales3.  
La práctica ha adquirido un estatus institucional y comunitario a nivel global a través de la red TOPLAP (The Temporary Organisation for the Promotion of Live Algorithm Programming), la cual fomenta la accesibilidad y la filosofía de código abierto5. En regiones como España, comunidades vibrantes en Barcelona, Madrid y el País Vasco impulsan constantemente los límites de esta disciplina6. Eventos emblemáticos como el festival VIU, alojado en el centro de investigación artística Hangar en Barcelona, institucionalizan formatos como las sesiones "from scratch" (desde cero)9. En estos formatos, los intérpretes inician su actuación frente a una pantalla completamente en blanco y disponen de un estricto margen de nueve minutos para erigir ecosistemas algorítmicos complejos, demostrando el nivel de abstracción y la agilidad de los lenguajes de programación empleados9.  
El concepto central que rige estas actuaciones es la "vivacidad" (*liveness*), que explora la tensión entre el cálculo preprogramado y la ejecución material espontánea12. Al trasladar este marco conceptual a una aplicación autónoma gobernada por inteligencia artificial, el desafío reside en preservar esa vivacidad estocástica y la transparencia performática, evitando que la IA actúe como una caja negra que simplemente reproduce secuencias pre-renderizadas.

## **Análisis Tecnológico de los Motores Generativos**

La viabilidad de construir un director virtual para sesiones de techno en el navegador descansa sobre los pilares de motores de síntesis altamente optimizados para la web. La arquitectura bajo análisis emplea Strudel para la manipulación simbólica del sonido e Hydra para la síntesis de video reactivo, ambos ejecutándose en el lado del cliente.

### **Arquitectura y Motor de Audio: Strudel**

Strudel constituye una adaptación revolucionaria de TidalCycles, el entorno originario escrito en Haskell, trasladando la elegancia de la composición funcional paramétrica al ecosistema de JavaScript14. Mientras TidalCycles requiere instalaciones complejas que delegan la síntesis de sonido a SuperCollider, Strudel opera nativamente en cualquier navegador moderno explotando la Web Audio API y bibliotecas accesorias para la síntesis en tiempo real16. Esta democratización elimina las barreras técnicas y permite un despliegue sin fricciones en aplicaciones web17.  
El núcleo algorítmico de Strudel funciona mediante un flujo de control riguroso de tres fases. Inicialmente, el código ingresado se transpila para convertir las expresiones de la *mini-notation* (una sintaxis compacta para ritmos euclidianos y polirritmias) en funciones evaluables18. Posteriormente, un planificador iterativo (*scheduler*) interroga este patrón evaluado en intervalos regulares (calculados en milisegundos), generando eventos discretos denominados *haps* (del término *happenings*) que corresponden a fragmentos específicos de la línea temporal18. Finalmente, estos *haps* se envían al motor de síntesis, el cual ejecuta los osciladores o manipula *samples* pre-cargados18.  
La cadena de procesamiento de señales DSP (Digital Signal Processing) dentro de Strudel es exhaustiva. Un evento sonoro activo pasa por fases de modificación de ganancia, envolventes de ataque, decaimiento, sostenimiento y liberación (ADSR), y posteriormente atraviesa una serie de transformaciones que incluyen filtros de paso bajo (LPF), paso alto (HPF), distorsión de forma de onda, compresión y espacialización estéreo19. Finalmente, el sonido se divide entre canales directos y envíos espaciales (reverberación y retardo), integrándose en un "órbita" maestra que permite efectos globales como el *ducking* (compresión *sidechain*), esencial para la cadencia rítmica de la música techno19.

| Lenguaje / Entorno | Paradigma Base | Motor de Síntesis | Accesibilidad Web | Enfoque Principal |
| :---- | :---- | :---- | :---- | :---- |
| **TidalCycles** | Haskell (Funcional puro) | SuperCollider | Nula (Requiere instalación local compleja) | Manipulación extrema de patrones matemáticos17. |
| **Sonic Pi** | Ruby (Imperativo/Estructural) | SuperCollider | Baja (Aplicación de escritorio nativa) | Accesibilidad educativa y legibilidad secuencial17. |
| **Strudel** | JavaScript (Funcional/Reactivo) | Web Audio API / Tone.js | Total (Nativo del navegador) | Democratización del Algorave, colaboración remota17. |

El diseño de patrones para géneros como el "hard techno" o industrial requiere un conocimiento profundo de la sintaxis temporal. Las métricas suelen oscilar entre 130 y 150 BPM, requiriendo instrucciones precisas para generar bombos agresivos (ej. s("bd\*4")), líneas de bajo ácidas moduladas mediante osciladores de baja frecuencia, y texturas rítmicas disonantes que utilizan funciones como jux o every para transformar el patrón dinámicamente cada cierto número de ciclos21.

### **Arquitectura y Motor Visual: Hydra**

Para la contraparte visual, Hydra proporciona un entorno de codificación interactivo basado en WebGL, diseñado bajo la filosofía de los sintetizadores de video modulares analógicos24. El sistema compila instrucciones encadenadas de JavaScript directamente en *shaders* de fragmentos (GLSL), permitiendo ejecutar transformaciones complejas en la unidad de procesamiento gráfico (GPU) con latencias casi nulas. Hydra maneja múltiples *framebuffers* internos (o0, o1, o2, o3), lo que facilita la retroalimentación de video y la mezcla de múltiples fuentes de entrada, desde cámaras web hasta capturas de escritorio o transmisiones WebRTC remotas25.  
La simbiosis entre Hydra y Strudel alcanza su máxima expresión en la modulación audio-reactiva. Históricamente, las plataformas como p5.js empleaban la Transformada Rápida de Fourier (FFT) para dividir la señal discreta en intervalos de frecuencia mediante cálculos iterativos que reducen la complejidad a ![][image1]27. Hydra abstrae este rigor matemático mediante bibliotecas integradas como Meyda, exponiendo un objeto de audio global que captura las bandas del espectro28. Parámetros de Hydra pueden mapearse dinámicamente utilizando funciones anónimas (ej. () \=\> a.fft\[0\] \* 4), donde el índice del arreglo corresponde a segmentos que van desde frecuencias subgraves hasta agudos cristalinos28. En ecosistemas web consolidados, la directiva await initHydra({detectAudio:true}) o el parámetro feedStrudel permiten a los desarrolladores inyectar el bus maestro de Strudel directamente en las variables reactivas de Hydra, consolidando una coreografía audiovisual matemáticamente precisa30.

## **Inteligencia Artificial en la Generación Musical en Tiempo Real**

El paradigma de utilizar algoritmos de aprendizaje automático para componer o manipular música electrónica en vivo ha divergido en dos aproximaciones arquitectónicas radicalmente opuestas: la manipulación directa de señales de audio (DSP) y la inferencia simbólica multimodelo.

### **Modelos de Audio Directo y Limitaciones de Latencia**

La rama del procesamiento directo de audio emplea arquitecturas de redes neuronales, típicamente transformadores autorregresivos, para predecir representaciones acústicas. Proyectos fundamentales como MusicGen transforman secuencias de texto y melodías base en *tokens* cuantizados de audio31. La inmensa carga computacional requerida para generar estos arreglos de onda obliga a sistemas de hardware sofisticados, como estaciones de trabajo NVIDIA DGX-2, a procesar conjuntos de datos masivos (como el Lakh MIDI Dataset)32.  
Para contrarrestar la inherente latencia de estas arquitecturas predictivas en aplicaciones interactivas, los investigadores han desarrollado técnicas de "streaming" o generación continua33. Al segmentar el proceso de decodificación, el sistema no espera a que se calculen los 1000 pasos necesarios para un bloque de 20 segundos; en su lugar, reproduce incrementos audibles tan pronto como el primer segmento de *tokens* es sintetizado (aproximadamente cada 0.02 segundos de ventana temporal)33. Aunque el resultado acústico es de alta fidelidad, la falta de estructuras simbólicas editables impide que el audio sea modificado paramétricamente. El sonido final se comporta como una transmisión monolítica pre-renderizada35, haciendo de esta vía un enfoque incompatible con el espíritu algorítmico paramétrico del Algorave, donde modificar la resonancia de un filtro o la métrica de un *hi-hat* en vivo es indispensable.

### **Inferencia Simbólica y Sistemas Multi-Agente**

La alternativa de vanguardia para la actuación autónoma en tiempo real es la generación simbólica: sistemas donde la IA no escupe ondas de sonido, sino código, parámetros y lógica condicional. Un exponente notable es el concepto de "DJ Nova", un agente de IA diseñado para interactuar con ecosistemas de blockchain y producir música de baile electrónica de forma autónoma36. Sin embargo, la materialización técnica más avanzada de este concepto se observa en proyectos de código abierto como *Swarm DJ*37.  
*Swarm DJ* aborda la disonancia temporal entre la velocidad del LLM (que genera texto a velocidades impredecibles *token* por *token*) y las estrictas necesidades isócronas del audio DSP (donde perder un búfer temporal genera chasquidos audibles) mediante el desacoplamiento arquitectónico37. La infraestructura delega la síntesis pura de audio en Python (usando NumPy y pedalboards) ejecutada en hilos de alta prioridad, mientras gestiona la carga cognitiva de la IA a través de un *broker* de mensajería MQTT que opera como el sistema nervioso del conjunto37.  
La innovación de *Swarm DJ* radica en su estructura de gobernanza. Un solo modelo lingüístico (como Llama 3.2 vía Ollama) es orquestado para interpretar a múltiples entidades separadas que debaten en lenguaje natural37:

| Entidad / Agente | Enfoque de Diseño de Sonido | Controles Paramétricos | Poder de Veto de Emergencia |
| :---- | :---- | :---- | :---- |
| **El Arquitecto** | Estructura macroscópica, teoría musical y cadencia métrica. | BPM, Fase del compás. | **Tempo Lock:** Congela el ritmo durante 32 compases38. |
| **El Fantasma** | Texturas atmosféricas y metáforas acústicas oscuras. | Reverberación, Filtros. | **Ambient Wash:** Inunda el canal maestro con reverberación38. |
| **El Bromista** | Caos estocástico y entropía sistémica. | Delay, Aleatoriedad, Glitch. | **Glitch Storm:** Asignación caótica de parámetros por 8 compases38. |
| **El Director** | Facilitación diplomática. | Ninguno. | Resuelve empates en la votación del consejo38. |

Cada cuatro compases musicales (aproximadamente 8 segundos a 126 BPM), el consejo de agentes evalúa el estado del sistema. Formulan deliberaciones y envían propuestas codificadas con puntuaciones de confianza que oscilan entre 0.0 y 1.0. Para evitar estancamientos burocráticos, el sistema ejecuta dictatorialmente la orden con mayor puntuación de confianza, publicando el cambio a los canales de MQTT (audio/commands) para una interpolación suave38.

### **Generación Específica de Código Strudel**

Paralelamente a las arquitecturas multi-agente, el ecosistema ha desarrollado marcos orientados específicamente a la escritura directa de código para *live coding*. El repositorio strudel-claude-music-generator evidencia cómo los LLMs avanzados pueden sintetizar secuencias algorítmicas de Strudel si se les confina dentro de límites semánticos estrictos39. En lugar de permitir a la IA inventar nombres de librerías de sonido que podrían causar fallos críticos, el marco inyecta documentación exhaustiva de un subconjunto curado de *samples* (como bd, hh, sd, o emulaciones General MIDI como gm\_synth\_bass\_1) directamente en el aviso del sistema (*system prompt*)39.  
Proyectos relacionados como strudelplay y apfelstrudel han comenzado a utilizar integraciones del protocolo MCP (Model Context Protocol) o WebSockets bidireccionales, que facilitan un puente entre los entornos del editor local (como Neovim o VS Code) y la interfaz de evaluación nativa del navegador40. Estos repositorios demuestran la madurez de la tecnología de "recarga en caliente" (*hot reload*), evaluando *scripts* de JavaScript transpilados y mitigando las anomalías algorítmicas antes de que perturben el planificador rítmico.

## **Evaluación Arquitectónica de "Chupits Beat" frente al Estado del Arte**

El diseño del proyecto propuesto, *Chupits Beat*, amalgama componentes de primer nivel: una interfaz de cliente en React para alojar Strudel e Hydra, Supabase Edge Functions para la lógica de red, y la variante hospedada en Groq del modelo Llama 3.3 para la "Dirección" autónoma. Esta arquitectura ostenta claras ventajas, pero también presenta vulnerabilidades críticas inherentes al uso de LLMs asíncronos en contextos donde los fallos sintácticos detienen la totalidad de la pista.

### **Ventajas Estratégicas de la Arquitectura**

1. **Velocidad de Inferencia a través de Groq:** El uso de Llama 3.3 desplegado en la Unidad de Procesamiento de Lenguaje (LPU) de Groq supone una ventaja sísmica frente a entornos locales que utilizan Ollama (como *Swarm DJ*). La aceleración de hardware LPU permite rendimientos de generación de cientos de *tokens* por segundo, minimizando el cuello de botella del razonamiento y habilitando a la IA para analizar la matriz temporal y generar la siguiente sección del código Strudel en una ventana sub-segundo, justo a tiempo para el inicio del siguiente bloque.  
2. **Ejecución descentralizada y Web-Native:** Al integrar directamente Strudel e Hydra en React, *Chupits Beat* descarga la monstruosa exigencia computacional de la síntesis de audio DSP y el renderizado WebGL al procesador y GPU del dispositivo cliente. Frente a servidores remotos que procesan audio con librerías de Python, este enfoque es hiper-escalable y se adhiere a la filosofía del Algorave de accesibilidad universal17.

### **Desafíos Fundamentales y Riesgos Arquitectónicos**

La estructura de *Chupits Beat* confronta tres dilemas operativos sustanciales en su iteración actual:

* **Dilema 1: Inestabilidad de la Evaluación Abstracta (El Peligro del eval()).** Un LLM, por su diseño probabilístico, no es un compilador estricto. Si el 'Director' alucina un corchete, olvida una coma en la notación euclidiana, o intenta acceder a un canal de vídeo de Hydra mal declarado (ej. usando osc().out(o9) cuando Hydra tiene un límite máximo de 8 salidas de renderizado24), la inyección cruda de este código vía eval() o su equivalente estructural provocará una excepción en JavaScript18. A diferencia de un texto narrativo donde un error ortográfico es perdonable, en *live coding*, una alucinación silencia el escenario.  
* **Dilema 2: Asincronía de Supabase Edge Functions.** La música electrónica exige exactitud rítmica absoluta. Las *Edge Functions* operan bajo un modelo HTTP sin estado (*stateless*), lo que significa que el 'Director' se despierta sin un reloj interno sincronizado con el planificador de Strudel. Si se solicitan cambios en la métrica (BPM) o en la textura basándose en *webhooks* no sincronizados, las modificaciones aterrizarán a destiempo, destruyendo el impacto de las transiciones (el fundamental *drop* en el techno).  
* **Dilema 3: Singularidad Cognitiva.** Depender de una única figura centralizada de 'Director' corre el riesgo de homogeneizar la producción. Los entornos multimodelo, donde las variables acústicas y visuales compiten por la prominencia del espectro, generan una disonancia algorítmica atractiva y profundamente humana que enriquece la evolución del arreglo musical38.

## **Retroalimentación Exhaustiva y Sugerencias de Ingeniería para la Implementación**

Para superar las brechas identificadas entre el concepto original de *Chupits Beat* y los sistemas de estado del arte, se detallan a continuación estrategias de implementación avanzadas orientadas a la resiliencia y sofisticación creativa.

### **1\. Implementación de Decodificación Restringida por Gramática (GCD)**

La literatura reciente en procesamiento de lenguajes naturales evidencia que las dependencias probabilísticas no supervisadas distorsionan la validez sintáctica44. La Decodificación Restringida por Gramática (GCD) ataca este problema encriptando las reglas sintácticas como condicionantes estrictos de probabilidad44.  
Sistemas como SynCode o aproximaciones de Backus-Naur Form (BNF) restringen el modelo enmascarando estocásticamente los *logits* durante la decodificación, permitiendo únicamente trayectorias de *tokens* que respetan el autómata finito determinista dictado por la gramática45. Sin embargo, la API en la nube de Groq puede no exponer la manipulación directa de la capa de decodificación logarítmica.  
Por tanto, **la solución arquitectónica óptima para Chupits Beat** es prohibir al 'Director' escribir código en bruto (como cadenas completas de JavaScript). En su lugar, el sistema de Llama 3.3 debe ser constreñido mediante instrucciones estrictas para que emita respuestas estandarizadas exclusivamente en una sintaxis JSON validada estructuralmente47.  
El cliente en React asumirá la responsabilidad del ensamblaje. Recepcionará el objeto JSON y lo traducirá mecánicamente al código de Strudel e Hydra subyacente.

| Tipo de Estructura | Entrada de IA (Director Llama 3.3) | Salida en el Cliente (React Transpiler) | Impacto de Seguridad |
| :---- | :---- | :---- | :---- |
| **Lógica Estocástica** | Genera código JS en texto plano. | Ejecuta a través de eval(texto). | Altísimo. Riesgo de cuelgue por excepciones sintácticas18. |
| **Control Basado en JSON** | Genera {"bom": 138, "kick": "bd\*4", "visual\_sat": 0.8} | Construye cadenas seguras s(json.kick) | Nulo. Los parámetros fuera de rango se descartan silenciosamente mediante validación estricta de esquemas Zod o Yup. |

Esta matriz estructurada mitiga las alucinaciones por diseño, asegurando que Llama no referencie bancos de sonido que no están precargados.

### **2\. Sincronía Temporal basada en Supabase Realtime**

Para resolver la ceguera de tiempo del 'Director', la topología de la aplicación no debe confiar en peticiones periódicas del lado del cliente. El cliente de React que ejecuta Strudel alberga un planificador cíclico robusto18. Cada vez que el motor de audio transita una medida estructural clave (por ejemplo, el inicio de un nuevo bloque de cuatro compases), el cliente React debe emitir un evento a un canal de transmisión de Supabase Realtime (vía WebSockets).  
La *Edge Function* estará escuchando estas balizas (*heartbeats*) rítmicas. Invocará al modelo Llama 3.3 proporcionando el estado integral (historial de medidas transcurridas, intensidad de banda, intenciones de progresión armónica). Gracias al bajo recargo transaccional de Groq, la resolución del modelo en formato JSON puede ser inyectada de regreso en el canal de WebSockets *antes* del cumplimiento de la rotación actual, permitiendo a Strudel empalmar imperceptiblemente la evolución paramétrica al patrón activo sin latencias ni desgarros de red38.

### **3\. Deconstrucción Arquitectónica del Agente 'Director'**

La riqueza sónica de los modelos multi-agente como *Swarm DJ* debe ser emulada mediante ingeniería de *prompts* segmentada37. En lugar de instruir a Llama 3.3 con una directiva monolítica, la *Edge Function* debe resolver en paralelo múltiples hilos de personalidades controladas bajo el mismo motor:

* **El Orquestador Secuencial:** Encargado de mantener la lógica de las baterías de la "bomba techno". Define patrones euclidianos y manipula transiciones de silencio (restos o *drop downs*) mediante métricas compactas (por ejemplo s("bd\*4, hh\*8?, \~ cp \~ cp").bank("RolandTR909"))20.  
* **El Matizador Envolvente:** Un segundo *prompt* paralelo gobierna las envolventes melódicas ácidas y sombrías utilizando escalas menores características (como C:minor o D:dorian) sobre sintetizadores en diente de sierra, alterando profundamente los valores de resonancia en el filtro de paso bajo a través del tiempo20.  
* **El Generador Visual:** Toma las densidades de ambos, e infiere configuraciones paramétricas agresivas en Hydra, manipulando el índice de ruido o las rotaciones caleidoscópicas de los bucles de retroalimentación24.

La consolidación final se realiza ensamblando los JSON antes de despacharlos de vuelta al canal.

### **4\. Simbiosis Reactiva mediante Metadatos de FFT**

Para que *Chupits Beat* se manifieste como una entidad coherente donde el impacto de los graves manipule visiblemente la geometría, el canal de Hydra no debe depender solo de coordenadas matemáticas impuestas por la IA. En el cliente de React, es imperativo establecer la interconexión reactiva de ambos sistemas ejecutando la instrucción de Hydra que asimila el contexto de audio: await initHydra({detectAudio:true}) o feedStrudel30.  
Una vez interconectados, la IA gobernante ya no necesita codificar la animación fotograma por fotograma. El 'Director' puede asignar dinámicamente comportamientos a los algoritmos de análisis espectral integrados, dictando que el arreglo de la Transformada de Fourier a.fft regule la vibración de las matrices RGB. Por ejemplo, el 'Director' puede dictar parámetros para una función de modulación dinámica como modulate(o0, () \=\> a.fft\[1\] \* densidad\_visual) donde densidad\_visual es el valor controlado autónomamente por Llama27.

### **5\. Bucles de Supervivencia y Telemetría de Errores**

Por último, el diseño de código impulsado por IA necesita tolerar la falla. Las estrategias modernas para la fijación automática de código evitan las trazas de pila estáticas en favor de seguimientos contextuales de datos49. En la aplicación React, la evaluación del código transpilado debe estar encapsulada en construcciones severas de captura de errores (try/catch).  
Si el JSON recibido o la inyección directa provoca una invalidación temporal en Strudel, el manejador de errores activará un mecanismo de tolerancia a fallos: el estado musical se retendrá inalterado, repitiendo el segmento rítmico anterior en modo bucle. Simultáneamente, el cliente despachará un mensaje asíncrono a Supabase que incluya el objeto JSON infractor y la salida del error de la consola JavaScript. Llama 3.3 utilizará esta telemetría en frío para recalibrar los pesos estocásticos y devolver una iteración corregida del patrón49. Esta capa subyacente de "vergüenza de código" silenciada garantiza que la audiencia nunca perciba la inestabilidad técnica de la mente de la IA, preservando la inmersión de la experiencia en vivo.  
La adopción de estas contramedidas y estrategias potenciará la estructura base de *Chupits Beat*. Evolucionará de un experimento de prueba de concepto hacia un sistema robusto de grado de producción, abrazando el linaje impredecible e interactivo de las raves algorítmicas, e integrándose armónicamente como un referente del estado del arte en el diseño audiovisual autónomo.

#### **Obras citadas**

1. Live Coding Network \- UKRI Gateway to Research, [https://gtr.ukri.org/projects?ref=AH%2FL007266%2F1](https://gtr.ukri.org/projects?ref=AH/L007266/1)  
2. Algorave: Live Performance of Algorithmic Electronic Dance Music, [https://www.nime.org/proceedings/2014/nime2014\_426.pdf](https://www.nime.org/proceedings/2014/nime2014_426.pdf)  
3. These DJs Are Making Music By Coding on a Huge Screen \- Futurism, [https://futurism.com/djs-making-music-coding](https://futurism.com/djs-making-music-coding)  
4. 'Algorave' Is the Future of Dance Music (if You're a Nerd) \- Creating Music With Computer Code \- Vice Magazine, [https://www.vice.com/en/article/algorave-is-the-future-of-dance-music-if-youre-an-html-coder/](https://www.vice.com/en/article/algorave-is-the-future-of-dance-music-if-youre-an-html-coder/)  
5. Linz Algorave: Wireless a benefit gut geschlafen \- servus.at, [https://core.servus.at/de/projekt/2025/linz-algorave-wireless-benefit-gut-geschlafen](https://core.servus.at/de/projekt/2025/linz-algorave-wireless-benefit-gut-geschlafen)  
6. TOPLAP Athens: A Networked Live Coding Community \- research.chalmers.se, [https://research.chalmers.se/publication/546821/file/546821\_Fulltext.pdf](https://research.chalmers.se/publication/546821/file/546821_Fulltext.pdf)  
7. TOPLAP nodes, [https://blog.toplap.org/nodes/](https://blog.toplap.org/nodes/)  
8. Azkuna Zentroa: Taller de live coding, programación y música con, [https://www.kulturklik.euskadi.eus/noticia/20160201120226/azkuna-zentroa-taller-de-live-coding-programacion-y-musica-con-sonic-pi/kulturklik/es/webkklik01-detnewpr/es/](https://www.kulturklik.euskadi.eus/noticia/20160201120226/azkuna-zentroa-taller-de-live-coding-programacion-y-musica-con-sonic-pi/kulturklik/es/webkklik01-detnewpr/es/)  
9. VIU \*/ 2026 \- Live Coding Festival \- toplap.cat, [https://toplap.cat/posts/viu-2026-overview/](https://toplap.cat/posts/viu-2026-overview/)  
10. Page 2 – The home of Live Coding \- TOPLAP (dev refresh), [https://dev.toplap.org/page/2/](https://dev.toplap.org/page/2/)  
11. VIU \- Live coding Festival \- On the fly, [https://onthefly.space/read/viu-live-coding-festival](https://onthefly.space/read/viu-live-coding-festival)  
12. ICLC 2025 Call for Submissions \- International Conference on Live Coding, [https://iclc.toplap.org/2025/call.html](https://iclc.toplap.org/2025/call.html)  
13. ICLC 2025 \- International Conference on Live Coding, [https://iclc.toplap.org/2025/](https://iclc.toplap.org/2025/)  
14. Strudel REPL, [https://strudel.cc/](https://strudel.cc/)  
15. Live code with Tidal Cycles | Tidal Cycles, [https://tidalcycles.org/](https://tidalcycles.org/)  
16. Strudel REPL – a music live coding environment living in the browser | Hacker News, [https://news.ycombinator.com/item?id=45571822](https://news.ycombinator.com/item?id=45571822)  
17. Strudel vs Tidal Cycles vs Sonic Pi vs Chuck vs Beat DJ: Which Live Coding System Fits Your Flow? | Soniare, [https://www.soniare.net/blog/live-coding-systems-comparison](https://www.soniare.net/blog/live-coding-systems-comparison)  
18. REPL Strudel, [https://strudel.cc/technical-manual/repl/](https://strudel.cc/technical-manual/repl/)  
19. Audio effects Strudel, [https://strudel.cc/learn/effects/](https://strudel.cc/learn/effects/)  
20. vakofmaya/BreathOfStrudle: A Complete A \-to- Final Track Course designed for Strudle. From Sound Desing, music theory to building tracks.. \- GitHub, [https://github.com/vakofmaya/BreathOfStrudle](https://github.com/vakofmaya/BreathOfStrudle)  
21. learning techno patterns \- Strudel REPL, [https://strudel.cc/?hY4KtIO3xpCd](https://strudel.cc/?hY4KtIO3xpCd)  
22. skills@0.2.14 • ai-ecoverse • Registry \- Tessl, [https://tessl.io/registry/ai-ecoverse/skills/0.2.14/files/skills/strudel-music/SKILL.md](https://tessl.io/registry/ai-ecoverse/skills/0.2.14/files/skills/strudel-music/SKILL.md)  
23. live-coding-music-mcp/patterns/examples/README.md at main \- GitHub, [https://github.com/williamzujkowski/live-coding-music-mcp/blob/main/patterns/examples/README.md](https://github.com/williamzujkowski/live-coding-music-mcp/blob/main/patterns/examples/README.md)  
24. hydra | Patchies, [https://patchies.app/docs/objects/hydra](https://patchies.app/docs/objects/hydra)  
25. ojack/hydra-sync \- GitHub, [https://github.com/ojack/hydra-sync](https://github.com/ojack/hydra-sync)  
26. hydra-synth/hydra: Livecoding networked visuals in the browser \- GitHub, [https://github.com/hydra-synth/hydra](https://github.com/hydra-synth/hydra)  
27. Making Audio Reactive Visuals with FFT \- sangarshanan, [https://sangarshanan.com/2024/11/05/visualising-music/](https://sangarshanan.com/2024/11/05/visualising-music/)  
28. Audio | hydra video synth, [https://hydra.ojack.xyz/hydra-docs-v2/docs/learning/sequencing-and-interactivity/audio/](https://hydra.ojack.xyz/hydra-docs-v2/docs/learning/sequencing-and-interactivity/audio/)  
29. almerito/nodemaru: No Code Visual Composer web app ... \- GitHub, [https://github.com/almerito/nodemaru](https://github.com/almerito/nodemaru)  
30. Hydra Strudel, [https://strudel.cc/learn/hydra/](https://strudel.cc/learn/hydra/)  
31. MusicGen \- Advanced AI Music Generation, [https://musicgen.com/](https://musicgen.com/)  
32. Applying Language Model Techniques to Compose AI Music | NVIDIA Technical Blog, [https://developer.nvidia.com/blog/leveraging-ai-music-with-nvidia-dgx-2/](https://developer.nvidia.com/blog/leveraging-ai-music-with-nvidia-dgx-2/)  
33. MusicGen Streaming \- a Hugging Face Space by sanchit-gandhi, [https://huggingface.co/spaces/sanchit-gandhi/musicgen-streaming](https://huggingface.co/spaces/sanchit-gandhi/musicgen-streaming)  
34. Streaming Generation for Music Accompaniment \- Yusong Wu, [https://lukewys.github.io/stream-music-gen/](https://lukewys.github.io/stream-music-gen/)  
35. Streaming Generation for Music Accompaniment \- arXiv, [https://arxiv.org/html/2510.22105v1](https://arxiv.org/html/2510.22105v1)  
36. DJ Nova \- AI Agent Store, [https://aiagentstore.ai/ai-agent/dj-nova](https://aiagentstore.ai/ai-agent/dj-nova)  
37. How I Built Swarm DJ: A Multi-Agent AI System Performing Live Electronic Music, [https://dev.to/harishkotra/how-i-built-swarm-dj-a-multi-agent-ai-system-performing-live-electronic-music-3lc2](https://dev.to/harishkotra/how-i-built-swarm-dj-a-multi-agent-ai-system-performing-live-electronic-music-3lc2)  
38. harishkotra/swarmdj: A distributed AI music system where multiple Ollama-powered agents collaboratively control a live electronic music stream. \- GitHub, [https://github.com/harishkotra/swarmdj](https://github.com/harishkotra/swarmdj)  
39. Strudel \+ Claude: AI-Powered Music Composition Tool \- GitHub, [https://github.com/etbars/strudel-claude-music-generator](https://github.com/etbars/strudel-claude-music-generator)  
40. gruvw/strudel.nvim \- GitHub, [https://github.com/gruvw/strudel.nvim](https://github.com/gruvw/strudel.nvim)  
41. GitHub \- therebelrobot/strudelplay: ‍ Use your own code editor to live-code in Strudel\! Live-reloading, file separation, auto-server for local samples, and more\!, [https://github.com/therebelrobot/strudelplay](https://github.com/therebelrobot/strudelplay)  
42. GitHub \- rcarmo/apfelstrudel: Live coding music environment with AI agent chat, [https://github.com/rcarmo/apfelstrudel](https://github.com/rcarmo/apfelstrudel)  
43. A Model Context Protocol (MCP) server that gives Claude direct control over Strudel.cc for AI-assisted music generation and live coding. \- GitHub, [https://github.com/williamzujkowski/live-coding-music-mcp](https://github.com/williamzujkowski/live-coding-music-mcp)  
44. Grammar-Aligned Decoding \- arXiv, [https://arxiv.org/html/2405.21047v1](https://arxiv.org/html/2405.21047v1)  
45. Improving LLM Code Generation with Grammar Augmentation \- arXiv, [https://arxiv.org/html/2403.01632v1](https://arxiv.org/html/2403.01632v1)  
46. PSC: Efficient Grammar-Constrained Decoding via Parser Stack Classification, [https://openreview.net/forum?id=SEjxNfQTHN](https://openreview.net/forum?id=SEjxNfQTHN)  
47. What is BNF Grammar and how to use it with LLMs, [https://camillemo.github.io/posts/bnf/](https://camillemo.github.io/posts/bnf/)  
48. Accelerating LLM Code Generation Through Mask Store Streamlining \- Hugging Face, [https://huggingface.co/blog/vivien/grammar-llm-decoding](https://huggingface.co/blog/vivien/grammar-llm-decoding)  
49. AI-Powered Code Bug Fixing: Guide to Faster Debugging, [https://www.augmentcode.com/learn/ai-powered-code-bug-fixing-guide](https://www.augmentcode.com/learn/ai-powered-code-bug-fixing-guide)  
50. Which ai coder now can try running the code and check the error until it actually runs?, [https://www.reddit.com/r/ChatGPTCoding/comments/1hul664/which\_ai\_coder\_now\_can\_try\_running\_the\_code\_and/](https://www.reddit.com/r/ChatGPTCoding/comments/1hul664/which_ai_coder_now_can_try_running_the_code_and/)

[image1]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGcAAAAaCAYAAACq/ULmAAAEG0lEQVR4Xu2ZWahOURTHl3kKkRQZkgwRKcn0IEMoT4ZQRIqQSIkMT16QoSTCA8+GQuGFl0tCooQyU+Z5nuf1v3uve/e3vr3PPve63/2+uudXq3P2f+19zv7OPnuvtc9HlJGRURqM1UIdpwNbfS3WBF3ZdrFtZ2ulfD4WsK3UYg3TgK2XFkucv1r4H7aSueAsW+7C9oLtW0WNfDqzPdGiwysy1xTT3KNc/81cdznvKNy+0Lxk+03h+5+i3P4/dXyN2f445WqB6YcL40Y+flH4JmjXVIuKI2yXyNQdqnygIdt1LSrwwvgeTm2wlO00mfuvUj4BA+jjLNsWLVYF3BRvcIhRZOqMVvowtu9K84G2eItw/KF8YDHbBC0qplLxBue1PYZmTz+2TVq0YDn2tUnFI4o3lpl1UOk/KV2seW+PGBhcBzPF5Zkq+5hE8X4WCrnvNXve1/GBfZQcm9FmjBZjjCDTsEzpmjZk6mHtd4HWTGma/mzL7PlwMm2wRLikeegTKVxvOZm1HglMI+UTkE0eYJtpy2VsXyq8YeqxHbXnLcj04WOlu5xQv4QbbBe0GANvPi4cixn4Qah32dFaWi3GITJTW0Ab3e6cKvvwDU5Hq3WzZZnhMypqmIcLbY0t77FlgGMsA1zCNtApI/aiHa4r4DkmsZry+x7F96B83CJTDymzMNJqMXSdDVaT2YRrptkj+QYH5Z1K62N12WOcsWUXlDcrLYTEG2E8mfYym3qzrat0e5lO+X1IpD2lHxxfvTkezYfEGxf3es9dRwJ6cMbZcmtHE6DvtudIhXU/UT6htBC6LXD7v5/McpfEYPJfJ4hkEV+1QzGFTD2dZs+2ehIDyMQDjQTWHvaYBj04e23ZF2Pc3yVxTuhky3g5Y2D2Hdcis4PMNebaY4xBlK5eDmgQaxSqM4T8ugumvs7MgARWzCqdHITQg4O9B8oSb1yg33XK8jLgfjgi9U0Dll78Th/yXNJsJaZR/FnlIZ0N8YCM3/d2SgaXRJJfAitiVxr0D5RAL7FLkH5hDwbmkVnzq8MHLTjcJ3OftdrhAduNpGcRBI2uaJHMWh3LQtAWm0sfyHLgd7MaFwmsaVlIpr6b+a23mgs+N91xyj3J1LlIZpYeY9tI/ljlgn0J2jXXDktbMv5YpguuUm6mWyXk+9d5Mms1zhHEYvjeXCxj2Ae8sYa9BIK3D50JhfjM9pjtIZkN62HHhzQXSwv6Apvv+EA7x6dNkgbNJ7a3ZPqPc7wEPuBLA+4VegYFYwWl72CxwIPBnkwjn6QKjSy/RQE39gX9UgH98y2tsmEtNCfZtmmxtkDsuK3FEkLikpt4TLaaXpJrGrwAoa/VtQYCLLKiUgYDgb8u8DlpkfIViqIPjDBbC3Wc7mxNtJiRkZGRkVFK/AMnBCTHoFJhywAAAABJRU5ErkJggg==>