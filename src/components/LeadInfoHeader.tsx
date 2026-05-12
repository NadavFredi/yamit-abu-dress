import { User, Phone } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { LeadUser } from "@/types/domain";

interface LeadInfoHeaderProps {
  user: LeadUser;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function formatPhoneForDisplay(phone: string): string {
  const trimmed = phone.trim();
  return trimmed.replace(/^\+972[\s-]?/, "0");
}

interface FieldProps {
  icon: typeof User;
  label: string;
  value: string;
  ltr?: boolean;
}

function Field({ icon: Icon, label, value, ltr }: FieldProps) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <span
        className="text-sm font-semibold text-foreground truncate"
        dir={ltr ? "ltr" : undefined}
      >
        {value}
      </span>
    </div>
  );
}

export function LeadInfoHeader({ user }: LeadInfoHeaderProps) {
  const name =
    readString(user.display_name) ?? readString(user.data?.full_name);
  const phone = readString(user.data?.phone);

  if (!name && !phone) return null;

  return (
    <Card className="mb-3 rounded-lg sm:mb-4 sm:rounded-xl">
      <CardContent className="p-4">
        <div
          className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
          dir="rtl"
        >
          {name && (
            <div className="min-w-0 self-start">
              <Field icon={User} label="שלום," value={name} />
            </div>
          )}
          {phone && (
            <div className="min-w-0 self-start sm:self-end">
              <Field
                icon={Phone}
                label="טלפון:"
                value={formatPhoneForDisplay(phone)}
                ltr
              />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
