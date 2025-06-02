"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircleIcon, XCircleIcon, AlertCircleIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getDocuments, getCompanyType, setCompanyType, resetCompanyType, setMaximoEndeudamiento, getMaximoEndeudamiento } from "@/app/actions"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"

type Document = {
  id: string
  name: string
  url: string
  uploadedAt: string
  isValid: boolean
  validationMessage?: string
  documentType?: string
  companyType?: string
  documentYear?: number
}

interface FinancialDashboardProps {
  documents: Document[];
  isLoadingDocuments: boolean;
  onCompanyTypeChange: () => void; // Callback to refresh docs if needed after type change
}

export function FinancialDashboard({ documents, isLoadingDocuments, onCompanyTypeChange }: FinancialDashboardProps) {
  const [loadingAppConfig, setLoadingAppConfig] = useState(true);
  const [companyType, setCompanyTypeState] = useState<"regular" | "agricultural" | "new" | null>(null)
  const [showChangeDialog, setShowChangeDialog] = useState(false)
  const [pendingCompanyType, setPendingCompanyType] = useState<"regular" | "agricultural" | "new" | null>(null)
  const [maximoEndeudamiento, setMaximoEndeudamientoState] = useState<number | null>(null)
  const [endeudamientoInput, setEndeudamientoInput] = useState<string>("")
  const LOCAL_STORAGE_KEY_MAX_ENDEUDAMIENTO = "maximoEndeudamientoPersistent";

  useEffect(() => {
    // Load initial config from server and then try to override with localStorage if present
    const loadInitialConfig = async () => {
      setLoadingAppConfig(true);
      try {
        const [serverCompanyType, serverMaxEndeudamiento] = await Promise.all([
          getCompanyType(),
          getMaximoEndeudamiento(),
        ]);
        
        setCompanyTypeState(serverCompanyType);

        // Check localStorage for persisted maximoEndeudamiento
        const persistedMaxEndeudamientoString = localStorage.getItem(LOCAL_STORAGE_KEY_MAX_ENDEUDAMIENTO);
        let effectiveMaxEndeudamiento = serverMaxEndeudamiento;

        if (persistedMaxEndeudamientoString !== null) {
          const persistedAmount = parseFloat(persistedMaxEndeudamientoString);
          if (!isNaN(persistedAmount) && persistedAmount >=0) {
            effectiveMaxEndeudamiento = persistedAmount;
            // If localStorage value is different from server, update server
            if (persistedAmount !== serverMaxEndeudamiento) {
              console.log(`Syncing localStorage Maximo Endeudamiento (${persistedAmount}) to server.`);
              await setMaximoEndeudamiento(persistedAmount);
            }
          }
        }
        
        setMaximoEndeudamientoState(effectiveMaxEndeudamiento);
        setEndeudamientoInput(effectiveMaxEndeudamiento !== null ? effectiveMaxEndeudamiento.toString() : "");

      } catch (error) {
        console.error("Failed to load app config (company type/endeudamiento):", error);
      } finally {
        setLoadingAppConfig(false);
      }
    };

    loadInitialConfig();
  }, [])

  const getRequiredDocuments = () => {
    const baseDocuments = ["Flujo de Fondos", "Balance", "Informe Profesional"]

    if (companyType === "agricultural") {
      return [...baseDocuments, "DICOSE", "DETA"]
    } else if (companyType === "new") {
      return ["Balance (3 requeridos)", "Informe Profesional", "DICOSE"]
    }

    return baseDocuments
  }

  const requiredDocuments = getRequiredDocuments()

  const getDocumentStatus = (docType: string) => {
    if (docType === "Financial Statement (3 required)" && companyType === "new") {
      const financialStatements = documents.filter((d) => d.documentType === "Financial Statement" && d.isValid)
      if (financialStatements.length >= 3) return "complete"
      if (financialStatements.length > 0) return "partial"
      return "missing"
    }

    const doc = documents.find((d) => d.documentType === docType && d.isValid)
    return doc ? "complete" : documents.find((d) => d.documentType === docType) ? "invalid" : "missing"
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "complete":
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />
      case "partial":
        return <AlertCircleIcon className="h-5 w-5 text-amber-500" />
      case "invalid":
        return <XCircleIcon className="h-5 w-5 text-red-500" />
      default:
        return <AlertCircleIcon className="h-5 w-5 text-amber-500" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "complete":
        return <Badge className="bg-green-100 text-green-800 border-green-200">Completo</Badge>
      case "partial":
        return <Badge className="bg-amber-100 text-amber-800 border-amber-200">Parcial</Badge>
      case "invalid":
        return <Badge className="bg-red-100 text-red-800 border-red-200">Inválido</Badge>
      default:
        return <Badge className="bg-amber-100 text-amber-800 border-amber-200">Faltante</Badge>
    }
  }

  const completedCount = requiredDocuments.filter((doc) => getDocumentStatus(doc) === "complete").length
  const totalRequired = requiredDocuments.length
  const isComplete = completedCount === totalRequired

  const handleCompanyTypeButtonClick = async (newType: "regular" | "agricultural" | "new") => {
    if (documents.length > 0 && newType !== companyType) {
      setPendingCompanyType(newType)
      setShowChangeDialog(true)
    } else if (newType !== companyType) {
      await setCompanyType(newType)
      setCompanyTypeState(newType)
      
      // Preserve Maximo Endeudamiento from localStorage if it exists
      const persistedMaxEndeudamientoString = localStorage.getItem(LOCAL_STORAGE_KEY_MAX_ENDEUDAMIENTO);
      if (persistedMaxEndeudamientoString !== null) {
        const persistedAmount = parseFloat(persistedMaxEndeudamientoString);
        if (!isNaN(persistedAmount) && persistedAmount >= 0) {
          setMaximoEndeudamientoState(persistedAmount);
          setEndeudamientoInput(persistedAmount.toString());
          // Ensure server is also updated with this persisted value, though it should be if it was set correctly before
          await setMaximoEndeudamiento(persistedAmount); 
        } else {
          // Invalid value in localStorage, clear it and reset states
          localStorage.removeItem(LOCAL_STORAGE_KEY_MAX_ENDEUDAMIENTO);
          setMaximoEndeudamientoState(null)
          setEndeudamientoInput("")
          await setMaximoEndeudamiento(null); // also clear on server
        }
      } else {
        // No persisted value, so reset (this was the old behavior)
        setMaximoEndeudamientoState(null)
        setEndeudamientoInput("")
        // No need to call setMaximoEndeudamiento(null) here as server state for it is not tied to company type directly
      }
      onCompanyTypeChange() // This will trigger document list refresh
    }
  }

  const confirmCompanyTypeChange = async () => {
    if (pendingCompanyType) {
      await setCompanyType(pendingCompanyType)
      setCompanyTypeState(pendingCompanyType)
      setPendingCompanyType(null)
      setShowChangeDialog(false)

      // Preserve Maximo Endeudamiento from localStorage if it exists
      const persistedMaxEndeudamientoString = localStorage.getItem(LOCAL_STORAGE_KEY_MAX_ENDEUDAMIENTO);
      if (persistedMaxEndeudamientoString !== null) {
        const persistedAmount = parseFloat(persistedMaxEndeudamientoString);
        if (!isNaN(persistedAmount) && persistedAmount >= 0) {
          setMaximoEndeudamientoState(persistedAmount);
          setEndeudamientoInput(persistedAmount.toString());
          await setMaximoEndeudamiento(persistedAmount); // Ensure server reflects this persisted value
        } else {
          localStorage.removeItem(LOCAL_STORAGE_KEY_MAX_ENDEUDAMIENTO);
          setMaximoEndeudamientoState(null)
          setEndeudamientoInput("")
          await setMaximoEndeudamiento(null); 
        }
      } else {
        setMaximoEndeudamientoState(null)
        setEndeudamientoInput("")
      }
      onCompanyTypeChange() // This will trigger document list refresh
    }
  }

  const handleResetCompanyType = async () => {
    await resetCompanyType() // Resets company type on the server
    setCompanyTypeState(null)  // Resets local company type state
    
    // User wants Maximo Endeudamiento to persist even when going back to company type selection.
    // So, we no longer clear it from localStorage or server here.
    // The useEffect that loads initial config will ensure it's reapplied from localStorage if present.
    // If not in localStorage, it will correctly be null/empty as per server state (which should also be null if never set).

    // The input field (endeudamientoInput) and local state (maximoEndeudamientoState)
    // will be updated by the useEffect hook when it re-runs due to dependency changes
    // or component re-evaluation after onCompanyTypeChange.
    // For an immediate reflection if useEffect doesn't run as expected right away, 
    // we can re-apply from localStorage here too, similar to other handlers.
    const persistedMaxEndeudamientoString = localStorage.getItem(LOCAL_STORAGE_KEY_MAX_ENDEUDAMIENTO);
    if (persistedMaxEndeudamientoString !== null) {
      const persistedAmount = parseFloat(persistedMaxEndeudamientoString);
      if (!isNaN(persistedAmount) && persistedAmount >= 0) {
        setMaximoEndeudamientoState(persistedAmount);
        setEndeudamientoInput(persistedAmount.toString());
        // No need to call setMaximoEndeudamiento server action here, as it's not being changed by this action.
        // The server should already have the correct persisted value from previous sets.
      } else {
        // Invalid value in localStorage, treat as if not set.
        setMaximoEndeudamientoState(null);
        setEndeudamientoInput("");
      }
    } else {
      // No value in localStorage, ensure local state reflects this.
      setMaximoEndeudamientoState(null);
      setEndeudamientoInput("");
    }

    onCompanyTypeChange() // This will trigger document list refresh and potentially other effects.
  }

  const getCompanyTypeLabel = (type: string) => {
    switch (type) {
      case "agricultural":
        return "Empresa Agrícola"
      case "new":
        return "Empresa Nueva"
      default:
        return "Empresa Regular"
    }
  }

  const handleEndeudamientoChange = async () => {
    const amount = parseFloat(endeudamientoInput);
    let success = false;
    let finalAmountForStorage: number | null = null;

    if (!isNaN(amount) && amount >= 0) {
      const result = await setMaximoEndeudamiento(amount);
      setMaximoEndeudamientoState(result.currentAmount); 
      finalAmountForStorage = result.currentAmount;
      success = result.success;
    } else if (endeudamientoInput === "") {
      const result = await setMaximoEndeudamiento(null);
      setMaximoEndeudamientoState(result.currentAmount); 
      finalAmountForStorage = null;
      success = result.success;
    } else {
      console.error("Invalid endeudamiento input");
      // Don't save invalid input to localStorage
    }

    if (success) {
      if (finalAmountForStorage !== null) {
        localStorage.setItem(LOCAL_STORAGE_KEY_MAX_ENDEUDAMIENTO, finalAmountForStorage.toString());
      } else {
        localStorage.removeItem(LOCAL_STORAGE_KEY_MAX_ENDEUDAMIENTO);
      }
      onCompanyTypeChange(); 
    }
  };

  if (isLoadingDocuments || loadingAppConfig) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Requerimientos</CardTitle>
          <CardDescription>Cargando...</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Requerimientos</CardTitle>
        <CardDescription>
          {isComplete
            ? "Todos los documentos requeridos han sido cargados y validados ✓"
            : `${completedCount} de ${totalRequired} documentos requeridos completados`}
          {maximoEndeudamiento !== null && 
            ` (Máximo Endeudamiento: ${maximoEndeudamiento.toLocaleString("es-UY", { style: "currency", currency: "UYU" })})`
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <Label htmlFor="maximoEndeudamientoInput" className="font-medium text-yellow-900 mb-2 block">Máximo Endeudamiento en el Sistema Financiero (Último Año)</Label>
          <div className="flex items-center gap-2">
            <Input 
              type="number" 
              id="maximoEndeudamientoInput"
              placeholder="Ingrese el monto en UYU"
              value={endeudamientoInput}
              onChange={(e) => setEndeudamientoInput(e.target.value)}
              className="flex-grow"
            />
            <Button onClick={handleEndeudamientoChange} size="sm">Establecer</Button>
          </div>
          <p className="text-xs text-yellow-700 mt-2">
            Este monto determinará el tipo de informe requerido por el contador.
          </p>
        </div>

        {!companyType && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="font-medium text-blue-900 mb-2">Seleccione el Tipo de Empresa</h3>
            <p className="text-blue-700 text-sm mb-3">Por favor seleccione el tipo de empresa para ver los documentos requeridos.</p>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  await handleCompanyTypeButtonClick("regular")
                }}
              >
                Empresa
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  await handleCompanyTypeButtonClick("agricultural")
                }}
              >
                Empresa Agrícola
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  await handleCompanyTypeButtonClick("new")
                }}
              >
                Empresa Nueva
              </Button>
            </div>
          </div>
        )}

        {companyType && (
          <div className="mb-4 p-4 bg-gray-50 border rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium">Tipo de Empresa: {getCompanyTypeLabel(companyType)}</span>
                <p className="text-xs text-muted-foreground mt-1">
                  {companyType === "agricultural"
                    ? "Requiere 5 documentos: 3 financieros + DICOSE + DETA (mismo año para DICOSE y Estados Financieros)"
                    : companyType === "new"
                      ? "Requiere 3 estados financieros + DICOSE + Declaración del Contador (mismo año para DICOSE y Estados Financieros)"
                      : "Requiere 3 documentos financieros"}
                </p>
              </div>
              <div className="flex gap-2">
                {companyType !== "regular" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      await handleCompanyTypeButtonClick("regular")
                    }}
                  >
                    Regular
                  </Button>
                )}
                {companyType !== "agricultural" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      await handleCompanyTypeButtonClick("agricultural")
                    }}
                  >
                    Agrícola
                  </Button>
                )}
                {companyType !== "new" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      await handleCompanyTypeButtonClick("new")
                    }}
                  >
                    Nueva
                  </Button>
                )}
              </div>
            </div>
            <div className="mt-3 pt-3 border-t">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetCompanyType}
                className="text-blue-600 hover:text-blue-800"
              >
                ← Volver a Selección de Tipo de Empresa
              </Button>
            </div>
          </div>
        )}

        {requiredDocuments.map((docType) => {
          const status = getDocumentStatus(docType)
          const doc = documents.find((d) => d.documentType === docType.replace(" (3 required)", ""))

          return (
            <div key={docType} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                {getStatusIcon(status)}
                <div>
                  <p className="font-medium">{docType}</p>
                  {docType === "Informe Profesional" && maximoEndeudamiento !== null && (
                    <p className="text-sm text-muted-foreground">
                      Tipo esperado: {
                        maximoEndeudamiento < 900000 ? "Informe de Compilación" :
                        maximoEndeudamiento < 2400000 ? "Informe de Revisión Limitada" :
                        "Informe de Auditoría"
                      }
                    </p>
                  )}
                  {docType === "Balance (3 requeridos)" && companyType === "new" && (
                    <p className="text-sm text-muted-foreground">
                      {documents.filter((d) => d.documentType === "Balance" && d.isValid).length} de 3 cargados
                    </p>
                  )}
                  {doc && status === "invalid" && <p className="text-sm text-red-600">{doc.validationMessage}</p>}
                  {doc && status === "complete" && (
                    <p className="text-sm text-muted-foreground">
                      Cargado: {doc.name} {doc.documentYear && `(${doc.documentYear})`}
                    </p>
                  )}
                </div>
              </div>
              {getStatusBadge(status)}
            </div>
          )
        })}

        {isComplete && (
          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2">
              <CheckCircleIcon className="h-5 w-5 text-green-600" />
              <p className="text-green-800 font-medium">¡Todos los Requisitos Cumplidos!</p>
            </div>
            <p className="text-green-700 text-sm mt-1">
              Ha cargado y validado exitosamente todos los documentos financieros requeridos.
            </p>
          </div>
        )}
      </CardContent>
      <Dialog open={showChangeDialog} onOpenChange={setShowChangeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Cambiar Tipo de Empresa?</DialogTitle>
            <DialogDescription>
              Ya ha cargado {documents.length} documento(s). Cambiar el tipo de empresa afectará los documentos requeridos. 
              Sus documentos cargados permanecerán, pero algunos pueden no ser válidos para el nuevo tipo de empresa.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowChangeDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={confirmCompanyTypeChange}>
              Cambiar a {getCompanyTypeLabel(pendingCompanyType || "")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
