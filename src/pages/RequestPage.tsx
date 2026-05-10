import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Plus, Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DressRow } from "@/components/DressRow";
import { MissingRecordIdScreen } from "@/components/MissingRecordIdScreen";
import { MissingWebhookScreen } from "@/components/MissingWebhookScreen";

import { dressesService } from "@/services/dressesService";
import { orderLinesService } from "@/services/orderLinesService";
import { validateSubmission } from "@/lib/validation";
import { buildWebhookPayload, submitToWebhook } from "@/lib/webhook";
import type {
  Dress,
  DressSelection,
  OrderLine,
  ValidationError,
} from "@/types/domain";

const emptySelection = (): DressSelection => ({
  dressId: "",
  startDate: "",
  endDate: "",
});

export function RequestPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const recordId = (searchParams.get("record_id") ?? "").trim();

  const webhookUrl = import.meta.env.VITE_MAKE_WEBHOOK_URL as
    | string
    | undefined;

  const [dresses, setDresses] = useState<Dress[]>([]);
  const [orderLines, setOrderLines] = useState<OrderLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [selections, setSelections] = useState<DressSelection[]>([
    emptySelection(),
  ]);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!recordId || !webhookUrl) {
      setLoading(false);
      return;
    }
    let mounted = true;
    Promise.all([
      dressesService.listDresses(),
      orderLinesService.listAllOrderLines(),
    ])
      .then(([d, ol]) => {
        if (!mounted) return;
        setDresses(d);
        setOrderLines(ol);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [recordId, webhookUrl]);

  const errorsByIndex = useMemo(() => {
    const map = new Map<number, ValidationError[]>();
    for (const err of errors) {
      if (typeof err.index === "number") {
        const list = map.get(err.index) ?? [];
        list.push(err);
        map.set(err.index, list);
      }
    }
    return map;
  }, [errors]);

  const formLevelErrors = errors.filter((e) => typeof e.index !== "number");

  if (!recordId) {
    return <MissingRecordIdScreen />;
  }

  if (!webhookUrl) {
    return <MissingWebhookScreen />;
  }

  const updateRow = (index: number, next: DressSelection) => {
    setSelections((prev) =>
      prev.map((row, i) => (i === index ? next : row))
    );
  };

  const removeRow = (index: number) => {
    setSelections((prev) => prev.filter((_, i) => i !== index));
  };

  const addRow = () => {
    setSelections((prev) => [...prev, emptySelection()]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = validateSubmission(
      { recordId, selections },
      orderLines
    );

    setErrors(result.errors);
    if (!result.ok) {
      toast.error("לא ניתן לשלוח את הבקשה. אנא בדקו את השדות המסומנים.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = buildWebhookPayload({
        recordId,
        selections,
        dresses,
        now: new Date(),
      });
      await submitToWebhook(webhookUrl, payload);
      navigate("/thank-you", {
        state: { summary: payload },
        replace: true,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "שגיאה לא ידועה.";
      toast.error(`שליחת הבקשה נכשלה: ${message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 py-8">
      <div className="container max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle>בקשת השכרת שמלות</CardTitle>
            <CardDescription>
              אנא בחרו את השמלות הרצויות וציינו את תאריכי ההשכרה. לאחר השליחה,
              ניצור איתכם קשר לאישור.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                טוען שמלות זמינות...
              </p>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                {formLevelErrors.length > 0 && (
                  <Alert variant="destructive">
                    <AlertDescription>
                      <ul className="space-y-1">
                        {formLevelErrors.map((e) => (
                          <li key={e.code}>{e.message}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                <div className="space-y-3">
                  {selections.map((row, index) => (
                    <DressRow
                      key={index}
                      index={index}
                      value={row}
                      dresses={dresses}
                      orderLines={orderLines}
                      errors={errorsByIndex.get(index) ?? []}
                      canRemove={selections.length > 1}
                      onChange={(next) => updateRow(index, next)}
                      onRemove={() => removeRow(index)}
                    />
                  ))}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addRow}
                  >
                    <Plus className="h-4 w-4" />
                    הוספת שמלה נוספת
                  </Button>

                  <Button type="submit" disabled={submitting}>
                    <Send className="h-4 w-4" />
                    {submitting ? "שולח..." : "שליחת הבקשה"}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
