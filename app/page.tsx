"use client"; // This page now needs to be a client component to manage state

import { useState, useEffect } from "react";
import Image from "next/image"; // Import NextImage
import { DocumentUploader } from "@/components/document-uploader"
import { DocumentList } from "@/components/document-list"
import { FinancialDashboard } from "@/components/financial-dashboard"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getDocuments, getCompanyType, getMaximoEndeudamiento } from "@/app/actions"; // Assuming these are still needed here or in children

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
  // We can also manage companyType and maxEndeudamiento here if FinancialDashboard will become more of a display component
  // For now, let's focus on documents

  const fetchDocuments = async () => {
    try {
      // setIsLoading(true); // Optionally show a loading state for refreshes too
      const docs = await getDocuments();
      setDocuments(docs);
    } catch (error) {
      console.error("Error fetching documents:", error);
      // Handle error appropriately
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const handleUploadComplete = () => {
    // This function will be called by DocumentUploader
    // It re-fetches all documents. A more optimized way would be to get the
    // new/updated document from validateDocument and update the state locally.
    // But for simplicity and to ensure full consistency for now:
    fetchDocuments();
  };

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
            <FinancialDashboard documents={documents} isLoadingDocuments={isLoading} onCompanyTypeChange={fetchDocuments} />
          </CardContent>
        </Card>
        

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Document Uploader - wrapped in a Card */}
          <Card className="bg-brou-white shadow-lg">
            <DocumentUploader onUploadComplete={handleUploadComplete} />
          </Card>

          {/* Requirements Section - already a Card, ensure bg is white */}
          <Card className="bg-brou-white shadow-lg">
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
            <DocumentList documents={documents} isLoading={isLoading} onDeleteComplete={fetchDocuments} />
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
