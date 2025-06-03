"use server"

import { revalidatePath } from "next/cache"
import { del } from "@vercel/blob"
import crypto from "crypto"
import OpenAI from "openai"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { google } from "googleapis"

// Initialize OpenAI client
// Ensure your OPENAI_API_KEY is in .env.local
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Update the documents array type to include documentType and year
let documents: {
  id: string
  name: string
  url: string
  uploadedAt: string
  isValid: boolean
  validationMessage?: string
  documentType?: string
  companyType?: string
  documentYear?: number
}[] = []

let selectedCompanyType: "regular" | "agricultural" | "new" | null = null
let maximoEndeudamiento: number | null = null;
let plazoMaximoDeudaAnos: number | null = null; // New state for maximum debt term in years

export async function setCompanyType(type: "regular" | "agricultural" | "new") {
  selectedCompanyType = type
  revalidatePath("/")
  return { success: true }
}

export async function getCompanyType() {
  return selectedCompanyType
}

export async function resetCompanyType() {
  selectedCompanyType = null
  revalidatePath("/")
  return { success: true }
}

export async function setMaximoEndeudamiento(amount: number | null) {
  if (amount !== null && isNaN(amount)) {
    // Or handle as an error, for now, we'll just set to null if invalid
    maximoEndeudamiento = null;
  } else {
    maximoEndeudamiento = amount;
  }
  revalidatePath("/");
  return { success: true, currentAmount: maximoEndeudamiento };
}

export async function getMaximoEndeudamiento() {
  return maximoEndeudamiento;
}

// New actions for Plazo Maximo Deuda Anos
export async function setPlazoMaximoDeudaAnos(anos: number | null) {
  if (anos !== null && (isNaN(anos) || anos < 0)) {
    plazoMaximoDeudaAnos = null; // Invalid input, set to null
  } else {
    plazoMaximoDeudaAnos = anos;
  }
  revalidatePath("/");
  return { success: true, currentPlazoAnos: plazoMaximoDeudaAnos };
}

export async function getPlazoMaximoDeudaAnos() {
  return plazoMaximoDeudaAnos;
}

// Helper function to extract year from document content
// Modified to be more flexible for projections if needed, or we can create a separate one.
// For now, let's make a slight adjustment to how it might be used for projections.
function extractYearFromContent(content: string, fileName: string, isProjection: boolean = false): number | null {
  const currentYear = new Date().getFullYear()
  const yearPattern = /\b(20\d{2})\b/g // Looks for 20xx years
  let matches = [...content.matchAll(yearPattern), ...fileName.matchAll(yearPattern)]

  if (matches.length === 0) return null

  let years = matches
    .map((match) => Number.parseInt(match[1]))
    .filter((year) => year >= 2000 && year <= currentYear + 20) // Allow years well into the future for projections
    .sort((a, b) => b - a) // Sort descending (latest year first)

  if (isProjection) {
    // For projections, we want the latest future year or current year if no future years found that are relevant.
    const futureYears = years.filter(year => year >= currentYear);
    if (futureYears.length > 0) return futureYears[0]; // Return latest future year found
    // If no future years, but there are current/past years, it might be a historical cash flow or badly described.
    // Depending on strictness, we might return null or the latest of any year found.
    // For this validation, if no clear future projection year, it likely fails later comparison.
    return years.length > 0 ? years[0] : null; 
  } else {
    // Original logic for historical/current documents
    years = years.filter((year) => year >= 2020 && year <= currentYear); 
    years.sort((a, b) => b - a);
    return years.length > 0 ? years[0] : null
  }
}

// Helper function to check year consistency
function checkYearConsistency(): { isConsistent: boolean; message?: string; expectedYear?: number } {
  const balances = documents.filter((doc) => doc.documentType === "Balance" && doc.isValid)
  const dicoseDocuments = documents.filter((doc) => doc.documentType === "DICOSE" && doc.isValid)

  if (balances.length === 0 && dicoseDocuments.length === 0) {
    return { isConsistent: true }
  }

  const allYears = [
    ...balances.map((doc) => doc.documentYear),
    ...dicoseDocuments.map((doc) => doc.documentYear),
  ].filter((year) => year !== null && year !== undefined) as number[]

  if (allYears.length === 0) {
    return { isConsistent: true }
  }

  const uniqueYears = [...new Set(allYears)]

  if (uniqueYears.length > 1) {
    return {
      isConsistent: false,
      message: `Se detectó una discrepancia de años. Se encontraron documentos para los años: ${uniqueYears.join(", ")}. Todos los balances y DICOSE deben ser del mismo año.`,
      expectedYear: uniqueYears[0],
    }
  }

  return { isConsistent: true, expectedYear: uniqueYears[0] }
}

// New helper function to classify Informe Profesional using AI
async function getInformeProfesionalTypeFromAI(content: string, maximoEndeudamiento: number | null): Promise<string> {
  if (process.env.OPENAI_API_KEY === undefined) {
    console.error("OpenAI API key not found. Skipping AI classification.");
    return "Indeterminado_ErrorAPIKey"; // Fallback or error indicator
  }
  if (content.trim() === "") {
    return "Indeterminado_NoContent";
  }

  let requiredLevelDescription = "";
  if (maximoEndeudamiento === null) {
    requiredLevelDescription = "Máximo Endeudamiento no establecido. No se puede determinar el nivel de informe requerido."
  } else if (maximoEndeudamiento < 900000) {
    requiredLevelDescription = "Con endeudamiento < 900.000 UYU, se requiere un Informe de Compilación o superior.";
  } else if (maximoEndeudamiento < 2400000) {
    requiredLevelDescription = "Con endeudamiento entre 900.000 y 2.399.999 UYU, se requiere un Informe de Revisión Limitada o superior.";
  } else {
    requiredLevelDescription = "Con endeudamiento >= 2.400.000 UYU, se requiere un Informe de Auditoría.";
  }

  const prompt = `
    Eres un experto analista financiero. Basado en el siguiente texto de un informe de contador y la siguiente información sobre el endeudamiento, determina si el informe funciona principalmente como un 'Informe de Compilación', 'Informe de Revisión Limitada', o 'Informe de Auditoría'.
    
    Información sobre el nivel de informe requerido según endeudamiento (para tu contexto, no para que elijas basado en esto directamente, sino para entender la sensibilidad):
    ${requiredLevelDescription}

    Texto del Informe:
    """
    ${content.substring(0, 3800)} 
    """

    Responde únicamente con una de las siguientes palabras exactas: Compilación, Revisión, Auditoría, o Indeterminado si no puedes clasificarlo claramente a partir del texto proporcionado.
  `;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo", // Or another model like gpt-4 if preferred
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2, // Lower temperature for more deterministic classification
      max_tokens: 20,
    });

    const result = completion.choices[0]?.message?.content?.trim() || "Indeterminado";
    console.log("[AI Informe Prof. Classification] Raw response:", result);
    if (["Compilación", "Revisión", "Auditoría"].includes(result)) {
      return result;
    }
    return "Indeterminado_AIResponse";
  } catch (error) {
    console.error("Error calling OpenAI API:", error);
    return "Indeterminado_APIError";
  }
}

// NEW AI HELPER FUNCTION FOR BALANCE SHEETS
async function checkBalanceEquationAI(content: string): Promise<{ equationHolds: boolean | "unknown"; activos?: string; pasivos?: string; patrimonio?: string; diferencia?: string; reason?: string }> {
  if (process.env.OPENAI_API_KEY === undefined) {
    console.error("OpenAI API key not found. Skipping AI balance check.");
    return { equationHolds: "unknown", reason: "OpenAI API key not configured." };
  }
  if (content.trim() === "") {
    return { equationHolds: "unknown", reason: "Document content is empty." };
  }

  // Truncate content to avoid exceeding token limits, focusing on the most relevant part
  const relevantContent = content.substring(0, 3800);

  const prompt = `
    Eres un experto contador. Analiza el siguiente texto de un balance financiero.
    1. Extrae los valores monetarios totales para "Activos", "Pasivos" y "Patrimonio Neto". Reporta estos valores tal como los encuentras.
    2. Calcula la diferencia exacta: Valor_Activos - (Valor_Pasivos + Valor_Patrimonio_Neto).
    3. Reporta esta diferencia calculada.

    Texto del Balance:
    """
    ${relevantContent}
    """

    Responde en formato JSON con los siguientes campos:
    - "activos_valor_detectado": (string con el valor numérico de los activos, ej: "150000.75", o "no_detectado")
    - "pasivos_valor_detectado": (string con el valor numérico de los pasivos, ej: "50000.25", o "no_detectado")
    - "patrimonio_valor_detectado": (string con el valor numérico del patrimonio neto, ej: "100000.50", o "no_detectado")
    - "diferencia_calculada": (ESTRICTAMENTE el resultado numérico de Activos - (Pasivos + Patrimonio). Ej: "0.00", "10000.00", "-100.00". Si no se pueden calcular todos los valores, responde "no_calculable".)
    - "explicacion_ia": (string breve explicando cómo llegaste a la diferencia, mostrando los valores usados en el cálculo. Por ejemplo: "Calculado como 200.00 - (100.00 + 200.00) = -100.00")

    Ejemplo de respuesta donde Activos = Pasivos + Patrimonio:
    {
      "activos_valor_detectado": "150000.00",
      "pasivos_valor_detectado": "50000.00",
      "patrimonio_valor_detectado": "100000.00",
      "diferencia_calculada": "0.00",
      "explicacion_ia": "Calculado como 150000.00 - (50000.00 + 100000.00) = 0.00"
    }

    Ejemplo de respuesta donde Activos != Pasivos + Patrimonio:
    {
      "activos_valor_detectado": "200.00",
      "pasivos_valor_detectado": "50.00",
      "patrimonio_valor_detectado": "100.00",
      "diferencia_calculada": "50.00",
      "explicacion_ia": "Calculado como 200.00 - (50.00 + 100.00) = 50.00"
    }
    
    Ejemplo de respuesta si faltan datos:
    {
      "activos_valor_detectado": "150000.00",
      "pasivos_valor_detectado": "no_detectado",
      "patrimonio_valor_detectado": "100000.00",
      "diferencia_calculada": "no_calculable",
      "explicacion_ia": "No se pudo detectar el valor de Pasivos para calcular la diferencia."
    }

    Asegúrate que los valores numéricos en el JSON sean strings y usen '.' como separador decimal, sin separadores de miles.
  `;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.0, // Set temperature to 0 for max determinism in calculation
      max_tokens: 300, 
      response_format: { type: "json_object" },
    });

    const rawResponse = completion.choices[0]?.message?.content;
    console.log("[AI Balance Check] Raw response:", rawResponse);

    if (!rawResponse) {
      return { equationHolds: "unknown", reason: "AI returned an empty response." };
    }

    let parsedResponse;
    try {
      parsedResponse = JSON.parse(rawResponse);
    } catch (jsonError) {
      console.error("[AI Balance Check] Error parsing JSON response:", jsonError, "Raw response:", rawResponse);
      return { equationHolds: "unknown", reason: "AI returned an invalid JSON response. " + rawResponse };
    }
    
    const {
        activos_valor_detectado,
        pasivos_valor_detectado,
        patrimonio_valor_detectado,
        diferencia_calculada, // Changed from 'diferencia'
        explicacion_ia // Changed from 'explicacion'
    } = parsedResponse;

    const activoNum = parseFloat(activos_valor_detectado);
    const pasivoNum = parseFloat(pasivos_valor_detectado);
    const patrimonioNum = parseFloat(patrimonio_valor_detectado);
    const diferenciaNum = parseFloat(diferencia_calculada);

    let calculatedEquationHolds: boolean | "unknown" = "unknown";

    if (!isNaN(activoNum) && !isNaN(pasivoNum) && !isNaN(patrimonioNum)) {
      if (diferencia_calculada === "no_calculable" || diferencia_calculada === undefined) {
        calculatedEquationHolds = "unknown";
      } else if (!isNaN(diferenciaNum) && Math.abs(diferenciaNum) < 0.01) { 
        calculatedEquationHolds = true;
      } else if (!isNaN(diferenciaNum)) {
        calculatedEquationHolds = false;
      } else {
        calculatedEquationHolds = "unknown"; 
      }
    } else {
      calculatedEquationHolds = "unknown";
    }

    return { 
        equationHolds: calculatedEquationHolds, 
        activos: activos_valor_detectado,
        pasivos: pasivos_valor_detectado,
        patrimonio: patrimonio_valor_detectado,
        diferencia: diferencia_calculada,
        reason: explicacion_ia || (calculatedEquationHolds === true ? "La ecuación se cumple." : calculatedEquationHolds === false ? "La ecuación NO se cumple." : "No se pudo determinar.")
    };

  } catch (error: any) {
    console.error("Error calling OpenAI API for balance check:", error);
    let reason = "Error connecting to OpenAI API for balance check.";
    if (error.response && error.response.data && error.response.data.error && error.response.data.error.message) {
        reason = error.response.data.error.message;
    } else if (error.message) {
        reason = error.message;
    }
    return { equationHolds: "unknown", reason };
  }
}

// NEW AI HELPER FUNCTION FOR DETA OPINIONS
async function getDETAOpinionsFromAI(content: string): Promise<{ cashflowOpinionPresent: boolean | "unknown"; creditOpinionPresent: boolean | "unknown"; explanation?: string }> {
  if (process.env.OPENAI_API_KEY === undefined) {
    console.error("OpenAI API key not found. Skipping AI DETA check.");
    return { cashflowOpinionPresent: "unknown", creditOpinionPresent: "unknown", explanation: "OpenAI API key not configured." };
  }
  if (content.trim() === "") {
    return { cashflowOpinionPresent: "unknown", creditOpinionPresent: "unknown", explanation: "Document content is empty for DETA check." };
  }

  const relevantContent = content.substring(0, 3800);

  const prompt = `
    Eres un analista de crédito senior.
    Analiza el siguiente texto de un documento DETA (Declaración Técnica del Agrónomo).
    Debes determinar si el documento contiene:
    1. Una opinión o evaluación explícita sobre el flujo de caja proyectado (cashflow) del solicitante.
    2. Una opinión general o conclusión explícita sobre la solicitud de crédito en su totalidad (si es favorable, desfavorable, recomendable, etc.).

    Texto del Documento DETA:
    """
    ${relevantContent}
    """

    Responde en formato JSON con los siguientes campos booleanos o la string "indeterminado":
    - "opinion_flujo_caja_presente": (true si se encuentra una opinión sobre el flujo de caja, false si no, "indeterminado" si no estás seguro)
    - "opinion_credito_general_presente": (true si se encuentra una opinión general sobre el crédito, false si no, "indeterminado" si no estás seguro)
    - "explicacion_ia": (string breve explicando tu razonamiento o por qué es indeterminado, citando partes relevantes del texto si es posible)

    Ejemplo de respuesta si ambas opiniones están presentes:
    {
      "opinion_flujo_caja_presente": true,
      "opinion_credito_general_presente": true,
      "explicacion_ia": "El documento menciona 'El flujo de fondos proyectado es razonable' y 'Opinamos de forma favorable a la solicitud.'"
    }

    Ejemplo de respuesta si solo una está presente:
    {
      "opinion_flujo_caja_presente": true,
      "opinion_credito_general_presente": false,
      "explicacion_ia": "Se encontró una opinión sobre el flujo de caja ('evaluación del cashflow indica viabilidad'), pero no una conclusión general sobre el crédito."
    }

    Ejemplo de respuesta si ninguna está clara o el texto es ambiguo:
    {
      "opinion_flujo_caja_presente": "indeterminado",
      "opinion_credito_general_presente": "indeterminado",
      "explicacion_ia": "El texto es muy breve y no detalla opiniones claras sobre el flujo de caja ni sobre la solicitud de crédito en general."
    }
  `;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1, 
      max_tokens: 300,
      response_format: { type: "json_object" },
    });

    const rawResponse = completion.choices[0]?.message?.content;
    console.log("[AI DETA Check] Raw response:", rawResponse);

    if (!rawResponse) {
      return { cashflowOpinionPresent: "unknown", creditOpinionPresent: "unknown", explanation: "AI returned an empty response for DETA check." };
    }

    let parsedResponse;
    try {
      parsedResponse = JSON.parse(rawResponse);
    } catch (jsonError) {
      console.error("[AI DETA Check] Error parsing JSON response:", jsonError, "Raw response:", rawResponse);
      return { cashflowOpinionPresent: "unknown", creditOpinionPresent: "unknown", explanation: "AI returned an invalid JSON response for DETA. " + rawResponse };
    }
    
    const { 
        opinion_flujo_caja_presente,
        opinion_credito_general_presente,
        explicacion_ia 
    } = parsedResponse;

    // Normalize potential string "indeterminado" to our "unknown" state
    const mapToTriState = (value: boolean | string | undefined): boolean | "unknown" => {
        if (typeof value === 'boolean') return value;
        if (value === "indeterminado") return "unknown";
        return "unknown"; // Default for undefined or unexpected strings
    };

    return {
      cashflowOpinionPresent: mapToTriState(opinion_flujo_caja_presente),
      creditOpinionPresent: mapToTriState(opinion_credito_general_presente),
      explanation: explicacion_ia || "No se proporcionó explicación detallada por la IA."
    };

  } catch (error: any) {
    console.error("Error calling OpenAI API for DETA check:", error);
    return { cashflowOpinionPresent: "unknown", creditOpinionPresent: "unknown", explanation: `Error connecting to OpenAI API for DETA check: ${error.message}` };
  }
}

// AI Helper function to analyze Flujo de Fondos projection coverage
async function getFlujoDeFondosProjectionCoverageAI(content: string): Promise<{
  anioFinalProyeccion?: number;
  duracionProyeccionAnios?: number;
  confianza?: "alta" | "media" | "baja" | "ninguna";
  explicacionIA?: string;
}> {
  if (process.env.OPENAI_API_KEY === undefined) {
    console.error("OpenAI API key not found. Skipping AI Flujo de Fondos coverage check.");
    return { confianza: "ninguna", explicacionIA: "OpenAI API key no configurada." };
  }
  if (content.trim() === "") {
    return { confianza: "ninguna", explicacionIA: "Contenido del documento vacío." };
  }

  const relevantContent = content.substring(0, 3800); // Limit content length
  const currentYear = new Date().getFullYear();

  const prompt = `
    Eres un analista financiero experto. Analiza el siguiente texto de un Estado de Flujo de Fondos proyectado.
    Tu tarea es determinar el alcance temporal de la proyección.

    Texto del Flujo de Fondos:
    """
    ${relevantContent}
    """

    Por favor, responde en formato JSON con los siguientes campos:
    - "anio_final_proyeccion_explicito": (number | null) El último año NUMÉRICO que se menciona explícitamente como parte del período de proyección (ej: si dice "proyectado hasta 2027", el valor es 2027). Si no se menciona un año final explícito, responde null.
    - "duracion_total_proyeccion_anios_explicita": (number | null) El número total de años que la proyección declara explícitamente cubrir (ej: si dice "proyección a 5 años" o "para los próximos tres años", el valor es 5 o 3 respectivamente). Si no se menciona una duración explícita, responde null.
    - "confianza_determinacion": (string) Tu nivel de confianza en esta determinación. Debe ser una de: "alta", "media", "baja", "ninguna".
    - "explicacion_detalle": (string) Una breve explicación de cómo llegaste a tu conclusión, citando partes relevantes del texto si es posible, o por qué no pudiste determinarlo.

    Consideraciones:
    - Prioriza un "anio_final_proyeccion_explicito" si está claramente indicado.
    - Si solo se da una duración (ej: "proyección a 3 años"), y no un año final, usa "duracion_total_proyeccion_anios_explicita".
    - Si el texto es ambiguo o no contiene información clara sobre el período de proyección, indica confianza "baja" o "ninguna".
    - El año actual para referencia es ${currentYear}.

    Ejemplo de respuesta si el texto dice "Flujo de fondos proyectado para los años 2024, 2025 y 2026":
    {
      "anio_final_proyeccion_explicito": 2026,
      "duracion_total_proyeccion_anios_explicita": null, 
      "confianza_determinacion": "alta",
      "explicacion_detalle": "El texto menciona explícitamente proyecciones para los años 2024, 2025 y 2026, siendo 2026 el último año."
    }

    Ejemplo si dice "Proyección a 3 años":
    {
      "anio_final_proyeccion_explicito": null,
      "duracion_total_proyeccion_anios_explicita": 3,
      "confianza_determinacion": "alta",
      "explicacion_detalle": "El texto indica 'Proyección a 3 años'."
    }
    
    Ejemplo si no está claro:
    {
      "anio_final_proyeccion_explicito": null,
      "duracion_total_proyeccion_anios_explicita": null,
      "confianza_determinacion": "baja",
      "explicacion_detalle": "El texto menciona flujos de efectivo pero no especifica un período de proyección claro o un año final."
    }
  `;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo", // Or a more advanced model if needed for accuracy
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1, // Low temperature for more factual extraction
      max_tokens: 250,
      response_format: { type: "json_object" },
    });

    const rawResponse = completion.choices[0]?.message?.content;
    console.log("[AI FlujoFondos Coverage Check] Raw response:", rawResponse);

    if (!rawResponse) {
      return { confianza: "ninguna", explicacionIA: "La IA retornó una respuesta vacía." };
    }

    let parsedResponse;
    try {
      parsedResponse = JSON.parse(rawResponse);
    } catch (jsonError) {
      console.error("[AI FlujoFondos Coverage Check] Error parsing JSON:", jsonError, "Raw:", rawResponse);
      return { confianza: "ninguna", explicacionIA: "La IA retornó un JSON inválido. " + rawResponse };
    }

    const { 
      anio_final_proyeccion_explicito,
      duracion_total_proyeccion_anios_explicita,
      confianza_determinacion,
      explicacion_detalle
    } = parsedResponse;

    return {
      anioFinalProyeccion: typeof anio_final_proyeccion_explicito === 'number' ? anio_final_proyeccion_explicito : undefined,
      duracionProyeccionAnios: typeof duracion_total_proyeccion_anios_explicita === 'number' ? duracion_total_proyeccion_anios_explicita : undefined,
      confianza: ["alta", "media", "baja", "ninguna"].includes(confianza_determinacion) ? confianza_determinacion : "baja",
      explicacionIA: explicacion_detalle || "No se proporcionó explicación."
    };

  } catch (error: any) {
    console.error("Error llamando a OpenAI para FlujoFondos coverage check:", error);
    return { confianza: "ninguna", explicacionIA: `Error conectando con OpenAI: ${error.message}` };
  }
}

export async function validateDocument(url: string, fileName: string, currentPlazoDeudaForValidation: number | null) {
  console.log(`[validateDocument] Called with: fileName='${fileName}', plazo='${currentPlazoDeudaForValidation}'`);
  try {
    // Fetch the document content with retry logic
    let response: Response | null = null;
    let attempts = 0;
    const maxAttempts = 3;
    const delayBetweenAttempts = 1000; // 1 second

    while (attempts < maxAttempts) {
      attempts++;
      try {
        console.log(`Attempt ${attempts} to fetch document from URL: ${url}`);
        response = await fetch(url);
        if (response.ok) {
          console.log(`Successfully fetched document on attempt ${attempts}`);
          break; // Success, exit loop
        }
        console.warn(`Attempt ${attempts} failed with status: ${response.status}.`);
      } catch (fetchError: any) {
        console.warn(`Attempt ${attempts} failed with error: ${fetchError.message}`);
        response = null; // Ensure response is null if fetch itself threw an error
      }

      if (attempts < maxAttempts) {
        console.log(`Waiting ${delayBetweenAttempts}ms before next attempt...`);
        await new Promise(resolve => setTimeout(resolve, delayBetweenAttempts));
      }
    }

    if (!response || !response.ok) {
      // If all attempts failed, or last attempt was not ok
      const statusMessage = response ? `status ${response.status}` : "no response object";
      throw new Error(`No se pudo obtener el documento para la validación después de ${maxAttempts} intentos (${statusMessage}). URL: ${url}`);
    }

    // Get file extension and content
    const fileExtension = fileName.split(".").pop()?.toLowerCase()

    // Simulate validation delay
    await new Promise((resolve) => setTimeout(resolve, 1500))

    let isValid = true
    let validationMessage = ""
    let documentType = "Desconocido"
    let documentYear: number | null = null

    // Check if file format is supported
    if (!["pdf", "doc", "docx", "txt", "xls", "xlsx"].includes(fileExtension || "")) {
      isValid = false
      validationMessage = "Formato de archivo no admitido. Cargue archivos PDF, DOC, DOCX, TXT, XLS o XLSX."

      const id = crypto.randomUUID()
      const document = {
        id,
        name: fileName,
        url,
        uploadedAt: new Date().toISOString(),
        isValid,
        validationMessage,
        documentType,
        companyType: selectedCompanyType === null ? undefined : selectedCompanyType,
        documentYear: documentYear === null ? undefined : documentYear,
      }
      documents.push(document)
      revalidatePath("/")

      return {
        success: true,
        isValid,
        message: validationMessage,
        document,
      }
    }

    // Get document content for analysis
    let content = ""
    if (fileExtension === "txt") {
      content = await response.text()
    } else {
      // For PDF/DOC files, we'll analyze the filename and simulate content analysis
      content = fileName.toLowerCase()
    }

    // Extract year from content - adapt for projections when type is known
    // Initial extraction, will be re-evaluated for Flujo de Fondos
    documentYear = extractYearFromContent(content, fileName, true)

    // Enhanced validation for financial documents and company-specific documents
    const flujoDeFondosKeywords = [
      "flujo de fondos",
      "cashflow",
      "cash flow",
      "cash-flow",
      "flujo de caja proyectado",
      "proyeccion de flujo",
      "actividades operativas",
      "actividades de inversion",
      "actividades de financiacion",
      "flujo de efectivo neto",
      "ingresos de efectivo",
      "pagos de efectivo",
      "posicion de efectivo",
      // English for broader matching if needed
      "projected cashflow",
      "cash projection",
      "operating activities",
      "investing activities",
      "financing activities",
      "net cash flow",
    ]

    const balanceKeywords = [
      "balance",
      "estado de situacion patrimonial",
      "estado de resultados", // Often part of the same submission
      "perdidas y ganancias",
      "p&g",
      "activos",
      "pasivos",
      "patrimonio neto",
      "ingresos",
      "gastos",
      "resultado neto",
      // English for broader matching
      "financial statement",
      "balance sheet",
      "income statement",
      "profit and loss",
      "statement of financial position",
      "assets",
      "liabilities",
      "equity",
      "revenue",
      "expenses",
      "net income",
    ]

    const informeProfesionalKeywords = [
      "informe profesional",
      "declaracion del contador",
      "dictamen del contador",
      "certificacion contable",
      "opinion profesional",
      "revision financiera",
      "informe de compilacion",
      "certificado por",
      "firma del contador",
      // English for broader matching
      "accountant declaration",
      "accountant statement",
      "cpa declaration",
      "certified public accountant",
      "auditor declaration",
      "professional opinion",
      "accountant certification",
    ]

    const informeCompilacionKeywords = [
      "informe de compilacion",
      "compilacion de estados financieros",
    ];
    const informeRevisionLimitadaKeywords = [
      "informe de revision limitada",
      "revision limitada de estados financieros",
    ];
    const informeAuditoriaKeywords = [
      "informe de auditoria",
      "auditoria de estados financieros",
      "dictamen de auditoria",
    ];

    // Agricultural company specific documents
    const dicoseKeywords = [
      "dicose",
      "registro dicose",
      "declaración dicose",
      "certificado dicose",
      "documento dicose",
      "dicose certificate",
      "agricultural registration",
    ]

    const detaKeywords = [
      "deta",
      "declaración deta",
      "registro deta",
      "certificado deta",
      "documento deta",
      "deta certificate",
      "agricultural declaration",
    ]

    // Check document type based on content and filename
    const contentLower = content.toLowerCase()
    const fileNameLower = fileName.toLowerCase()

    // Check for agricultural-specific documents first
    if (dicoseKeywords.some((keyword) => contentLower.includes(keyword)) || fileNameLower.includes("dicose")) {
      documentType = "DICOSE"

      if (selectedCompanyType !== "agricultural" && selectedCompanyType !== "new") {
        isValid = false
        validationMessage =
          "Los documentos DICOSE solo son requeridos para empresas agrícolas y nuevas. Seleccione el tipo de empresa correcto."
      } else {
        // Validate DICOSE document content and year
        if (!documentYear) {
          isValid = false
          validationMessage =
            "El documento DICOSE debe incluir un año específico. Asegúrese de que el documento indique claramente el año al que corresponde."
        } else if (fileExtension === "txt" && content.length < 50) {
          isValid = false
          validationMessage =
            "El documento DICOSE parece estar incompleto. Proporcione un documento de registro DICOSE completo."
        } else {
          // Check year consistency with existing documents
          const yearCheck = checkYearConsistency()
          if (!yearCheck.isConsistent) {
            isValid = false
            validationMessage = `El año del DICOSE (${documentYear}) no coincide con los balances existentes. ${yearCheck.message}`
          }
        }
      }
    } else if (detaKeywords.some((keyword) => contentLower.includes(keyword)) || fileNameLower.includes("deta")) {
      documentType = "DETA"

      if (selectedCompanyType !== "agricultural") {
        isValid = false
        validationMessage =
          "Los documentos DETA solo son requeridos para empresas agrícolas. Seleccione el tipo de empresa correcto."
      } else {
        // AI-based DETA check
        console.log("[DETA AI Check] Calling AI for DETA opinion check.");
        const aiDetaResult = await getDETAOpinionsFromAI(content);
        console.log("[DETA AI Check] AI Result:", aiDetaResult);

        const { cashflowOpinionPresent, creditOpinionPresent, explanation } = aiDetaResult;

        if (cashflowOpinionPresent === true && creditOpinionPresent === true) {
          // Both opinions are present, DETA is valid from AI perspective
          validationMessage = `Revisión IA: Ambas opiniones (flujo de caja y crédito general) detectadas. ${explanation || ""}`;
        } else if (cashflowOpinionPresent === false && creditOpinionPresent === false) {
          isValid = false;
          validationMessage = `Revisión IA: Faltan tanto la opinión sobre el flujo de caja como la opinión general sobre el crédito. ${explanation || ""}`;
        } else if (cashflowOpinionPresent === false) {
          isValid = false;
          validationMessage = `Revisión IA: Falta la opinión sobre el flujo de caja proyectado. ${explanation || ""}`;
        } else if (creditOpinionPresent === false) {
          isValid = false;
          validationMessage = `Revisión IA: Falta la opinión general sobre la solicitud de crédito. ${explanation || ""}`;
        } else { // One or both are "unknown"
          isValid = false;
          validationMessage = `Advertencia IA para DETA: No se pudo determinar con certeza la presencia de una o ambas opiniones (Flujo de caja: ${String(cashflowOpinionPresent)}, Crédito general: ${String(creditOpinionPresent)}). ${explanation || "Verifique el contenido."}`;
          // Consider if isValid should be false here for stricter validation
        }
        
        // Basic length check can still be useful as a fallback or supplement
        if (isValid && fileExtension === "txt" && content.length < 50) { // Reduced length slightly from 100
          isValid = false;
          validationMessage += " ADEMÁS, el documento DETA parece demasiado corto.";
        }
      }
    } else if (flujoDeFondosKeywords.some((keyword) => contentLower.includes(keyword) || fileNameLower.includes("flujo de fondos"))) {
      documentType = "Flujo de Fondos"
      // Re-extract year specifically for projections if it's a Flujo de Fondos
      documentYear = extractYearFromContent(content, fileName, true)

      // Specific validation for cashflow documents
      const requiredCashflowElements = ["operativas", "inversion", "financiacion", "efectivo"]
      const missingElements = requiredCashflowElements.filter((element) => !contentLower.includes(element))

      if (missingElements.length > 2) {
        isValid = false
        validationMessage = `El documento de Flujo de Fondos omite elementos clave: ${missingElements.join(", ")}. Asegúrese de que el documento incluya actividades operativas, de inversión y financiamiento.`
      } else if (fileExtension === "txt" && content.length < 100) {
        isValid = false
        validationMessage = "El documento de Flujo de Fondos parece estar incompleto. Proporcione un estado de flujo de fondos proyectado detallado."
      }

      // New AI-driven Validation: Check if Flujo de Fondos covers the currentPlazoDeudaForValidation
      if (isValid && currentPlazoDeudaForValidation !== null && currentPlazoDeudaForValidation > 0) {
        console.log(`[validateDocument] Flujo de Fondos - AI Plazo check initiated. currentPlazo=${currentPlazoDeudaForValidation}`);
        const aiCoverageResult = await getFlujoDeFondosProjectionCoverageAI(content);
        console.log("[validateDocument] Flujo de Fondos - AI Coverage Result:", aiCoverageResult);

        let anioCoberturaSegunIA: number | undefined = undefined;
        if (aiCoverageResult.anioFinalProyeccion) {
          anioCoberturaSegunIA = aiCoverageResult.anioFinalProyeccion;
        } else if (aiCoverageResult.duracionProyeccionAnios) {
          anioCoberturaSegunIA = new Date().getFullYear() + aiCoverageResult.duracionProyeccionAnios;
        }

        if (!anioCoberturaSegunIA || !aiCoverageResult.confianza || ["baja", "ninguna"].includes(aiCoverageResult.confianza)) {
          isValid = false;
          validationMessage = (validationMessage ? validationMessage + " ADEMÁS, " : "") +
            `IA no pudo determinar con certeza el período de cobertura del Flujo de Fondos. (Confianza: ${aiCoverageResult.confianza || 'ninguna'}). ${aiCoverageResult.explicacionIA || ''}`;
        } else {
          const currentSystemYear = new Date().getFullYear(); // Or an effective start year if AI determines one
          const requiredCoverageYear = currentSystemYear + currentPlazoDeudaForValidation;
          if (anioCoberturaSegunIA < requiredCoverageYear) {
            isValid = false;
            validationMessage = (validationMessage ? validationMessage + " ADEMÁS, " : "") +
              `El Flujo de Fondos (cobertura según IA: ${anioCoberturaSegunIA}) no cubre el plazo de la deuda requerido (hasta ${requiredCoverageYear} para ${currentPlazoDeudaForValidation} años). ${aiCoverageResult.explicacionIA || ''}`;
          } else {
            validationMessage = (validationMessage ? validationMessage + " ADEMÁS, " : "") + 
            `Revisión IA: El Flujo de Fondos parece cubrir el plazo de la deuda (Cobertura IA hasta ${anioCoberturaSegunIA}, Plazo deuda ${currentPlazoDeudaForValidation} años). ${aiCoverageResult.explicacionIA || ''}`;
          }
        }
      } else if (isValid && (currentPlazoDeudaForValidation === null || currentPlazoDeudaForValidation <= 0)){
         // If plazo is not set, mention that this specific check was skipped.
         validationMessage = (validationMessage ? validationMessage + " ADEMÁS, " : "") + "Revisión de cobertura de plazo de deuda no aplica (plazo no establecido)."
      }
    } else if (balanceKeywords.some((keyword) => contentLower.includes(keyword) || fileNameLower.includes("balance") || fileNameLower.includes("financial statement"))) {
      documentType = "Balance"
      // For Balance, use non-projection year extraction
      documentYear = extractYearFromContent(content, fileName, false) 

      // Standard keyword-based structural checks (kept as a first pass)
      const requiredFinancialElements = ["activos", "pasivos", "ingresos", "patrimonio"]
      const missingElements = requiredFinancialElements.filter((element) => !contentLower.includes(element))

      if (missingElements.length > 2) {
        isValid = false
        validationMessage = `El Balance omite elementos clave: ${missingElements.join(", ")}. Asegúrese de que el documento incluya activos, pasivos, ingresos y gastos.`
      } else if (fileExtension === "txt" && content.length < 10) { // Very basic length check
        isValid = false
        validationMessage = "El Balance parece estar incompleto. Proporcione un balance general completo."
      } else {
        // If basic checks pass, proceed to AI validation for the equation
        console.log("[Balance AI Check] Calling AI for balance equation check.");
        const aiBalanceCheckResult = await checkBalanceEquationAI(content);
        console.log("[Balance AI Check] AI Result:", aiBalanceCheckResult);

        const { 
            equationHolds,
            activos: aiActivos,
            pasivos: aiPasivos,
            patrimonio: aiPatrimonio,
            diferencia: aiDiferencia,
            reason: aiReason 
        } = aiBalanceCheckResult;

        const activoNum = parseFloat(aiActivos || "");
        const pasivoNum = parseFloat(aiPasivos || "");
        const patrimonioNum = parseFloat(aiPatrimonio || "");

        if (equationHolds === false) {
          isValid = false;
          validationMessage = `Revisión IA: La ecuación Activos = Pasivos + Patrimonio Neto NO se cumple. Motivo: ${aiReason || 'No se proporcionó un motivo específico.'}`;
          if (aiActivos && aiPasivos && aiPatrimonio) {
            validationMessage += ` Valores IA: A=${aiActivos}, P=${aiPasivos}, PN=${aiPatrimonio}, Dif=${aiDiferencia || 'N/A'}`;
          }
        } else if (equationHolds === "unknown") {
          validationMessage = `Advertencia IA: No se pudo verificar la ecuación A=P+PN. Motivo: ${aiReason || 'La IA no pudo determinarlo.'}`;
          if (aiActivos && aiPasivos && aiPatrimonio) {
            validationMessage += ` Valores IA: A=${aiActivos}, P=${aiPasivos}, PN=${aiPatrimonio}, Dif=${aiDiferencia || 'N/A'}`;
          }
        } else if (equationHolds === true) {
          // Even if AI says true, let's double check the numbers it provided for sanity if all are present
          if (!isNaN(activoNum) && !isNaN(pasivoNum) && !isNaN(patrimonioNum)) {
            const ourCalculatedDifference = activoNum - (pasivoNum + patrimonioNum);
            if (Math.abs(ourCalculatedDifference) >= 0.01) {
              // AI reported equationHolds=true (likely due to faulty "diferencia_calculada" from AI), but its own numbers don't add up!
              isValid = false; // Override AI's potentially wrong conclusion
              // Refined message to be more direct as per user feedback
              validationMessage = `Revisión IA: La ecuación Activos = Pasivos + Patrimonio Neto NO SE CUMPLE. 
Valores extraídos por IA: Activos=${aiActivos}, Pasivos=${aiPasivos}, Patrimonio Neto=${aiPatrimonio}. 
Nuestra diferencia calculada: ${ourCalculatedDifference.toFixed(2)}. (La IA pudo haber informado una diferencia incorrecta de ${aiDiferencia}).`;
            } else {
              validationMessage = `Revisión IA: La ecuación Activos = Pasivos + Patrimonio Neto SE CUMPLE. ${aiReason || ''}`;
              if (aiActivos && aiPasivos && aiPatrimonio) {
                validationMessage += ` Valores IA: A=${aiActivos}, P=${aiPasivos}, PN=${aiPatrimonio}, Dif=${aiDiferencia || 'N/A'}`;
              }
            }
          } else {
            // AI says true, but didn't provide all numbers, so we just take its word with a note
            validationMessage = `Revisión IA: La ecuación Activos = Pasivos + Patrimonio Neto SE CUMPLE (según IA, datos numéricos incompletos para re-verificación). ${aiReason || ''}`;
          }
        }

        // Year consistency checks (still relevant)
        if (documentYear && (selectedCompanyType === "agricultural" || selectedCompanyType === "new")) {
          const yearCheck = checkYearConsistency()
          if (!yearCheck.isConsistent) {
            isValid = false // This can override the AI's positive check if years don't match
            validationMessage += ` ADEMÁS, el año del Balance (${documentYear}) no coincide con los documentos DICOSE existentes. ${yearCheck.message}`
          }
        }

        // New company specific checks (still relevant)
        if (selectedCompanyType === "new") {
          const existingFinancialStatements = documents.filter(
            (doc) => doc.documentType === "Balance" && doc.isValid,
          ).length

          if (existingFinancialStatements >= 3 && isValid) { // Only count if this one is also valid so far
            // This check might be redundant if new uploads are blocked elsewhere, but good for robustness
            // Or, we could set isValid = false here if it *would* exceed 3 valid balances.
          }
        }
      }
    } else if (informeProfesionalKeywords.some((keyword) => contentLower.includes(keyword) || fileNameLower.includes("informe profesional") || fileNameLower.includes("accountant declaration"))) {
      documentType = "Informe Profesional"
      console.log(`[Validate Informe Profesional] Server-side Maximo Endeudamiento: ${maximoEndeudamiento}`);
      
      // AI-based classification
      const aiDeterminedType = await getInformeProfesionalTypeFromAI(content, maximoEndeudamiento);
      console.log(`[AI Informe Prof. Classification] Determined type: ${aiDeterminedType}`);

      if (aiDeterminedType.startsWith("Indeterminado")) {
        isValid = false;
        validationMessage = `El tipo de Informe Profesional no pudo ser determinado por la IA (${aiDeterminedType}). Verifique el contenido.`;
      } else {
        if (maximoEndeudamiento === null) {
          isValid = false;
          validationMessage = "Por favor, establezca el 'Máximo Endeudamiento' para validar el Informe Profesional.";
        } else if (maximoEndeudamiento < 900000) { // Compilación or higher required
          if (!["Compilación", "Revisión", "Auditoría"].includes(aiDeterminedType)) {
            isValid = false;
            validationMessage = `IA determinó '${aiDeterminedType}'. Con endeudamiento <900.000 UYU, se requiere Compilación, Revisión o Auditoría.`;
          }
        } else if (maximoEndeudamiento < 2400000) { // Revisión Limitada or higher required
          if (!["Revisión", "Auditoría"].includes(aiDeterminedType)) {
            isValid = false;
            validationMessage = `IA determinó '${aiDeterminedType}'. Con endeudamiento 900.000-2.399.999 UYU, se requiere Revisión o Auditoría.`;
          }
        } else { // Auditoría required (>= 2.400.000 UYU)
          if (aiDeterminedType !== "Auditoría") {
            isValid = false;
            validationMessage = `IA determinó '${aiDeterminedType}'. Con endeudamiento >=2.400.000 UYU, se requiere Auditoría.`;
          }
        }
      }

      // Keep the basic structural/length check if AI validation passes or if AI fails and we want a fallback
      if (isValid && !aiDeterminedType.startsWith("Indeterminado")) { 
        const requiredDeclarationElements = ["certificado", "declaracion", "contador"];
        const missingElements = requiredDeclarationElements.filter((element) => !contentLower.includes(element));
        if (missingElements.length > 1) {
          isValid = false;
          validationMessage = `El Informe Profesional (tipo IA: ${aiDeterminedType}) omite elementos generales requeridos: ${missingElements.join(", ")}.`;
        }
        // Removed length check for .txt as AI is primary content validator now for type
        // else if (fileExtension === "txt" && content.length < 50) { 
        //   isValid = false;
        //   validationMessage = "El Informe Profesional parece estar incompleto (contenido general).";
        // }
      }
    } else {
      // Document doesn't match any required type
      isValid = false
      let requiredDocs = ""

      switch (selectedCompanyType) {
        case "agricultural":
          requiredDocs = "Flujo de Fondos, Balance, Informe Profesional, DICOSE, o DETA"
          break
        case "new":
          requiredDocs = "Balance (hasta 3), Informe Profesional, o DICOSE"
          break
        default:
          requiredDocs = "Flujo de Fondos, Balance, o Informe Profesional"
      }

      validationMessage = `Tipo de documento no reconocido. Cargue uno de los siguientes: ${requiredDocs}. Asegúrese de que el título y el contenido del documento indiquen claramente el tipo de documento.`
    }

    // Additional file format specific checks
    if (isValid && fileExtension === "pdf") {
      // Simulate PDF structure validation
      const pdfValidation = Math.random() > 0.1 // 90% success rate for valid documents
      if (!pdfValidation) {
        isValid = false
        validationMessage = `El archivo PDF de ${documentType} parece estar corrupto o con formato incorrecto.`
      }
    }

    // Store the document in our "database"
    const id = crypto.randomUUID()
    const newDocument = {
      id,
      name: fileName,
      url,
      uploadedAt: new Date().toISOString(),
      isValid,
      validationMessage: isValid ? undefined : validationMessage,
      documentType,
      companyType: selectedCompanyType === null ? undefined : selectedCompanyType,
      documentYear: documentYear === null ? undefined : documentYear,
    }

    // Logic for adding or replacing documents in the main list
    // Key for identifying a unique document slot (e.g. "Balance" for "regular" company)
    // For DICOSE/Balance, year is also part of the key if company type is agricultural or new
    let uniqueDocumentKey = `${newDocument.documentType}-${newDocument.companyType}`;
    if ((newDocument.documentType === "Balance" || newDocument.documentType === "DICOSE") && 
        (newDocument.companyType === "agricultural" || newDocument.companyType === "new") && 
        newDocument.documentYear) {
      uniqueDocumentKey += `-${newDocument.documentYear}`;
    }

    const existingDocumentIndex = documents.findIndex(doc => {
      let key = `${doc.documentType}-${doc.companyType}`;
      if ((doc.documentType === "Balance" || doc.documentType === "DICOSE") && 
          (doc.companyType === "agricultural" || doc.companyType === "new") && 
          doc.documentYear) {
        key += `-${doc.documentYear}`;
      }
      return key === uniqueDocumentKey;
    });

    if (existingDocumentIndex !== -1) {
      // A document of this type/year already exists
      if (newDocument.isValid) {
        console.log(`Replacing existing document for key ${uniqueDocumentKey} with a new valid one.`);
        documents[existingDocumentIndex] = newDocument;
      } else if (!documents[existingDocumentIndex].isValid) {
        // If new one is invalid AND old one was also invalid, update to show latest error
        console.log(`Replacing existing invalid document for key ${uniqueDocumentKey} with a new invalid one (latest error).`);
        documents[existingDocumentIndex] = newDocument;
      } else {
        // New one is invalid, but existing one is valid. Do nothing to the main list.
        console.log(`New document for key ${uniqueDocumentKey} is invalid, existing one is valid. Not updating main list.`);
      }
    } else {
      // No document of this type/year exists yet
      if (newDocument.isValid) {
        console.log(`Adding new valid document for key ${uniqueDocumentKey}.`);
        documents.push(newDocument);
      } else {
        // New document is invalid and no prior one exists. Do not add to main list.
        console.log(`New document for key ${uniqueDocumentKey} is invalid. Not adding to main list.`);
      }
    }
    
    // Revalidate the documents list for the client to refetch
    revalidatePath("/")

    return {
      success: true,
      isValid: newDocument.isValid, // Return the validity of the processed document
      message: newDocument.validationMessage,
      document: newDocument, // Return the processed document object itself for immediate feedback potential
    }
  } catch (error) {
    console.error("Error de validación:", error)
    return {
      success: false,
      isValid: false,
      message: error instanceof Error ? error.message : "Ocurrió un error desconocido durante la validación",
    }
  }
}

export async function getDocuments() {
  // In a real application, you would fetch from a database
  return [...documents].sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
}

export async function deleteDocument(id: string) {
  const document = documents.find((doc) => doc.id === id)

  if (document) {
    try {
      // Extract the blob pathname from the URL
      const url = new URL(document.url)
      const pathname = url.pathname.substring(1) // Remove leading slash

      // Delete from Vercel Blob
      await del(pathname)

      // Remove from our "database"
      documents = documents.filter((doc) => doc.id !== id)

      // Revalidate the documents list
      revalidatePath("/")

      return { success: true }
    } catch (error) {
      console.error("Delete error:", error)
      throw new Error("Failed to delete document")
    }
  } else {
    throw new Error("Document not found")
  }
}

export async function listGoogleDriveFolders(parentFolderId?: string) {
  const session = await getServerSession(authOptions);

  if (!session || !session.accessToken) {
    console.error("No session or access token found for Google Drive access.");
    return { error: "Authentication required. Please sign in." };
  }

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: session.accessToken });

  const drive = google.drive({ version: "v3", auth: oauth2Client });

  try {
    console.log(`Listing Drive folders. Parent ID: ${parentFolderId || 'root'}`);
    const res = await drive.files.list({
      q: `mimeType='application/vnd.google-apps.folder' and ${parentFolderId ? `'${parentFolderId}' in parents` : "'root' in parents"} and trashed=false`,
      fields: "files(id, name, webViewLink)",
      spaces: "drive",
      orderBy: "name",
    });

    const folders = res.data.files || [];
    console.log("Fetched folders:", folders.map(f => f.name));
    return { folders };

  } catch (error: any) {
    console.error("Error listing Google Drive folders:", error.message);
    const errorMessage = error.message?.toLowerCase() || "";
    let errorResponseData = null;
    if (typeof error.response?.data?.error === 'string') {
      errorResponseData = error.response.data.error.toLowerCase();
    }
    if (errorResponseData === "invalid_grant" || errorMessage.includes("token") || errorMessage.includes("invalid credentials") || errorMessage.includes("expired")) {
        return { error: "Error de autenticación con Google Drive. Por favor, intente salir y volver a ingresar.", needsReAuth: true };
    }
    return { error: `Failed to list Google Drive folders: ${error.message}` };
  }
}

export async function listFilesInFolder(folderId: string) {
  const session = await getServerSession(authOptions);
  if (!session || !session.accessToken) {
    return { error: "Authentication required." };
  }
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: session.accessToken });
  const drive = google.drive({ version: "v3", auth: oauth2Client });

  try {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and mimeType!='application/vnd.google-apps.folder' and trashed=false`,
      fields: "files(id, name, webViewLink, mimeType, webContentLink, size, createdTime, modifiedTime)", // webContentLink for direct download
      spaces: "drive",
      orderBy: "name",
    });
    return { files: res.data.files || [] };
  } catch (error: any) {
    console.error("Error listing files in folder:", error.message);
    const errorMessage = error.message?.toLowerCase() || "";
    let errorResponseData = null;
    if (typeof error.response?.data?.error === 'string') {
      errorResponseData = error.response.data.error.toLowerCase();
    }
    if (errorResponseData === "invalid_grant" || errorMessage.includes("token") || errorMessage.includes("invalid credentials") || errorMessage.includes("expired")) {
        return { error: "Error de autenticación con Google Drive. Por favor, intente salir y volver a ingresar.", needsReAuth: true };
    }
    return { error: `Failed to list files: ${error.message}` };
  }
}

export async function getGoogleDriveFileContent(fileId: string): Promise<{ content?: string; name?: string; mimeType?: string; error?: string; needsReAuth?: boolean }> {
  const session = await getServerSession(authOptions);
  if (!session || !session.accessToken) {
    return { error: "Authentication required." };
  }
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: session.accessToken });
  const drive = google.drive({ version: "v3", auth: oauth2Client });

  try {
    // First, get file metadata to get the name and confirm it's not a Google Doc native type
    const metadataResponse = await drive.files.get({
      fileId: fileId,
      fields: "name, mimeType",
    });
    const fileName = metadataResponse.data.name;
    const mimeType = metadataResponse.data.mimeType;

    if (!fileName) {
        return { error: "File name could not be retrieved." };
    }

    // For Google Docs, Sheets, Slides, we need to export them
    // For now, we will only handle plain text or try to download others directly
    // This part would need significant expansion for robust handling of Google native formats
    if (mimeType && mimeType.includes('google-apps')) {
        if (mimeType === 'application/vnd.google-apps.document') {
            const res = await drive.files.export({ fileId, mimeType: 'text/plain' }, { responseType: 'stream' });
            // Convert stream to string
            const chunks: any[] = [];
            for await (const chunk of (res.data as any)) {
                chunks.push(chunk);
            }
            return { content: Buffer.concat(chunks).toString(), name: fileName, mimeType: mimeType || 'text/plain' };
        } else {
            return { error: `Unsupported Google Doc type: ${mimeType}. Only text export from Google Docs is supported.` };
        }
    }

    // For other file types (PDF, TXT, etc.), try direct download
    const response = await drive.files.get(
      { fileId: fileId, alt: "media" },
      { responseType: "arraybuffer" } // Fetch as arraybuffer
    );
    
    // For text files, we can try to decode. For others, this might be binary.
    // We assume text for now for validation purposes as our AI expects text.
    // A more robust solution would check mimeType here.
    const content = Buffer.from(response.data as ArrayBuffer).toString("utf-8");
    return { content, name: fileName, mimeType: mimeType || 'application/octet-stream' };

  } catch (error: any) {
    console.error("Error getting Google Drive file content:", error.message, error.response?.data);
    const errorMessage = error.message?.toLowerCase() || "";
    let errorResponseData = null;
    if (typeof error.response?.data?.error === 'string') {
      errorResponseData = error.response.data.error.toLowerCase();
    }
    const errorStatus = error.response?.status;
    if (errorResponseData === "invalid_grant" || errorMessage.includes("token") || errorMessage.includes("invalid credentials") || errorMessage.includes("expired") || errorStatus === 401 || errorStatus === 403){
        return { error: "Error de autenticación o permisos con Google Drive. Por favor, intente salir y volver a ingresar.", needsReAuth: true };
    }
    return { error: `Failed to get file content: ${error.message}` };
  }
}
