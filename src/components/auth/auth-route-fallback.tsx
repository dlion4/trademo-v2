/**
 * Suspense fallback for auth routes while client-side search params resolve.
 * Mirrors the AuthShell footprint so the layout doesn't jump on hydration.
 */
export function AuthRouteFallback() {
  return (
    <div className="auth-shell">
      <header className="auth-topbar">
        <div className="container-xl auth-topbar__inner">
          <span className="brand-mark" aria-hidden="true">
            <span className="brand-mark__glyph">tM</span>
            <span>
              tradeMO
              <span className="brand-mark__sub">Crowdfunded Trade Pools</span>
            </span>
          </span>
        </div>
      </header>
      <main className="auth-main">
        <div className="auth-frame auth-frame--sm d-flex flex-column align-items-center justify-content-center gap-2 text-secondary">
          <span className="spinner-border" role="status" aria-hidden="true" />
          <span className="small">Loading…</span>
        </div>
      </main>
      <footer className="auth-footer" />
    </div>
  );
}
