import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

export function MissingRecordIdScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-destructive">
            <AlertTriangle className="h-6 w-6" />
            לא ניתן להציג את הטופס
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertDescription>
              חסר מזהה לקוח בקישור. אנא פתחו את הקישור מתוך מערכת EasyFlow כדי
              למלא את הבקשה.
            </AlertDescription>
          </Alert>
          <p className="text-sm text-muted-foreground">
            אם הבעיה נמשכת, אנא צרו קשר עם התמיכה.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
