export function ChartSkeleton() {
  return (
    <section aria-live="polite" className="chart-panel chart-skeleton" role="status">
      <div className="skeleton-title" />
      <div className="skeleton-plot" />
    </section>
  );
}
