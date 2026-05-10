import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

export function LeadNotFoundScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-destructive">
            <AlertTriangle className="h-6 w-6" />
            ליד לא נמצא
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertDescription>
              לא נמצאה רשומת לקוח עם המזהה שסופק. אנא צרו קשר עם התמיכה.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
