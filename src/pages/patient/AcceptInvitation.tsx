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

  // Self-service resend state
  const [resendEmail, setResendEmail] = useState("");
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [resendMessage, setResendMessage] = useState("");

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
          "Your invitation link has expired or has already been used. Please request a new activation link below.",
        );
      } else {
        setError(
          hashErrorDesc ||
            "Unable to verify this invitation link. Please request a new activation link below.",
        );
      }
      return;
    }

    if (!parsedToken) {
      setError(
        "This invitation link is missing or has expired. Please enter your email below to receive a new link.",
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
          "This invitation link has expired or has already been used. Please request a new link below.",
        );
        setToken("");
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

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resendEmail || !resendEmail.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }

    setResending(true);
    setError("");
    setResendSuccess(false);

    try {
      const res = await api.auth.resendActivation(resendEmail.trim(), portal);
      setResendSuccess(true);
      setResendMessage(
        res.message ||
          "A fresh activation link has been sent to your email. Please check your inbox.",
      );
    } catch (err: any) {
      setError(err?.message || "Failed to send activation email. Please try again.");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <h1 className="text-xl font-bold text-slate-900">
          {token ? "Accept your invitation" : "Activate your account"}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {token
            ? `Set a password to activate your MedNova ${portal} account.`
            : `Request a new activation link for your MedNova ${portal} account.`}
        </p>

        {error && (
          <div className="mt-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg p-3 text-sm flex items-start gap-2">
            <svg className="w-5 h-5 flex-shrink-0 text-rose-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {resendSuccess && (
          <div className="mt-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg p-3 text-sm">
            <p className="font-semibold">Activation link sent!</p>
            <p className="mt-1 text-emerald-700">{resendMessage}</p>
          </div>
        )}

        {complete ? (
          <div className="mt-5 space-y-4">
            <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
              Your password has been saved and your account is active. You can now sign in.
            </p>
            <Button fullWidth onClick={() => navigate(`/${portal}/login`)}>
              Go to {portal} sign in
            </Button>
          </div>
        ) : token ? (
          <form onSubmit={submit} className="mt-5 space-y-4">
            <Input
              label="New password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 8 characters"
              required
            />
            <Input
              label="Confirm password"
              type="password"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              placeholder="Re-enter password"
              required
            />
            <Button type="submit" fullWidth loading={loading}>
              Activate account
            </Button>
          </form>
        ) : (
          <form onSubmit={handleResend} className="mt-5 space-y-4">
            <Input
              label="Your email address"
              type="email"
              value={resendEmail}
              onChange={(e) => setResendEmail(e.target.value)}
              placeholder="Enter your registered email"
              required
            />
            <Button type="submit" fullWidth loading={resending} variant="primary">
              Send new activation link
            </Button>
            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => navigate(`/${portal}/login`)}
                className="text-xs text-slate-500 hover:text-slate-800 underline"
              >
                Return to {portal} sign in
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
