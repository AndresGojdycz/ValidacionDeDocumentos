"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { FileIcon, CheckCircleIcon, XCircleIcon, EyeIcon, TrashIcon } from "lucide-react"
import { getDocuments, deleteDocument } from "@/app/actions"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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

interface DocumentListProps {
  documents: Document[];
  isLoading: boolean;
  onDeleteComplete: () => void;
}

export function DocumentList({ documents, isLoading, onDeleteComplete }: DocumentListProps) {
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null)

  const handleDelete = async (id: string) => {
    try {
      await deleteDocument(id)
      onDeleteComplete();
    } catch (error) {
      console.error("Failed to delete document:", error)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sus Documentos</CardTitle>
        <CardDescription>Ver y gestionar sus documentos cargados</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-10">
            <p className="text-muted-foreground">Cargando documentos...</p>
          </div>
        ) : documents.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-muted-foreground">Aún no se han cargado documentos</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Documento</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Año</TableHead>
                <TableHead>Cargado</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <FileIcon className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{doc.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs">
                      {doc.documentType || "Desconocido"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {doc.documentYear ? (
                      <Badge variant="outline" className="text-xs">
                        {doc.documentYear}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">N/A</span>
                    )}
                  </TableCell>
                  <TableCell>{formatDate(doc.uploadedAt)}</TableCell>
                  <TableCell>
                    {doc.isValid ? (
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        <CheckCircleIcon className="h-3 w-3 mr-1" />
                        Válido
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                        <XCircleIcon className="h-3 w-3 mr-1" />
                        Inválido
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" onClick={() => setSelectedDocument(doc)}>
                            <EyeIcon className="h-4 w-4" />
                            <span className="sr-only">Ver</span>
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Detalles del Documento</DialogTitle>
                            <DialogDescription>Ver detalles y resultados de validación para {doc.name}</DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 mt-4">
                            <div className="grid grid-cols-2 gap-2">
                              <div className="text-sm font-medium">Nombre:</div>
                              <div className="text-sm">{doc.name}</div>

                              <div className="text-sm font-medium">Tipo:</div>
                              <div className="text-sm">{doc.documentType || "Desconocido"}</div>

                              <div className="text-sm font-medium">Año:</div>
                              <div className="text-sm">{doc.documentYear || "No especificado"}</div>

                              <div className="text-sm font-medium">Cargado:</div>
                              <div className="text-sm">{formatDate(doc.uploadedAt)}</div>

                              <div className="text-sm font-medium">Estado:</div>
                              <div className="text-sm">
                                {doc.isValid ? (
                                  <span className="text-green-600">Válido</span>
                                ) : (
                                  <span className="text-red-600">Inválido</span>
                                )}
                              </div>
                            </div>

                            {!doc.isValid && doc.validationMessage && (
                              <div className="mt-4">
                                <div className="text-sm font-medium">Mensaje de Validación:</div>
                                <div className="text-sm text-red-600 mt-1 p-2 bg-red-50 rounded">
                                  {doc.validationMessage}
                                </div>
                              </div>
                            )}

                            <div className="mt-4">
                              <Button asChild className="w-full">
                                <a href={doc.url} target="_blank" rel="noopener noreferrer">
                                  Ver Documento
                                </a>
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>

                      <Button variant="outline" size="sm" onClick={() => handleDelete(doc.id)}>
                        <TrashIcon className="h-4 w-4 text-destructive" />
                        <span className="sr-only">Eliminar</span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
