interface SkeletonProps {
  className?: string;
  height?: string;
  width?: string;
  rounded?: string;
}

export default function Skeleton({ className = "", height = "h-4", width = "w-full", rounded = "rounded" }: SkeletonProps) {
  return <div className={`skeleton ${height} ${width} ${rounded} ${className}`} />;
}

export function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton height="h-10" width="w-10" rounded="rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton height="h-4" width="w-40" />
          <Skeleton height="h-3" width="w-24" />
        </div>
      </div>
      <Skeleton height="h-3" />
      <Skeleton height="h-3" width="w-3/4" />
    </div>
  );
}
