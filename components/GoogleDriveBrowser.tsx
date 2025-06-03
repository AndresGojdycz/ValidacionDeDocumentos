"use client";

import { useState, useEffect } from "react";
import { useSession, signIn } from "next-auth/react";
import {
  listGoogleDriveFolders,
  listFilesInFolder,
  getGoogleDriveFileContent,
  validateDocument,
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

interface GoogleDriveBrowserProps {
  onUploadComplete: () => void;
  companyType: "regular" | "agricultural" | "new" | null;
  maximoEndeudamiento: number | null;
  plazoDeudaAnos: number | null;
  disabled?: boolean;
}

export default function GoogleDriveBrowser({ onUploadComplete, companyType, maximoEndeudamiento, plazoDeudaAnos, disabled }: GoogleDriveBrowserProps) {
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

    // Ensure companyType and maximoEndeudamiento are set before proceeding with validation
    // These are passed as props now, but the server actions will read them from server-side state
    // which should have been set by the FinancialDashboard component prior to this.
    // We include them here to emphasize dependency, but the actual server actions pick them up from server-side state.
    console.log("Processing with company type:", companyType, 
                "and maximo endeudamiento:", maximoEndeudamiento,
                "and plazo deuda anos:", plazoDeudaAnos);

    try {
      const contentResult = await getGoogleDriveFileContent(file.id);
      if (contentResult.error || !contentResult.content || !contentResult.name) {
        handleAuthenticationError(contentResult);
        setIsValidating(false);
        return;
      }

      // For now, we just log and set a mock result.
      console.log("Validating from Drive:", { fileName: contentResult.name, contentPreview: contentResult.content.substring(0,100)});
      
      // Convert content string to a File object to send to /api/upload
      const driveFile = new File([contentResult.content], contentResult.name, {
        type: contentResult.mimeType || "application/octet-stream", // Attempt to use original mimeType or fallback
      });

      const formData = new FormData();
      formData.append("file", driveFile);

      const uploadResponse = await fetch(`/api/upload?filename=${encodeURIComponent(driveFile.name)}`, {
        method: "POST",
        body: formData,
      });

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json();
        throw new Error(errorData.error || "Upload to server failed from Drive file");
      }

      const blob = await uploadResponse.json();

      // Now call the actual validateDocument server action
      console.log("[GoogleDriveBrowser] Plazo a usar para validación (prop):", plazoDeudaAnos);
      const validationResponse = await validateDocument(blob.url, driveFile.name, plazoDeudaAnos);

      setValidationResult(validationResponse);

      if (validationResponse.success && validationResponse.isValid) {
        toast.success(validationResponse.message || `Archivo ${driveFile.name} validado correctamente.`);
        onUploadComplete(); // Call the callback to refresh document lists
      } else {
        toast.error(validationResponse.message || `Error validando ${driveFile.name}`);
        // Optionally call onUploadComplete even on failure if the list should refresh to show the invalid attempt
        if (validationResponse.success) { // successful call to validateDocument, but doc is invalid
            onUploadComplete();
        }
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
          <Button 
            onClick={() => signIn("google")} 
            className="bg-brou-blue hover:bg-brou-blue/90 text-brou-white"
            disabled={disabled}
          >
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
            <Button 
              variant="outline" 
              size="icon" 
              onClick={() => loadFoldersAndFiles(currentFolderId)} 
              disabled={isLoading || !session || disabled}
              title="Refrescar"
            >
                <RefreshCwIcon className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
        </div>
        <div className="text-sm text-slate-600 mt-2 flex items-center flex-wrap gap-1">
          {currentPath.map((p, index) => (
            <div key={p.id} className="flex items-center">
              <button 
                onClick={() => handleBreadcrumbClick(index)} 
                disabled={isLoading || disabled}
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
                onClick={() => !isLoading && !disabled && handleFolderClick(folder)}
                className={`flex items-center gap-3 p-2 rounded-md border ${isLoading || disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-100 cursor-pointer hover:border-slate-300'}`}
              >
                <FolderIcon className="h-5 w-5 text-brou-yellow shrink-0" />
                <span className="truncate">{folder.name}</span>
              </div>
            ))}
            {files.map((file) => (
              <div 
                key={file.id} 
                className={`flex items-center justify-between gap-3 p-2 rounded-md border ${isLoading || disabled ? 'opacity-50' : 'hover:bg-slate-100'}`}
              >
                <div className={`flex items-center gap-3 truncate ${isLoading || disabled ? 'cursor-not-allowed' : ''}`}>
                  <FileTextIcon className="h-5 w-5 text-brou-blue shrink-0" />
                  <span className="truncate">{file.name}</span>
                </div>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => handleValidateFile(file)} 
                  disabled={isValidating || isLoading || disabled}
                  className="bg-brou-secondary hover:bg-brou-secondary/90 text-brou-white text-xs h-7 px-2 whitespace-nowrap"
                >
                  {isValidating ? "Procesando..." : "Procesar"}
                </Button>
              </div>
            ))}
          </div>
        )}
        {validationResult && (
          <div className="mt-4 p-3 rounded-md bg-slate-50 border">
            <h4 className="font-semibold text-sm mb-1">Resultado de Validación (Drive):</h4>
            {validationResult.success ? (
              validationResult.isValid ? (
                <p className="text-sm text-green-600">✓ {validationResult.message || "Documento válido."}</p>
              ) : (
                <p className="text-sm text-red-600">✗ {validationResult.message || "Documento inválido."}</p>
              )
            ) : (
              <p className="text-sm text-red-600">✗ Error: {validationResult.message || "Falló la validación."}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
} 