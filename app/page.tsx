import { DocumentUploader } from "@/components/document-uploader"
import { DocumentList } from "@/components/document-list"
import { FinancialDashboard } from "@/components/financial-dashboard"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function Home() {
  return (
    <div className="container mx-auto py-10 space-y-10">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Mesa de Entrada</h1>
        <p className="text-muted-foreground">
          Cargue y valide sus documentos financieros requeridos según corresponda
        </p>
        <p className="text-muted-foreground">Para empresas que vienen por primera vez a OPYCR, se requieren los 3 ultimos balances con sus respectivas notas e informes</p>
      </div>

      <FinancialDashboard />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DocumentUploader />
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Requerimientos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium text-sm mb-2">Regular Companies:</h4>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span className="text-sm">
                      <strong>Projected Cashflow:</strong> Include operating, investing, and financing activities
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm">
                      <strong>Financial Statement:</strong> Must include assets, liabilities, revenue, and expenses
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                    <span className="text-sm">
                      <strong>Accountant Declaration:</strong> Certified statement from a qualified accountant
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-medium text-sm mb-2">Agricultural Companies:</h4>
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground mb-1">All regular company documents plus:</div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                    <span className="text-sm">
                      <strong>DICOSE:</strong> Agricultural registration (must match financial statement year)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    <span className="text-sm">
                      <strong>DETA:</strong> Agricultural declaration with cashflow and credit opinions
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-medium text-sm mb-2">New Companies:</h4>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-cyan-500 rounded-full"></div>
                    <span className="text-sm">
                      <strong>3 Financial Statements:</strong> Multiple years of financial data
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                    <span className="text-sm">
                      <strong>DICOSE:</strong> Registration document (must match financial statement year)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                    <span className="text-sm">
                      <strong>Accountant Declaration:</strong> Certified statement from a qualified accountant
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <DocumentList />
    </div>
  )
}
