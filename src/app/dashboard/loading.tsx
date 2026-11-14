export default function DashboardLoading() {
  return (
    <div
      className="d-flex align-items-center justify-content-center"
      style={{ minHeight: "60vh" }}
      role="status"
      aria-label="Loading"
    >
      <div className="spinner-border text-secondary" aria-hidden="true" />
    </div>
  );
}
