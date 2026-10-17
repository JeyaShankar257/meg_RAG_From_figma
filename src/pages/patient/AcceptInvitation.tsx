import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import { api, type ApiError } from "../../lib/api/apiClient";

export default function AcceptInvitation({
  portal = "patient",
}: {
  portal?: "doctor" | "patient"
}) {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);
  const [token, setToken] = useState<string>("");
  const parsedRef = useRef(false);

  useEffect(() => {
    if (parsedRef.current) return;
    parsedRef.current = true;

    // Parse hash fragment
    const hash = window.location.hash.startsWith("#")
      ? window.location.hash.slice(1)
      : window.location.hash;
    const hashParams = new URLSearchParams(hash);
    const searchParams = new URLSearchParams(window.location.search);

    const hashError = hashParams.get("error") || searchParams.get("error");
    const hashErrorDesc =
      hashParams.get("error_description") || searchParams.get("error_description");
    const parsedToken =
      hashParams.get("access_token") || searchParams.get("access_token") || "";

    // Clear URL fragment from address bar for security
    if (window.location.hash) {
      try {
        window.history.replaceState(
          null,
          "",
          window.location.pathname + window.location.search,
        );
      } catch {
        // Safe fallback in non-browser or test environments
      }
    }

    if (hashError) {
      if (
        hashError === "access_denied" ||
        hashErrorDesc?.toLowerCase().includes("expired")
      ) {
        setError(
          "Your invitation link has expired or has already been used. Please contact your administrator for a new invite.",
        );
      } else {
        setError(
          hashErrorDesc ||
            "Unable to verify this invitation link. Please request a new invitation.",
        );
      }
      return;
    }

    if (!parsedToken) {
      setError(
        "This invitation link is missing or invalid. Please check your invitation email.",
      );
      return;
    }

    setToken(parsedToken);
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

    if (!token) {
      setError("This invitation link is missing or expired.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmation) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await api.auth.acceptInvitation(token, password);
      setComplete(true);
    } catch (inviteError: any) {
      const apiErr = inviteError as ApiError;
      if (apiErr.status === 429) {
        setError("Too many attempts. Please wait a few moments before trying again.");
      } else if (apiErr.status === 410 || apiErr.status === 400) {
        setError(
          "This invitation link has expired or has already been used. Please contact your administrator.",
        );
      } else if (apiErr.status === 409) {
        setError("An account has already been registered with this email. You can sign in directly.");
      } else {
        setError(
          apiErr.message || "Invitation could not be accepted. Please try again.",
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <h1 className="text-xl font-bold text-slate-900">Accept your invitation</h1>
        <p className="text-sm text-slate-500 mt-1">
          Set a password to activate your MedNova {portal} account.
        </p>
        {error && <p className="mt-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg p-3 text-sm">{error}</p>}
        {complete ? (
          <div className="mt-5 space-y-4">
            <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
              Your invitation is accepted. You can now sign in.
            </p>
            <Button fullWidth onClick={() => navigate(`/${portal}/login`)}>
              Go to {portal} sign in
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-5 space-y-4">
            <Input label="New password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
            <Input label="Confirm password" type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required />
            <Button type="submit" fullWidth loading={loading}>Activate account</Button>
          </form>
        )}
      </div>
    </div>
  );
}
