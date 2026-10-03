import type { RagUiError } from "../../../lib/rag/types";
import Button from "../../ui/Button";
import Card from "../../ui/Card";

export default function RagErrorState({
  error,
  onRetry,
}: {
  error: RagUiError;
  onRetry: () => void;
}) {
  return (
    <Card padding="md" className="border-rose-200 bg-rose-50/40">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-sm font-semibold text-rose-800">
            {error.unauthorized ? "Analysis unavailable" : "Analysis could not be completed"}
          </p>
          <p className="text-sm text-rose-700 mt-1">{error.message}</p>
          {error.requestId && (
            <p className="text-xs font-mono text-rose-500 mt-2">Reference {error.requestId}</p>
          )}
        </div>
        {error.retryable && (
          <Button variant="outline" size="sm" onClick={onRetry}>Try Again</Button>
        )}
      </div>
    </Card>
  );
}
