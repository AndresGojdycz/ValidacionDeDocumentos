"use server"

import { revalidatePath } from "next/cache"
import { del } from "@vercel/blob"
import crypto from "crypto"

// Update the documents array type to include documentType and year
let documents: {
  id: string
  name: string
  url: string
  uploadedAt: string
  isValid: boolean
  validationMessage?: string
  documentType?: string
  companyType?: string
  documentYear?: number
}[] = []

let selectedCompanyType: "regular" | "agricultural" | "new" | null = null

export async function setCompanyType(type: "regular" | "agricultural" | "new") {
  selectedCompanyType = type
  revalidatePath("/")
  return { success: true }
}

export async function getCompanyType() {
  return selectedCompanyType
}

export async function resetCompanyType() {
  selectedCompanyType = null
  revalidatePath("/")
  return { success: true }
}

// Helper function to extract year from document content
function extractYearFromContent(content: string, fileName: string): number | null {
  const currentYear = new Date().getFullYear()
  const yearPattern = /\b(20\d{2})\b/g
  const matches = [...content.matchAll(yearPattern), ...fileName.matchAll(yearPattern)]

  if (matches.length === 0) return null

  // Get the most recent year that's not in the future
  const years = matches
    .map((match) => Number.parseInt(match[1]))
    .filter((year) => year >= 2020 && year <= currentYear)
    .sort((a, b) => b - a)

  return years.length > 0 ? years[0] : null
}

// Helper function to check year consistency
function checkYearConsistency(): { isConsistent: boolean; message?: string; expectedYear?: number } {
  const financialStatements = documents.filter((doc) => doc.documentType === "Financial Statement" && doc.isValid)
  const dicoseDocuments = documents.filter((doc) => doc.documentType === "DICOSE" && doc.isValid)

  if (financialStatements.length === 0 && dicoseDocuments.length === 0) {
    return { isConsistent: true }
  }

  const allYears = [
    ...financialStatements.map((doc) => doc.documentYear),
    ...dicoseDocuments.map((doc) => doc.documentYear),
  ].filter((year) => year !== null && year !== undefined) as number[]

  if (allYears.length === 0) {
    return { isConsistent: true }
  }

  const uniqueYears = [...new Set(allYears)]

  if (uniqueYears.length > 1) {
    return {
      isConsistent: false,
      message: `Year mismatch detected. Found documents for years: ${uniqueYears.join(", ")}. All financial statements and DICOSE must be for the same year.`,
      expectedYear: uniqueYears[0],
    }
  }

  return { isConsistent: true, expectedYear: uniqueYears[0] }
}

export async function validateDocument(url: string, fileName: string) {
  try {
    // Fetch the document content
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error("Failed to fetch document for validation")
    }

    // Get file extension and content
    const fileExtension = fileName.split(".").pop()?.toLowerCase()

    // Simulate validation delay
    await new Promise((resolve) => setTimeout(resolve, 1500))

    let isValid = true
    let validationMessage = ""
    let documentType = "Unknown"
    let documentYear: number | null = null

    // Check if file format is supported
    if (!["pdf", "doc", "docx", "txt"].includes(fileExtension || "")) {
      isValid = false
      validationMessage = "Unsupported file format. Please upload PDF, DOC, DOCX, or TXT files."

      const id = crypto.randomUUID()
      const document = {
        id,
        name: fileName,
        url,
        uploadedAt: new Date().toISOString(),
        isValid,
        validationMessage,
        documentType,
        companyType: selectedCompanyType,
        documentYear,
      }
      documents.push(document)
      revalidatePath("/")

      return {
        success: true,
        isValid,
        message: validationMessage,
        document,
      }
    }

    // Get document content for analysis
    let content = ""
    if (fileExtension === "txt") {
      content = await response.text()
    } else {
      // For PDF/DOC files, we'll analyze the filename and simulate content analysis
      content = fileName.toLowerCase()
    }

    // Extract year from content
    documentYear = extractYearFromContent(content, fileName)

    // Enhanced validation for financial documents and company-specific documents
    const cashflowKeywords = [
      "cashflow",
      "cash flow",
      "cash-flow",
      "projected cashflow",
      "cash projection",
      "operating activities",
      "investing activities",
      "financing activities",
      "net cash flow",
      "cash receipts",
      "cash payments",
      "cash position",
    ]

    const financialStatementKeywords = [
      "financial statement",
      "balance sheet",
      "income statement",
      "profit and loss",
      "p&l",
      "statement of financial position",
      "assets",
      "liabilities",
      "equity",
      "revenue",
      "expenses",
      "net income",
      "comprehensive income",
      "retained earnings",
    ]

    const accountantDeclarationKeywords = [
      "accountant declaration",
      "accountant statement",
      "cpa declaration",
      "certified public accountant",
      "auditor declaration",
      "professional opinion",
      "accountant certification",
      "financial review",
      "compilation report",
      "certified by",
      "prepared by cpa",
      "accountant signature",
    ]

    // Agricultural company specific documents
    const dicoseKeywords = [
      "dicose",
      "registro dicose",
      "declaración dicose",
      "certificado dicose",
      "documento dicose",
      "dicose certificate",
      "agricultural registration",
    ]

    const detaKeywords = [
      "deta",
      "declaración deta",
      "registro deta",
      "certificado deta",
      "documento deta",
      "deta certificate",
      "agricultural declaration",
    ]

    // Check document type based on content and filename
    const contentLower = content.toLowerCase()
    const fileNameLower = fileName.toLowerCase()

    // Check for agricultural-specific documents first
    if (dicoseKeywords.some((keyword) => contentLower.includes(keyword)) || fileNameLower.includes("dicose")) {
      documentType = "DICOSE"

      if (selectedCompanyType !== "agricultural" && selectedCompanyType !== "new") {
        isValid = false
        validationMessage =
          "DICOSE documents are only required for agricultural companies and new companies. Please select the correct company type."
      } else {
        // Validate DICOSE document content and year
        if (!documentYear) {
          isValid = false
          validationMessage =
            "DICOSE document must include a specific year. Please ensure the document clearly indicates the year it corresponds to."
        } else if (fileExtension === "txt" && content.length < 50) {
          isValid = false
          validationMessage =
            "DICOSE document appears to be incomplete. Please provide a complete DICOSE registration document."
        } else {
          // Check year consistency with existing documents
          const yearCheck = checkYearConsistency()
          if (!yearCheck.isConsistent) {
            isValid = false
            validationMessage = `DICOSE year (${documentYear}) does not match existing financial statements. ${yearCheck.message}`
          }
        }
      }
    } else if (detaKeywords.some((keyword) => contentLower.includes(keyword)) || fileNameLower.includes("deta")) {
      documentType = "DETA"

      if (selectedCompanyType !== "agricultural") {
        isValid = false
        validationMessage =
          "DETA documents are only required for agricultural companies. Please select the correct company type."
      } else {
        // Enhanced validation for DETA document content
        const cashflowOpinionKeywords = [
          "cashflow opinion",
          "cash flow opinion",
          "projected cashflow opinion",
          "opinion on cashflow",
          "opinion on cash flow",
          "cashflow analysis",
          "cash flow analysis",
          "cashflow assessment",
          "projected cash flow assessment",
        ]

        const creditOpinionKeywords = [
          "credit application opinion",
          "overall opinion",
          "credit opinion",
          "application opinion",
          "overall assessment",
          "credit assessment",
          "final opinion",
          "recommendation",
          "credit recommendation",
          "overall recommendation",
        ]

        const hasCashflowOpinion = cashflowOpinionKeywords.some((keyword) => contentLower.includes(keyword))
        const hasCreditOpinion = creditOpinionKeywords.some((keyword) => contentLower.includes(keyword))

        if (!hasCashflowOpinion && !hasCreditOpinion) {
          isValid = false
          validationMessage =
            "DETA document must include both an opinion on the projected cashflow and an overall opinion on the credit application. Both opinions are missing."
        } else if (!hasCashflowOpinion) {
          isValid = false
          validationMessage =
            "DETA document is missing an opinion on the projected cashflow. Please include an assessment of the cashflow projections."
        } else if (!hasCreditOpinion) {
          isValid = false
          validationMessage =
            "DETA document is missing an overall opinion on the credit application. Please include a final recommendation or assessment."
        } else if (fileExtension === "txt" && content.length < 100) {
          isValid = false
          validationMessage =
            "DETA document appears to be incomplete. Please provide a comprehensive DETA declaration with detailed opinions on both the cashflow and credit application."
        }
      }
    } else if (cashflowKeywords.some((keyword) => contentLower.includes(keyword))) {
      documentType = "Projected Cashflow"

      // Specific validation for cashflow documents
      const requiredCashflowElements = ["operating", "investing", "financing", "cash"]

      const missingElements = requiredCashflowElements.filter((element) => !contentLower.includes(element))

      if (missingElements.length > 2) {
        isValid = false
        validationMessage = `Cashflow document is missing key elements: ${missingElements.join(", ")}. Please ensure the document includes operating, investing, and financing activities.`
      } else if (fileExtension === "txt" && content.length < 100) {
        isValid = false
        validationMessage =
          "Cashflow document appears to be incomplete. Please provide a detailed projected cashflow statement."
      }
    } else if (financialStatementKeywords.some((keyword) => contentLower.includes(keyword))) {
      documentType = "Financial Statement"

      // Specific validation for financial statements
      const requiredFinancialElements = ["assets", "liabilities", "revenue", "expenses"]

      const missingElements = requiredFinancialElements.filter((element) => !contentLower.includes(element))

      if (missingElements.length > 2) {
        isValid = false
        validationMessage = `Financial statement is missing key elements: ${missingElements.join(", ")}. Please ensure the document includes assets, liabilities, revenue, and expenses.`
      } else if (fileExtension === "txt" && content.length < 150) {
        isValid = false
        validationMessage =
          "Financial statement appears to be incomplete. Please provide a comprehensive financial statement."
      } else {
        // Check year consistency for financial statements
        if (documentYear && (selectedCompanyType === "agricultural" || selectedCompanyType === "new")) {
          const yearCheck = checkYearConsistency()
          if (!yearCheck.isConsistent) {
            isValid = false
            validationMessage = `Financial statement year (${documentYear}) does not match existing DICOSE documents. ${yearCheck.message}`
          }
        }

        // For new companies, check if we need multiple financial statements
        if (selectedCompanyType === "new") {
          const existingFinancialStatements = documents.filter(
            (doc) => doc.documentType === "Financial Statement" && doc.isValid,
          ).length

          if (existingFinancialStatements >= 3) {
            isValid = false
            validationMessage =
              "New companies can only upload up to 3 financial statements. You have already uploaded the maximum number."
          }
        }
      }
    } else if (accountantDeclarationKeywords.some((keyword) => contentLower.includes(keyword))) {
      documentType = "Accountant Declaration"

      // Specific validation for accountant declarations
      const requiredDeclarationElements = ["certified", "declaration", "accountant"]

      const missingElements = requiredDeclarationElements.filter((element) => !contentLower.includes(element))

      if (missingElements.length > 1) {
        isValid = false
        validationMessage = `Accountant declaration is missing required elements: ${missingElements.join(", ")}. Please ensure the document is properly certified by a qualified accountant.`
      } else if (fileExtension === "txt" && content.length < 50) {
        isValid = false
        validationMessage =
          "Accountant declaration appears to be incomplete. Please provide a complete declaration from a certified accountant."
      }
    } else {
      // Document doesn't match any required type
      isValid = false
      let requiredDocs = ""

      switch (selectedCompanyType) {
        case "agricultural":
          requiredDocs = "Projected Cashflow, Financial Statement, Accountant Declaration, DICOSE, or DETA"
          break
        case "new":
          requiredDocs = "Financial Statement (up to 3), Accountant Declaration, or DICOSE"
          break
        default:
          requiredDocs = "Projected Cashflow, Financial Statement, or Accountant Declaration"
      }

      validationMessage = `Document type not recognized. Please upload one of the following: ${requiredDocs}. Ensure the document title and content clearly indicate the document type.`
    }

    // Additional file format specific checks
    if (isValid && fileExtension === "pdf") {
      // Simulate PDF structure validation
      const pdfValidation = Math.random() > 0.1 // 90% success rate for valid documents
      if (!pdfValidation) {
        isValid = false
        validationMessage = `${documentType} PDF file appears to be corrupted or improperly formatted.`
      }
    }

    // Store the document in our "database"
    const id = crypto.randomUUID()
    const document = {
      id,
      name: fileName,
      url,
      uploadedAt: new Date().toISOString(),
      isValid,
      validationMessage: isValid ? undefined : validationMessage,
      documentType,
      companyType: selectedCompanyType,
      documentYear,
    }

    documents.push(document)

    // Revalidate the documents list
    revalidatePath("/")

    return {
      success: true,
      isValid,
      message: validationMessage,
      document,
    }
  } catch (error) {
    console.error("Validation error:", error)
    return {
      success: false,
      isValid: false,
      message: error instanceof Error ? error.message : "An error occurred during validation",
    }
  }
}

export async function getDocuments() {
  // In a real application, you would fetch from a database
  return [...documents].sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
}

export async function deleteDocument(id: string) {
  const document = documents.find((doc) => doc.id === id)

  if (document) {
    try {
      // Extract the blob pathname from the URL
      const url = new URL(document.url)
      const pathname = url.pathname.substring(1) // Remove leading slash

      // Delete from Vercel Blob
      await del(pathname)

      // Remove from our "database"
      documents = documents.filter((doc) => doc.id !== id)

      // Revalidate the documents list
      revalidatePath("/")

      return { success: true }
    } catch (error) {
      console.error("Delete error:", error)
      throw new Error("Failed to delete document")
    }
  } else {
    throw new Error("Document not found")
  }
}
