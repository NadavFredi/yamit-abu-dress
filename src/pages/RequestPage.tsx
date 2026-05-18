import { useCallback, useEffect, useMemo, useState } from "react";
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
import { LeadInfoHeader } from "@/components/LeadInfoHeader";
import { MissingRecordIdScreen } from "@/components/MissingRecordIdScreen";
import { MissingWebhookScreen } from "@/components/MissingWebhookScreen";
import { LoadFailedScreen } from "@/components/LoadFailedScreen";
import { LeadNotFoundScreen } from "@/components/LeadNotFoundScreen";

import { fetchLeadContext } from "@/services/leadContextService";
import { fetchDressReservations } from "@/services/dressReservationsService";
import { submitNewDress } from "@/services/addDressService";
import { appConfig } from "@/lib/appConfig";
import { validateSubmission } from "@/lib/validation";
import { buildWebhookPayload, submitToWebhook } from "@/lib/webhook";
import type {
  Dress,
  DressSelection,
  LeadUser,
  OrderLine,
  ValidationError,
} from "@/types/domain";

const emptySelection = (): DressSelection => ({
  dressId: "",
  startDate: "",
  endDate: "",
  quantity: 1,
  notes: "",
});

export function RequestPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const recordId = (searchParams.get("record_id") ?? "").trim();

  const submitWebhookUrl = appConfig.webhooks.submitUrl;
  const dressesWebhookUrl = appConfig.webhooks.dressesUrl;
  const reservationsWebhookUrl = appConfig.webhooks.reservationsUrl;

  const [user, setUser] = useState<LeadUser | null>(null);
  const [dresses, setDresses] = useState<Dress[]>([]);
  const [reservations, setReservations] = useState<Map<string, OrderLine[]>>(
    new Map()
  );
  const [loadingDressIds, setLoadingDressIds] = useState<Set<string>>(
    new Set()
  );
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [loadKey, setLoadKey] = useState(0);
  const [selections, setSelections] = useState<DressSelection[]>([
    emptySelection(),
  ]);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const handleAddDress = useCallback(
    async (suggestedName: string) => {
      const name = suggestedName.trim();
      if (!name) {
        toast.error("יש להזין שם שמלה לפני ההוספה.");
        return;
      }
      const existing = dresses.find(
        (d) => d.name.trim().toLowerCase() === name.toLowerCase()
      );
      if (existing) {
        toast.info(`השמלה "${name}" כבר קיימת ברשימה.`);
        return;
      }
      const now = new Date();
      try {
        const result = await submitNewDress(appConfig.webhooks.addDressUrl, {
          dress_name: name,
          submission_timestamp: now.toISOString(),
          submission_timestamp_local: now.toString(),
          timezone:
            Intl.DateTimeFormat().resolvedOptions().timeZone ?? "unknown",
          source: "yamit-abu-dress-website",
          customer_record_id: recordId || null,
          customer: user,
          submitted_by: appConfig.auth.username,
          page_url:
            typeof window !== "undefined" ? window.location.href : null,
          user_agent:
            typeof navigator !== "undefined" ? navigator.userAgent : null,
          language:
            typeof navigator !== "undefined" ? navigator.language : null,
        });
        setDresses((prev) => {
          if (prev.some((d) => d.id === result.id)) return prev;
          return [
            ...prev,
            {
              id: result.id,
              name: result.name ?? name,
              inventory:
                result.inventory === undefined ? null : result.inventory,
              imageUrl: result.imageUrl,
            },
          ];
        });
        toast.success(`השמלה "${name}" נוספה לרשימה.`);
      } catch (err) {
        const message = err instanceof Error ? err.message : "שגיאה לא ידועה.";
        toast.error(`הוספת השמלה נכשלה: ${message}`);
      }
    },
    [recordId, user, dresses]
  );

  useEffect(() => {
    if (
      !recordId ||
      !submitWebhookUrl ||
      !dressesWebhookUrl ||
      !reservationsWebhookUrl
    ) {
      setLoading(false);
      return;
    }
    let mounted = true;
    setLoading(true);
    setLoadError(false);
    fetchLeadContext(dressesWebhookUrl, recordId)
      .then((ctx) => {
        if (!mounted) return;
        setUser(ctx.user);
        setDresses(ctx.dresses);
      })
      .catch((err) => {
        if (!mounted) return;
        console.error("Failed to load lead context", err);
        setLoadError(true);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [recordId, submitWebhookUrl, dressesWebhookUrl, reservationsWebhookUrl, loadKey]);

  const ensureReservations = useCallback(
    async (dressId: string, dressName: string) => {
      if (!reservationsWebhookUrl) return;
      setReservations((prevMap) => {
        if (prevMap.has(dressId)) return prevMap;
        setLoadingDressIds((prevLoading) => {
          if (prevLoading.has(dressId)) return prevLoading;
          const nextLoading = new Set(prevLoading);
          nextLoading.add(dressId);
          fetchDressReservations(reservationsWebhookUrl, dressId, dressName)
            .then((lines) => {
              setReservations((m) => {
                const next = new Map(m);
                next.set(dressId, lines);
                return next;
              });
            })
            .catch((err) => {
              console.error("Failed to load dress reservations", err);
              toast.error("טעינת זמינות השמלה נכשלה. אנא נסו שוב.");
            })
            .finally(() => {
              setLoadingDressIds((s) => {
                const next = new Set(s);
                next.delete(dressId);
                return next;
              });
            });
          return nextLoading;
        });
        return prevMap;
      });
    },
    [reservationsWebhookUrl]
  );

  const allReservations = useMemo(() => {
    const flat: OrderLine[] = [];
    for (const lines of reservations.values()) flat.push(...lines);
    return flat;
  }, [reservations]);

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

  if (!submitWebhookUrl || !dressesWebhookUrl || !reservationsWebhookUrl) {
    return <MissingWebhookScreen />;
  }

  if (loadError) {
    return <LoadFailedScreen onRetry={() => setLoadKey((k) => k + 1)} />;
  }

  if (!loading && user === null) {
    return <LeadNotFoundScreen />;
  }

  const updateRow = (index: number, next: DressSelection) => {
    setSelections((prev) => {
      const previousDressId = prev[index]?.dressId;
      const updated = prev.map((row, i) => (i === index ? next : row));
      if (next.dressId && next.dressId !== previousDressId) {
        const dress = dresses.find((d) => d.id === next.dressId);
        if (dress) {
          void ensureReservations(dress.id, dress.name);
        }
      }
      return updated;
    });
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
      allReservations,
      dresses
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
      await submitToWebhook(submitWebhookUrl, payload);
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
    <div className="min-h-screen bg-muted/30 py-3 sm:py-8">
      <div className="mx-auto w-full max-w-6xl px-3 sm:px-4">
        {user && <LeadInfoHeader user={user} />}
        <Card className="rounded-lg sm:rounded-xl">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-xl leading-tight sm:text-2xl">
              בקשת השכרת שמלות
            </CardTitle>
            <CardDescription className="leading-relaxed">
              אנא בחרו את השמלות הרצויות וציינו את תאריכי ההשכרה. לאחר השליחה,
              ניצור איתכם קשר לאישור.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
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
                      orderLines={allReservations}
                      isReservationsLoading={
                        Boolean(row.dressId) && loadingDressIds.has(row.dressId)
                      }
                      errors={errorsByIndex.get(index) ?? []}
                      canRemove={selections.length > 1}
                      onChange={(next) => updateRow(index, next)}
                      onRemove={() => removeRow(index)}
                      onAddDress={handleAddDress}
                    />
                  ))}
                </div>

                <div className="grid gap-3 pt-2 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addRow}
                    className="w-full sm:w-auto"
                  >
                    <Plus className="h-4 w-4" />
                    הוספת שמלה נוספת
                  </Button>

                  <Button
                    type="submit"
                    disabled={submitting}
                    className="w-full sm:w-auto"
                  >
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
