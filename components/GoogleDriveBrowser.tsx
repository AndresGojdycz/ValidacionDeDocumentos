"use client";

import { useState, useEffect } from "react";
import { useSession, signIn } from "next-auth/react";
import {
  listGoogleDriveFolders,
  listFilesInFolder,
  getGoogleDriveFileContent,
  // validateDocument, // We'll need to adapt this
} from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FolderIcon, FileTextIcon, ChevronRightIcon, AlertTriangleIcon, RefreshCwIcon } from "lucide-react";
import { toast } from "sonner";

interface DriveItem {
  id: string;
  name: string;
  mimeType?: string | null;
  webViewLink?: string | null;
}

interface DriveFolder extends DriveItem {}
interface DriveFile extends DriveItem {}

export default function GoogleDriveBrowser() {
  const { data: session, status } = useSession();
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [currentPath, setCurrentPath] = useState<{ id: string; name: string }[]>([{ id: "root", name: "Google Drive" }]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<any>(null); // To display validation output

  const currentFolderId = currentPath[currentPath.length - 1].id;

  const handleAuthenticationError = (actionError: any) => {
    if (actionError?.needsReAuth) {
      toast.error("Error de autenticación con Google Drive. Por favor, ingrese de nuevo.", {
        action: { label: "Ingresar", onClick: () => signIn("google") },
      });
      setError("Fallo de autenticación. Por favor, ingrese de nuevo.");
    } else {
      const errorMessage = actionError?.error || "Ocurrió un error desconocido.";
      toast.error(errorMessage);
      setError(errorMessage);
    }
  };

  const loadFoldersAndFiles = async (folderId: string) => {
    if (!session) return;
    setIsLoading(true);
    setError(null);
    setValidationResult(null);
    try {
      const [folderResult, fileResult] = await Promise.all([
        listGoogleDriveFolders(folderId === "root" ? undefined : folderId),
        listFilesInFolder(folderId),
      ]);

      if (folderResult.error) {
        handleAuthenticationError(folderResult);
        setFolders([]);
      } else {
        setFolders(
          (folderResult.folders || []).filter(f => f.id && f.name).map(f => ({ ...f, id: f.id!, name: f.name! }))
        );
      }

      if (fileResult.error) {
        handleAuthenticationError(fileResult);
        setFiles([]);
      } else {
        setFiles(
          (fileResult.files || []).filter(f => f.id && f.name).map(f => ({ ...f, id: f.id!, name: f.name! }))
        );
      }
    } catch (e: any) {
      const errorMessage = "Error cargando archivos de Drive: " + e.message;
      toast.error(errorMessage);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (session && status === "authenticated") {
      loadFoldersAndFiles(currentFolderId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, status, currentFolderId]);

  const handleFolderClick = (folder: DriveFolder) => {
    setCurrentPath([...currentPath, { id: folder.id, name: folder.name }]);
  };

  const handleBreadcrumbClick = (index: number) => {
    setCurrentPath(currentPath.slice(0, index + 1));
  };

  const handleValidateFile = async (file: DriveFile) => {
    if (!file.id || !file.name) {
      toast.error("Información de archivo inválida.");
      return;
    }
    setIsValidating(true);
    setValidationResult(null);
    toast.info(`Procesando archivo desde Drive: ${file.name}...`);

    try {
      const contentResult = await getGoogleDriveFileContent(file.id);
      if (contentResult.error || !contentResult.content || !contentResult.name) {
        handleAuthenticationError(contentResult);
        setIsValidating(false);
        return;
      }

      // Placeholder for calling the adapted validateDocument
      // This will need to be uncommented and `validateDocument` adapted
      // For now, we just log and set a mock result.
      console.log("Validating from Drive:", { fileName: contentResult.name, contentPreview: contentResult.content.substring(0,100)});
      // const validationResponse = await validateDocumentFromContent(
      //   contentResult.content,
      //   contentResult.name,
      //   // You'll need to pass companyType and maxEndeudamiento if they are relevant
      //   // This might require lifting state or passing props
      // );
      
      // Simulate an async validation call
      await new Promise(resolve => setTimeout(resolve, 1000));
      const mockValidation = {
        success: true,
        message: `Simulación: ${contentResult.name} parece válido. (Contenido procesado)`,
        isValid: Math.random() > 0.5,
        document: { name: contentResult.name, type: "Balance", year: 2023, validatedAt: new Date().toISOString() }
      };
      setValidationResult(mockValidation);

      if (mockValidation.success) {
        toast.success(mockValidation.message);
      } else {
        toast.error(mockValidation.message || `Error validando ${contentResult.name}`);
      }

    } catch (e: any) {
      const errorMessage = "Error durante la validación: " + e.message;
      toast.error(errorMessage);
      setError(errorMessage);
    } finally {
      setIsValidating(false);
    }
  };

  if (status === "loading") {
    return <Card className="mt-6"><CardHeader><CardTitle className="text-brou-blue">Cargando Explorador de Drive...</CardTitle></CardHeader><CardContent><p>Verificando sesión...</p></CardContent></Card>;
  }

  if (status === "unauthenticated") {
    return (
      <Card className="mt-6 bg-brou-white shadow-lg">
        <CardHeader>
          <CardTitle className="text-brou-blue">Explorador de Google Drive</CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <p className="mb-4">Por favor, ingrese con Google para explorar sus archivos de Drive.</p>
          <Button onClick={() => signIn("google")} className="bg-brou-blue hover:bg-brou-blue/90 text-brou-white">
            Ingresar con Google
          </Button>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className="mt-6 bg-brou-white shadow-lg">
      <CardHeader>
        <div className="flex justify-between items-center">
            <CardTitle className="text-brou-blue">Explorador de Google Drive</CardTitle>
            <Button variant="outline" size="icon" onClick={() => loadFoldersAndFiles(currentFolderId)} disabled={isLoading || !session} title="Refrescar">
                <RefreshCwIcon className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
        </div>
        <div className="text-sm text-slate-600 mt-2 flex items-center flex-wrap gap-1">
          {currentPath.map((p, index) => (
            <div key={p.id} className="flex items-center">
              <button 
                onClick={() => handleBreadcrumbClick(index)} 
                disabled={isLoading}
                className={`hover:underline disabled:opacity-50 ${index === currentPath.length -1 ? 'font-semibold text-brou-blue' : 'text-slate-700'}`}
              >
                {p.name}
              </button>
              {index < currentPath.length - 1 && <ChevronRightIcon className="h-4 w-4 mx-1 text-slate-500" />}
            </div>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading && <p className="text-center py-4 text-slate-600">Cargando elementos de Drive...</p>}
        {error && 
            <div className="text-red-600 bg-red-100 border border-red-300 p-3 rounded-md flex items-start gap-2 my-2">
                <AlertTriangleIcon className="h-5 w-5 shrink-0 mt-0.5"/> 
                <div className="flex-grow">
                    <p className="font-semibold">Error al acceder a Google Drive</p>
                    <p className="text-sm">{error}</p>
                </div>
            </div>
        }
        {!isLoading && !error && folders.length === 0 && files.length === 0 && (
          <p className="text-center py-4 text-slate-500">Esta carpeta está vacía.</p>
        )}
        {!isLoading && !error && (folders.length > 0 || files.length > 0) && (
          <div className="space-y-2 mt-2">
            {folders.map((folder) => (
              <div 
                key={folder.id} 
                onClick={() => !isLoading && handleFolderClick(folder)}
                className={`flex items-center gap-3 p-2 rounded-md border ${isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-100 cursor-pointer hover:border-slate-300'}`}
              >
                <FolderIcon className="h-5 w-5 text-brou-yellow shrink-0" />
                <span className="truncate">{folder.name}</span>
              </div>
            ))}
            {files.map((file) => (
              <div key={file.id} className="flex items-center justify-between gap-3 p-2 rounded-md border hover:bg-slate-50">
                <div className="flex items-center gap-3 overflow-hidden">
                    <FileTextIcon className="h-5 w-5 text-slate-600 shrink-0" />
                    <span className="truncate" title={file.name}>{file.name}</span>
                </div>
                <Button 
                    size="sm" 
                    onClick={() => handleValidateFile(file)} 
                    disabled={isValidating || isLoading || !file.id || !file.name} 
                    className="bg-brou-blue hover:bg-brou-blue/90 text-brou-white shrink-0"
                 >
                  {isValidating ? "Procesando..." : "Procesar"}
                </Button>
              </div>
            ))}
          </div>
        )}
        {validationResult && (
            <Card className="mt-4 bg-slate-50">
                <CardHeader><CardTitle className="text-sm text-slate-700">Resultado del Procesamiento</CardTitle></CardHeader>
                <CardContent className="text-xs">
                    <p><strong>Archivo:</strong> {validationResult.document?.name}</p>
                    <p><strong>Mensaje:</strong> {validationResult.message}</p>
                    <p><strong>¿Válido?:</strong> {validationResult.isValid ? "Sí" : "No"}</p>
                </CardContent>
            </Card>
        )}
      </CardContent>
    </Card>
  );
} 