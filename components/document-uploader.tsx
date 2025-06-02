"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { FileIcon, UploadCloudIcon, CheckCircleIcon, AlertCircleIcon } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { validateDocument } from "@/app/actions"

interface DocumentUploaderProps {
  onUploadComplete: () => void;
}

export function DocumentUploader({ onUploadComplete }: DocumentUploaderProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [validationStatus, setValidationStatus] = useState<null | "validating" | "valid" | "invalid">(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const files = e.dataTransfer.files
    if (files.length > 0) {
      await handleFileUpload(files[0])
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      await handleFileUpload(files[0])
    }
  }

  const handleFileUpload = async (file: File) => {
    try {
      setIsUploading(true)
      setUploadProgress(0)
      setValidationStatus(null)
      setErrorMessage(null)

      // Validate file size (10MB limit)
      const maxSize = 10 * 1024 * 1024 // 10MB
      if (file.size > maxSize) {
        throw new Error("File size must be less than 10MB")
      }

      // Validate file type
      const allowedTypes = [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "text/plain",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      ]

      if (!allowedTypes.includes(file.type)) {
        throw new Error("Invalid file type. Please upload PDF, DOC, DOCX, TXT, XLS, or XLSX files.")
      }

      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 95) {
            clearInterval(progressInterval)
            return 95
          }
          return prev + 5
        })
      }, 100)

      // Create FormData and append the file
      const formData = new FormData()
      formData.append("file", file)

      // Upload to our API route with proper FormData
      const response = await fetch(`/api/upload?filename=${encodeURIComponent(file.name)}`, {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Upload failed")
      }

      const blob = await response.json()

      clearInterval(progressInterval)
      setUploadProgress(100)

      // Validate the document
      setValidationStatus("validating")
      const result = await validateDocument(blob.url, file.name)

      if (result.success && result.isValid) {
        setValidationStatus("valid")
        onUploadComplete()
      } else {
        setValidationStatus("invalid")
        setErrorMessage(result.message || "Document validation failed")
        if (result.success) {
          onUploadComplete()
        }
      }
    } catch (error) {
      console.error("Upload error:", error)
      setErrorMessage(error instanceof Error ? error.message : "An error occurred during upload")
      setValidationStatus("invalid")
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Cargar Documento</CardTitle>
        <CardDescription>
          Cargue sus documentos financieros (PDF, DOC, DOCX, TXT, XLS, XLSX - máximo 10MB). Los requisitos varían según el tipo de empresa: 
          Empresas regulares necesitan 3 documentos, Empresas agrícolas necesitan 5 documentos incluyendo DICOSE y DETA 
          (con opiniones de flujo de caja y crédito).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div
          className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors ${
            isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25"
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept=".pdf,.doc,.docx,.txt,.xls,.xlsx"
          />
          <div className="flex flex-col items-center gap-2">
            <UploadCloudIcon className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {isDragging ? "Suelte su archivo aquí" : "Arrastre y suelte su archivo aquí o haga clic para buscar"}
            </p>
            <p className="text-xs text-muted-foreground">
              Admite archivos PDF, DOC, DOCX, TXT, XLS, XLSX hasta 10MB. DETA debe incluir opiniones sobre flujo de caja proyectado y 
              solicitud de crédito.
            </p>
          </div>
        </div>

        {isUploading && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Cargando...</span>
              <span className="text-sm text-muted-foreground">{uploadProgress}%</span>
            </div>
            <Progress value={uploadProgress} className="h-2" />
          </div>
        )}

        {validationStatus === "validating" && (
          <div className="mt-4 flex items-center gap-2 text-amber-500">
            <FileIcon className="h-5 w-5" />
            <span>Validando documento...</span>
          </div>
        )}

        {validationStatus === "valid" && (
          <div className="mt-4 flex items-center gap-2 text-green-500">
            <CheckCircleIcon className="h-5 w-5" />
            <span>El documento es válido y ha sido agregado a su lista</span>
          </div>
        )}

        {validationStatus === "invalid" && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircleIcon className="h-5 w-5" />
              <span>La validación del documento falló</span>
            </div>
            {errorMessage && <p className="text-sm text-muted-foreground">{errorMessage}</p>}
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading || validationStatus === "validating"}
          className="w-full"
        >
          Seleccionar Documento
        </Button>
      </CardFooter>
    </Card>
  )
}
