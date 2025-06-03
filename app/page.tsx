"use client"; // This page now needs to be a client component to manage state
import { useState, useEffect, useCallback } from "react";
import Image from "next/image"; // Import NextImage
import { DocumentUploader } from "@/components/document-uploader"
import { DocumentList } from "@/components/document-list"
import { FinancialDashboard } from "@/components/financial-dashboard"
import GoogleDriveBrowser from "@/components/GoogleDriveBrowser"; // Corrected import
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getDocuments, getCompanyType, getMaximoEndeudamiento, getPlazoMaximoDeudaAnos, setCompanyType as setServerCompanyType, setMaximoEndeudamiento as setServerMaximoEndeudamiento } from "@/app/actions"; // Assuming these are still needed here or in children
import { Loader2 } from "lucide-react"; // For more subtle loading if needed

// Define DocumentType if it's not already globally available or imported
// This should match the type definition used in your components/actions
type Document = {
  id: string;
  name: string;
  url: string;
  uploadedAt: string;
  isValid: boolean;
  validationMessage?: string;
  documentType?: string;
  companyType?: string;
  documentYear?: number;
};

export default function Home() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentCompanyType, setCurrentCompanyType] = useState<"regular" | "agricultural" | "new" | null>(null);
  const [currentMaximoEndeudamiento, setCurrentMaximoEndeudamiento] = useState<number | null>(null);
  const [currentPlazoDeudaAnos, setCurrentPlazoDeudaAnos] = useState<number | null>(null);

  const fetchAllData = useCallback(async (showLoader = true) => {
    if (showLoader) setIsLoading(true);
    try {
      const [docs, companyType, maxEndeudamiento, plazoDeuda] = await Promise.all([
        getDocuments(),
        getCompanyType(),
        getMaximoEndeudamiento(),
        getPlazoMaximoDeudaAnos()
      ]);
      setDocuments(docs);
      setCurrentCompanyType(companyType);
      setCurrentMaximoEndeudamiento(maxEndeudamiento);
      setCurrentPlazoDeudaAnos(plazoDeuda);
      console.log("[Page] fetchAllData complete:", { companyType, maxEndeudamiento, plazoDeuda });
    } catch (error) {
      console.error("Error fetching data for page:", error);
    } finally {
      if (showLoader) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllData(true); // Show loader on initial full load
  }, [fetchAllData]);

  const handleUploadComplete = useCallback(() => {
    fetchAllData(false); // Re-fetch data, but maybe don't show full page loader if not desired
  }, [fetchAllData]);
  
  // New specific handlers
  const handleActualCompanyTypeChange = useCallback((newType: "regular" | "agricultural" | "new" | null) => {
    console.log("[Page] Actual company type changed to:", newType);
    // Server state for company type is already set by FinancialDashboard
    // We update local state and then fetch all data because requirements change
    setCurrentCompanyType(newType);
    fetchAllData(true); // Full refresh with loader as requirements change
  }, [fetchAllData]);

  const handleMaxEndeudamientoUpdated = useCallback((newAmount: number | null) => {
    console.log("[Page] Max endeudamiento updated to:", newAmount);
    setCurrentMaximoEndeudamiento(newAmount);
    // No full fetchAllData here to prevent blink
    // DocumentUploader and GoogleDriveBrowser will get updated prop
  }, []);

  const handlePlazoDeudaAnosUpdated = useCallback((newPlazo: number | null) => {
    console.log("[Page] Plazo deuda anos updated to:", newPlazo);
    setCurrentPlazoDeudaAnos(newPlazo);
    // No full fetchAllData here
  }, []);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      {/* Header Section */}
      <header className="bg-brou-blue text-brou-white p-6 shadow-md">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Image src="/LogoBROU.png" alt="BROU Logo" width={50} height={50} />
            <h1 className="text-3xl font-bold">Mesa de Entrada</h1>
          </div>
          {/* Optional: Add other header elements here, like user info or nav */}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="container mx-auto py-10 space-y-10">
        {isLoading && !documents.length && (
            <div className="fixed inset-0 bg-slate-100 bg-opacity-75 flex flex-col items-center justify-center z-50">
                <Loader2 className="h-16 w-16 animate-spin text-brou-blue mx-auto mb-6" />
                <h1 className="text-2xl font-semibold mb-2 text-brou-blue">Cargando Datos...</h1>
                <p className="text-lg text-slate-700">Un momento por favor.</p>
            </div>
        )}
        <div className="text-center space-y-2 mb-10">
          {/* Subtitle can remain or be styled differently if needed */}
          <p className="text-slate-600">
            Cargue y valide sus documentos financieros requeridos según corresponda
          </p>
          <p className="text-xs text-slate-500">Para empresas que vienen por primera vez a OPYCR, se requieren los 3 ultimos balances con sus respectivas notas e informes</p>
        </div>

        {/* Dashboard - wrapped in a Card for consistency */}
        <Card className="bg-brou-white shadow-lg">
          <CardContent className="p-6">
            <FinancialDashboard 
              documents={documents} 
              isLoadingDocuments={isLoading} // This prop might need re-evaluation or be used for internal loaders in FD
              initialCompanyType={currentCompanyType}
              initialMaximoEndeudamiento={currentMaximoEndeudamiento}
              initialPlazoDeudaAnos={currentPlazoDeudaAnos}
              onActualCompanyTypeChange={handleActualCompanyTypeChange}
              onMaxEndeudamientoUpdated={handleMaxEndeudamientoUpdated}
              onPlazoDeudaAnosUpdated={handlePlazoDeudaAnosUpdated}
            />
          </CardContent>
        </Card>
        

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Document Uploader - wrapped in a Card */}
          <Card className="bg-brou-white shadow-lg">
            <DocumentUploader 
              onUploadComplete={handleUploadComplete}
              disabled={isLoading}
            />
          </Card>

          {/* Google Drive Browser - wrapped in a Card */}
          <Card className="bg-brou-white shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg text-brou-blue">Procesar desde Google Drive</CardTitle>
            </CardHeader>
            <CardContent>
              <GoogleDriveBrowser 
                onUploadComplete={handleUploadComplete}
                companyType={currentCompanyType}
                maximoEndeudamiento={currentMaximoEndeudamiento}
                plazoDeudaAnos={currentPlazoDeudaAnos}
                disabled={isLoading}
              />
            </CardContent>
          </Card>

          {/* Requirements Section - already a Card, ensure bg is white */}
          <Card className="bg-brou-white shadow-lg lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg text-brou-blue">Requerimientos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold text-brou-blue text-sm mb-2">Empresas:</h4>
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 bg-brou-yellow rounded-full mt-1.5 shrink-0"></div>
                    <span className="text-sm text-slate-700">
                      <strong>Flujo de Fondos:</strong> Incluir actividades operativas, de inversión y financiamiento
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 bg-brou-yellow rounded-full mt-1.5 shrink-0"></div>
                    <span className="text-sm text-slate-700">
                      <strong>Balance:</strong> Debe incluir activos, pasivos, ingresos y gastos
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 bg-brou-yellow rounded-full mt-1.5 shrink-0"></div>
                    <span className="text-sm text-slate-700">
                      <strong>Informe Profesional:</strong> El tipo depende del Máximo Endeudamiento:<br/>
                      - Menor a 900.000 UYU: Informe de Compilación.<br/>
                      - Entre 900.000 y 2.400.000 UYU: Informe de Revisión Limitada.<br/>
                      - Mayor a 2.400.000 UYU: Informe de Auditoría.
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-brou-blue text-sm mb-2">Empresas Agrícolas:</h4>
                <div className="space-y-2">
                  <div className="text-xs text-slate-500 mb-1">Todos los documentos de empresa más:</div>
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 bg-brou-yellow rounded-full mt-1.5 shrink-0"></div>
                    <span className="text-sm text-slate-700">
                      <strong>DICOSE:</strong> Registro agrícola (debe coincidir con el año del balance)
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 bg-brou-yellow rounded-full mt-1.5 shrink-0"></div>
                    <span className="text-sm text-slate-700">
                      <strong>DETA:</strong> Declaración agrícola con opiniones de flujo de caja y crédito
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-brou-blue text-sm mb-2">Empresas Nuevas:</h4>
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 bg-brou-yellow rounded-full mt-1.5 shrink-0"></div>
                    <span className="text-sm text-slate-700">
                      <strong>3 Balances:</strong> Múltiples años de datos financieros
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 bg-brou-yellow rounded-full mt-1.5 shrink-0"></div>
                    <span className="text-sm text-slate-700">
                      <strong>DICOSE:</strong> Documento de registro (debe coincidir con el año del balance)
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 bg-brou-yellow rounded-full mt-1.5 shrink-0"></div>
                    <span className="text-sm text-slate-700">
                      <strong>Informe Profesional:</strong> El tipo depende del Máximo Endeudamiento (ver arriba).
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Document List - wrapped in a Card */}
        <Card className="bg-brou-white shadow-lg">
          <CardContent className="p-6">
            <DocumentList documents={documents} isLoading={isLoading} onDeleteComplete={fetchAllData} />
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

