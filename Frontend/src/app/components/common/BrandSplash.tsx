/**
 * Neutral branded loading screen.
 *
 * Uses the same markup and classes as the static splash in Frontend/index.html
 * (styles live there, inline, so they apply before the CSS bundle loads). Because
 * the static splash, the Suspense fallback and the auth-check screen are pixel
 * identical, a visitor sees one continuous splash and then the correct page —
 * never an intermediate page.
 */
export default function BrandSplash() {
  return (
    <div className="cv-splash" role="status" aria-label="Loading Claritiy Voice">
      <div className="cv-splash__word">
        Claritiy <span>Voice</span>
      </div>
      <div className="cv-splash__bar" />
    </div>
  );
}
