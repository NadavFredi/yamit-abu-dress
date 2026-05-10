import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface LoadFailedScreenProps {
  onRetry: () => void;
}

export function LoadFailedScreen({ onRetry }: LoadFailedScreenProps) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-destructive">
            <AlertTriangle className="h-6 w-6" />
            טעינת השמלות נכשלה
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertDescription>
              לא הצלחנו לטעון את רשימת השמלות. אנא נסו שוב, ואם הבעיה נמשכת
              צרו קשר עם התמיכה.
            </AlertDescription>
          </Alert>
          <Button type="button" onClick={onRetry} className="w-full">
            <RefreshCw className="h-4 w-4" />
            נסו שוב
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
