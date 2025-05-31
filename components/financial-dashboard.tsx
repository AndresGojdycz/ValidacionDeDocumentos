"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircleIcon, XCircleIcon, AlertCircleIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getDocuments, getCompanyType, setCompanyType, resetCompanyType } from "@/app/actions"
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

export function FinancialDashboard() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [companyType, setCompanyTypeState] = useState<"regular" | "agricultural" | "new" | null>(null)
  const [showChangeDialog, setShowChangeDialog] = useState(false)
  const [pendingCompanyType, setPendingCompanyType] = useState<"regular" | "agricultural" | "new" | null>(null)

  useEffect(() => {
    loadDocuments()
  }, [])

  const loadDocuments = async () => {
    setLoading(true)
    try {
      const [docs, type] = await Promise.all([getDocuments(), getCompanyType()])
      setDocuments(docs)
      setCompanyTypeState(type)
    } catch (error) {
      console.error("Failed to load documents:", error)
    } finally {
      setLoading(false)
    }
  }

  const getRequiredDocuments = () => {
    const baseDocuments = ["Projected Cashflow", "Financial Statement", "Accountant Declaration"]

    if (companyType === "agricultural") {
      return [...baseDocuments, "DICOSE", "DETA"]
    } else if (companyType === "new") {
      return ["Financial Statement (3 required)", "Accountant Declaration", "DICOSE"]
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

  const handleCompanyTypeChange = async (newType: "regular" | "agricultural" | "new") => {
    if (documents.length > 0) {
      setPendingCompanyType(newType)
      setShowChangeDialog(true)
    } else {
      await setCompanyType(newType)
      setCompanyTypeState(newType)
    }
  }

  const confirmCompanyTypeChange = async () => {
    if (pendingCompanyType) {
      await setCompanyType(pendingCompanyType)
      setCompanyTypeState(pendingCompanyType)
      setShowChangeDialog(false)
      setPendingCompanyType(null)
    }
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

  if (loading) {
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
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!companyType && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="font-medium text-blue-900 mb-2">Seleccione el Tipo de Empresa</h3>
            <p className="text-blue-700 text-sm mb-3">Por favor seleccione el tipo de empresa para ver los documentos requeridos.</p>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  await handleCompanyTypeChange("regular")
                }}
              >
                Empresa Regular
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  await handleCompanyTypeChange("agricultural")
                }}
              >
                Empresa Agrícola
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  await handleCompanyTypeChange("new")
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
                      await handleCompanyTypeChange("regular")
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
                      await handleCompanyTypeChange("agricultural")
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
                      await handleCompanyTypeChange("new")
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
                onClick={async () => {
                  await resetCompanyType()
                  setCompanyTypeState(null)
                }}
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
                  {docType === "Financial Statement (3 required)" && companyType === "new" && (
                    <p className="text-sm text-muted-foreground">
                      {documents.filter((d) => d.documentType === "Financial Statement" && d.isValid).length} de 3
                      cargados
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
