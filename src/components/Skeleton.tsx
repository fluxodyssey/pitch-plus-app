interface LineProps {
  width?: string | number;
  height?: number;
}

export function SkeletonLine({ width = '100%', height = 14 }: LineProps) {
  return (
    <div
      className="skeleton skeleton-line"
      style={{ width, height }}
    />
  );
}

export function SkeletonCard({ height = 80 }: { height?: number }) {
  return <div className="skeleton skeleton-card" style={{ height }} />;
}

export function SkeletonTable({ rows = 8 }: { rows?: number }) {
  return (
    <div style={{ padding: '16px 0' }}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton-table-row">
          <div className="skeleton skeleton-table-cell" />
          <div className="skeleton skeleton-table-cell" />
          <div className="skeleton skeleton-table-cell" />
          <div className="skeleton skeleton-table-cell" />
          <div className="skeleton skeleton-table-cell" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonPage() {
  return (
    <div className="page" style={{ gap: 16 }}>
      <SkeletonLine width="30%" height={24} />
      <SkeletonLine width="50%" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12, marginTop: 8 }}>
        {Array.from({ length: 6 }, (_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
      <SkeletonTable />
    </div>
  );
}
