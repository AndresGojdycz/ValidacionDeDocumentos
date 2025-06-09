# "Mesa de Entrada" - Portal de Validación de Documentos con IA

[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js&logoColor=white)]()
[![React](https://img.shields.io/badge/React-19-blue?style=for-the-badge&logo=react&logoColor=61DAFB)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=for-the-badge&logo=typescript&logoColor=white)]()
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)]()
[![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4-4A4A4A?style=for-the-badge&logo=openai&logoColor=white)]()

"Mesa de Entrada" es un portal inteligente para la presentación y validación de documentos, diseñado para instituciones financieras. Automatiza el proceso de recolección y verificación de los documentos financieros requeridos a las empresas que solicitan créditos u otros productos.

La aplicación utiliza un sofisticado backend de IA para analizar el contenido de los documentos presentados en tiempo real, asegurando que cumplan con complejas reglas de negocio y requisitos. Esto reemplaza un proceso tradicionalmente lento y manual con un flujo de trabajo eficiente e impulsado por IA.

## Características Principales

- **Lista de Requisitos Dinámica**: Genera automáticamente una lista de los documentos requeridos basándose en el tipo de empresa del solicitante y sus necesidades financieras.
- **Análisis de Documentos con IA**: Utiliza los modelos de lenguaje grandes de OpenAI para:
  - Clasificar los documentos presentados (p. ej., Balance General, Estado de Flujo de Efectivo).
  - Extraer información clave y realizar validaciones basadas en el contenido.
  - Verificar estados financieros (p. ej., comprobando que `Activos = Pasivos + Patrimonio`).
  - Asegurar que se cumplan los requisitos específicos de cada documento (p. ej., la presencia de la opinión de un auditor).
- **Doble Opción de Carga**: Los usuarios pueden cargar documentos directamente desde su máquina local o seleccionarlos desde su Google Drive.
- **Feedback de Validación en Tiempo Real**: Proporciona retroalimentación inmediata sobre la validez de los documentos, con mensajes de error claros y un seguimiento del estado general.
- **Autenticación Segura**: Utiliza NextAuth.js con un proveedor de Google para una autenticación de usuario segura y la integración con Google Drive.
- **Stack Tecnológico Moderno**: Construido con Next.js 15, React 19, TypeScript y Tailwind CSS para una aplicación de alto rendimiento y fácil de mantener.

## Cómo Funciona

La aplicación guía al usuario a través de la presentación y validación de sus documentos financieros. El backend procesa estos documentos usando IA para asegurar que sean correctos y estén completos.

```mermaid
graph TD;
    subgraph "Navegador del Usuario"
        A[Frontend Next.js - React] --> B{Carga de Documento};
        A --> C{Selector de Google Drive};
        A --> D[Establecer Info de Empresa];
    end

    subgraph "Backend Next.js (en Vercel)"
        B --> E[Ruta API de Carga];
        C --> F[Server Action: Procesar Archivo de GDrive];
        D --> G[Server Action: Establecer Estado];

        E -- Archivo --> H[Vercel Blob Storage];
        F -- "ID de Archivo" --> I[Google Drive API];
        I -- "Contenido de Archivo" --> F;

        H -- URL --> J[Server Action: validateDocument];
        F -- Contenido --> J;

        subgraph "Núcleo de Validación con IA"
            J --> K{1. Clasificar Tipo de Documento};
            K --> L{2. Validar Contenido};
            L --> M{3. Cotejar con Requisitos};
        end

        K -- "Texto + Prompt" --> N[OpenAI API - GPT-4/o];
        L -- "Texto + Prompt" --> N;
        N -- "Respuesta JSON" --> K;
        N -- "Respuesta JSON" --> L;
        
        M --> O[Actualizar Estado del Servidor];
        O -- "Revalidar Ruta" --> A;
    end

    A -- Muestra --> P[Lista de Documentos y Estado de Validación];

    style A fill:#D6EAF8
    style N fill:#FADBD8
    style J fill:#D5F5E3
    style I fill:#FCF3CF
    style H fill:#E8DAEF
```

## Stack Tecnológico

- **Framework**: [Next.js](https://nextjs.org/)
- **Lenguaje**: [TypeScript](https://www.typescriptlang.org/)
- **UI**: [React](https://react.dev/), [Tailwind CSS](https://tailwindcss.com/), [shadcn/ui](https://ui.shadcn.com/)
- **IA**: [OpenAI API](https://openai.com/blog/openai-api)
- **Autenticación**: [NextAuth.js](https://next-auth.js.org/) (Proveedor de Google)
- **Almacenamiento de Archivos**: [Vercel Blob](https://vercel.com/storage/blob)
- **APIs Externas**: [Google Drive API](https://developers.google.com/drive)
- **Formularios**: [React Hook Form](https://react-hook-form.com/), [Zod](https://zod.dev/)

## Cómo Empezar

Sigue estos pasos para ejecutar el proyecto localmente.

### Prerrequisitos

- Node.js (v18 o posterior)
- `pnpm` (o `npm`/`yarn`)

### 1. Clona el Repositorio

```bash
git clone https://github.com/tu-usuario/document-validator.git
cd document-validator
```

### 2. Instala las Dependencias

Este proyecto usa `pnpm`.

```bash
pnpm install
```

### 3. Configura las Variables de Entorno

Crea un archivo `.env.local` en la raíz del proyecto copiando el archivo de ejemplo:

```bash
cp .env.example .env.local
```

Ahora, completa los valores requeridos en `.env.local`:

```
# Clave de API de OpenAI
# Obtenla de https://platform.openai.com/api-keys
OPENAI_API_KEY=tu_clave_de_api_de_openai

# OAuth de Google para NextAuth y la API de Google Drive
# Obtenlos de https://console.cloud.google.com/apis/credentials
GOOGLE_CLIENT_ID=tu_client_id_de_google
GOOGLE_CLIENT_SECRET=tu_client_secret_de_google

# Secreto de NextAuth
# Genera uno en https://generate-secret.vercel.app/32
NEXTAUTH_SECRET=una_cadena_muy_secreta
NEXTAUTH_URL=http://localhost:3000

# Token de Vercel Blob Storage
# Obtenlo del panel de tu proyecto en Vercel
BLOB_READ_WRITE_TOKEN=tu_token_de_lectura_escritura_de_blob
```

### 4. Detalles de Configuración

- **Google Cloud Console**:
  1. Crea un nuevo proyecto.
  2. Habilita la **API de Google Drive**.
  3. Ve a `APIs y Servicios` > `Credenciales` y crea **ID de cliente de OAuth 2.0**.
  4. Establece `Orígenes de JavaScript autorizados` en `http://localhost:3000`.
  5. Establece `URIs de redireccionamiento autorizados` en `http://localhost:3000/api/auth/callback/google`.
  6. Usa el Client ID y el Client Secret generados para tus variables de entorno.

- **Vercel Blob**:
  1. Crea un almacén de Blob desde el panel de tu proyecto en Vercel.
  2. Copia el `BLOB_READ_WRITE_TOKEN` en tu archivo `.env.local`.

### 5. Ejecuta el Servidor de Desarrollo

```bash
pnpm dev
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador para ver la aplicación.
