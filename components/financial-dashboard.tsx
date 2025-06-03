"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircleIcon, XCircleIcon, AlertCircleIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getCompanyType, setCompanyType, resetCompanyType, setMaximoEndeudamiento, getPlazoMaximoDeudaAnos, setPlazoMaximoDeudaAnos } from "@/app/actions"
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
  initialCompanyType: "regular" | "agricultural" | "new" | null;
  initialMaximoEndeudamiento: number | null;
  initialPlazoDeudaAnos: number | null;
  onActualCompanyTypeChange: (newType: "regular" | "agricultural" | "new" | null) => void;
  onMaxEndeudamientoUpdated: (newAmount: number | null) => void;
  onPlazoDeudaAnosUpdated: (newPlazo: number | null) => void;
}

export function FinancialDashboard({ 
  documents, 
  isLoadingDocuments, 
  initialCompanyType,
  initialMaximoEndeudamiento,
  initialPlazoDeudaAnos,
  onActualCompanyTypeChange,
  onMaxEndeudamientoUpdated,
  onPlazoDeudaAnosUpdated,
}: FinancialDashboardProps) {
  const [loadingAppConfig, setLoadingAppConfig] = useState(true);
  const [companyType, setCompanyTypeState] = useState<"regular" | "agricultural" | "new" | null>(initialCompanyType)
  const [showChangeDialog, setShowChangeDialog] = useState(false)
  const [pendingCompanyType, setPendingCompanyType] = useState<"regular" | "agricultural" | "new" | null>(null)
  
  const [maximoEndeudamientoState, setMaximoEndeudamientoState] = useState<number | null>(initialMaximoEndeudamiento)
  const [endeudamientoInput, setEndeudamientoInput] = useState<string>(initialMaximoEndeudamiento !== null ? initialMaximoEndeudamiento.toString() : "")
  const LOCAL_STORAGE_KEY_MAX_ENDEUDAMIENTO = "maximoEndeudamientoPersistent";
  
  const [plazoDeudaAnosState, setPlazoDeudaAnosState] = useState<number | null>(initialPlazoDeudaAnos);
  const [plazoDeudaAnosInput, setPlazoDeudaAnosInput] = useState<string>(initialPlazoDeudaAnos !== null ? initialPlazoDeudaAnos.toString() : "");
  const LOCAL_STORAGE_KEY_PLAZO_DEUDA_ANOS = "plazoDeudaAnosPersistent";

  useEffect(() => {
    // Sync with initial props
    setCompanyTypeState(initialCompanyType);
    setMaximoEndeudamientoState(initialMaximoEndeudamiento);
    setEndeudamientoInput(initialMaximoEndeudamiento !== null ? initialMaximoEndeudamiento.toString() : "");
    setPlazoDeudaAnosState(initialPlazoDeudaAnos);
    setPlazoDeudaAnosInput(initialPlazoDeudaAnos !== null ? initialPlazoDeudaAnos.toString() : "");
  }, [initialCompanyType, initialMaximoEndeudamiento, initialPlazoDeudaAnos]);


  useEffect(() => {
    // This effect now focuses on syncing localStorage with the server and parent if different from initial props
    const syncLocalStorage = async () => {
      setLoadingAppConfig(true);
      try {
        // Sync Maximo Endeudamiento
        const persistedMaxEndeudamientoString = localStorage.getItem(LOCAL_STORAGE_KEY_MAX_ENDEUDAMIENTO);
        if (persistedMaxEndeudamientoString !== null) {
          const persistedAmount = parseFloat(persistedMaxEndeudamientoString);
          if (!isNaN(persistedAmount) && persistedAmount >= 0 && persistedAmount !== initialMaximoEndeudamiento) {
            console.log(`Syncing localStorage Maximo Endeudamiento (${persistedAmount}) to server and parent.`);
            const serverResult = await setMaximoEndeudamiento(persistedAmount);
            setMaximoEndeudamientoState(serverResult.currentAmount);
            setEndeudamientoInput(serverResult.currentAmount !== null ? serverResult.currentAmount.toString() : "");
            if(serverResult.success) onMaxEndeudamientoUpdated(serverResult.currentAmount);
          } else if (persistedAmount === initialMaximoEndeudamiento) {
            // If localStorage is same as initial (already synced by parent), just ensure local state matches
            setMaximoEndeudamientoState(persistedAmount);
            setEndeudamientoInput(persistedAmount.toString());
          }
        }

        // Sync Plazo Deuda Anos
        const persistedPlazoDeudaAnosString = localStorage.getItem(LOCAL_STORAGE_KEY_PLAZO_DEUDA_ANOS);
        if (persistedPlazoDeudaAnosString !== null) {
          const persistedNum = parseInt(persistedPlazoDeudaAnosString, 10);
          if (!isNaN(persistedNum) && persistedNum >= 0 && persistedNum !== initialPlazoDeudaAnos) {
            console.log(`Syncing localStorage Plazo Deuda Anos (${persistedNum}) to server and parent.`);
            const serverResult = await setPlazoMaximoDeudaAnos(persistedNum);
            setPlazoDeudaAnosState(serverResult.currentPlazoAnos);
            setPlazoDeudaAnosInput(serverResult.currentPlazoAnos !== null ? serverResult.currentPlazoAnos.toString() : "");
            if(serverResult.success) onPlazoDeudaAnosUpdated(serverResult.currentPlazoAnos);
          } else if (persistedNum === initialPlazoDeudaAnos) {
             setPlazoDeudaAnosState(persistedNum);
             setPlazoDeudaAnosInput(persistedNum.toString());
          }
        }
      } catch (error) {
        console.error("Error syncing localStorage with server/parent:", error);
      } finally {
        setLoadingAppConfig(false);
      }
    };

    syncLocalStorage();
  // Run this effect when initial props change, to re-evaluate localStorage sync
  }, [initialMaximoEndeudamiento, initialPlazoDeudaAnos, onMaxEndeudamientoUpdated, onPlazoDeudaAnosUpdated]);

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
      
      // Maximo Endeudamiento and Plazo are preserved based on localStorage, handled by useEffect.
      // The parent (`app/page.tsx`) will manage fetching/passing these updated values.
      onActualCompanyTypeChange(newType) 
    }
  }

  const confirmCompanyTypeChange = async () => {
    if (pendingCompanyType) {
      await setCompanyType(pendingCompanyType)
      setCompanyTypeState(pendingCompanyType)
      const newType = pendingCompanyType;
      setPendingCompanyType(null)
      setShowChangeDialog(false)

      // Maximo Endeudamiento and Plazo are preserved based on localStorage, handled by useEffect.
      onActualCompanyTypeChange(newType);
    }
  }

  const handleResetCompanyType = async () => {
    await resetCompanyType() // Resets company type on the server
    setCompanyTypeState(null)  // Resets local company type state
    
    // Maximo Endeudamiento and Plazo persist based on localStorage.
    // Parent will be notified to refresh.
    onActualCompanyTypeChange(null);
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
    let serverResponseAmount: number | null = null;

    if (!isNaN(amount) && amount >= 0) {
      const result = await setMaximoEndeudamiento(amount);
      serverResponseAmount = result.currentAmount;
      finalAmountForStorage = result.currentAmount;
      success = result.success;
    } else if (endeudamientoInput === "") {
      const result = await setMaximoEndeudamiento(null);
      serverResponseAmount = result.currentAmount; 
      finalAmountForStorage = null;
      success = result.success;
    } else {
      console.error("Invalid endeudamiento input");
      // Optionally provide user feedback here e.g. via toast
      return; 
    }

    if (success) {
      setMaximoEndeudamientoState(serverResponseAmount); // Update local state with confirmed value
      setEndeudamientoInput(serverResponseAmount !== null ? serverResponseAmount.toString() : ""); // Sync input field

      if (finalAmountForStorage !== null) {
        localStorage.setItem(LOCAL_STORAGE_KEY_MAX_ENDEUDAMIENTO, finalAmountForStorage.toString());
      } else {
        localStorage.removeItem(LOCAL_STORAGE_KEY_MAX_ENDEUDAMIENTO);
      }
      onMaxEndeudamientoUpdated(serverResponseAmount); 
    }
  };

  // New handler for Plazo Maximo Deuda Anos
  const handlePlazoDeudaAnosChange = async () => {
    const anos = parseInt(plazoDeudaAnosInput, 10);
    let success = false;
    let finalAnosForStorage: number | null = null;
    let serverResponseAnos: number | null = null;

    if (!isNaN(anos) && anos >= 0) {
      const result = await setPlazoMaximoDeudaAnos(anos);
      serverResponseAnos = result.currentPlazoAnos;
      finalAnosForStorage = result.currentPlazoAnos;
      success = result.success;
    } else if (plazoDeudaAnosInput === "") {
      const result = await setPlazoMaximoDeudaAnos(null);
      serverResponseAnos = result.currentPlazoAnos;
      finalAnosForStorage = null;
      success = result.success;
    } else {
      console.error("Invalid plazoDeudaAnosInput input");
      // Optionally provide user feedback here
      return;
    }

    if (success) {
      setPlazoDeudaAnosState(serverResponseAnos); // Update local state
      setPlazoDeudaAnosInput(serverResponseAnos !== null ? serverResponseAnos.toString() : ""); // Sync input

      if (finalAnosForStorage !== null) {
        localStorage.setItem(LOCAL_STORAGE_KEY_PLAZO_DEUDA_ANOS, finalAnosForStorage.toString());
      } else {
        localStorage.removeItem(LOCAL_STORAGE_KEY_PLAZO_DEUDA_ANOS);
      }
      onPlazoDeudaAnosUpdated(serverResponseAnos);
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
          {maximoEndeudamientoState !== null && 
            ` (Máximo Endeudamiento: ${maximoEndeudamientoState.toLocaleString("es-UY", { style: "currency", currency: "UYU" })})`
          }
          {plazoDeudaAnosState !== null && plazoDeudaAnosState >= 0 &&
            ` (Plazo Deuda: ${plazoDeudaAnosState} años)`
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

        {/* New Input for Plazo Maximo Deuda Anos */}
        <div className="mb-6 p-4 bg-sky-50 border border-sky-200 rounded-lg">
          <Label htmlFor="plazoDeudaAnosInput" className="font-medium text-sky-900 mb-2 block">Plazo Máximo de Deuda Tomada o a Tomar (Años)</Label>
          <div className="flex items-center gap-2">
            <Input 
              type="number" 
              id="plazoDeudaAnosInput"
              placeholder="Ingrese el número de años"
              value={plazoDeudaAnosInput}
              onChange={(e) => setPlazoDeudaAnosInput(e.target.value)}
              min="0"
              className="flex-grow"
            />
            <Button onClick={handlePlazoDeudaAnosChange} size="sm" className="bg-sky-600 hover:bg-sky-700">Establecer Plazo</Button>
          </div>
          <p className="text-xs text-sky-700 mt-2">
            El Flujo de Fondos proyectado deberá cubrir hasta el año actual más este plazo.
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
                  {docType === "Informe Profesional" && maximoEndeudamientoState !== null && (
                    <p className="text-sm text-muted-foreground">
                      Tipo esperado: {
                        maximoEndeudamientoState < 900000 ? "Informe de Compilación" :
                        maximoEndeudamientoState < 2400000 ? "Informe de Revisión Limitada" :
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
