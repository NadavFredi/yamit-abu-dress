import { useNavigate, useLocation } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatIsoToDisplay } from "@/lib/datePickerRules";
import type { WebhookPayload } from "@/types/domain";

interface LocationState {
  summary?: WebhookPayload;
}

export function ThankYouPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as LocationState | null;
  const summary = state?.summary;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
      <Card className="w-full max-w-lg">
        <CardHeader className="items-center text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2 className="h-7 w-7 text-green-600" />
          </div>
          <CardTitle>הבקשה התקבלה בהצלחה</CardTitle>
          <p className="text-sm text-muted-foreground">
            ניצור איתך קשר בהקדם להמשך טיפול.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {summary && summary.selected_dresses.length > 0 && (
            <div className="rounded-lg border bg-muted/30 p-4">
              <h2 className="text-sm font-semibold mb-2">סיכום הבקשה</h2>
              <ul className="space-y-2">
                {summary.selected_dresses.map((d, i) => (
                  <li
                    key={`${d.dress_id}-${i}`}
                    className="flex flex-col text-sm"
                  >
                    <span className="font-medium">
                      {d.dress_name ?? d.dress_id}
                    </span>
                    <span className="text-muted-foreground">
                      {formatIsoToDisplay(d.start_date)} עד {formatIsoToDisplay(d.end_date)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex justify-center">
            <Button
              onClick={() => navigate(-1)}
              variant="outline"
            >
              חזרה להתחלה
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
