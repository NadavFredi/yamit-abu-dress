import { useState, type FormEvent } from "react";
import { useLocation, useNavigate, type Location } from "react-router-dom";
import { LogIn } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn } from "@/lib/auth";

type LocationState = { from?: Location } | null;

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const ok = signIn(username.trim(), password);
    if (!ok) {
      setSubmitting(false);
      setError("שם משתמש או סיסמה שגויים.");
      return;
    }

    const state = location.state as LocationState;
    const redirectTo =
      state?.from?.pathname && state.from.pathname !== "/login"
        ? `${state.from.pathname}${state.from.search ?? ""}`
        : "/";
    navigate(redirectTo, { replace: true });
  };

  return (
    <div className="min-h-screen bg-muted/30 py-8 flex items-center justify-center">
      <div className="container max-w-sm">
        <Card>
          <CardHeader>
            <CardTitle>כניסה למערכת</CardTitle>
            <CardDescription>אנא הזינו שם משתמש וסיסמה.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="username">שם משתמש</Label>
                <Input
                  id="username"
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">סיסמה</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <Button type="submit" className="w-full" disabled={submitting}>
                <LogIn className="h-4 w-4" />
                {submitting ? "מתחבר..." : "כניסה"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
