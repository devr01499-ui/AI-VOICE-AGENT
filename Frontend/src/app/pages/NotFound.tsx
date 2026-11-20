/**
 * Shown for URLs that do not exist (audit #125: they used to render the home page or the first
 * industry, which search engines treat as a "soft 404"). App.tsx marks this page noindex.
 */
interface NotFoundProps {
  setPage: (p: any, extraId?: string) => void;
}

export default function NotFound({ setPage }: NotFoundProps) {
  return (
    <main className="min-h-[60vh] flex items-center justify-center px-4 py-24">
      <div className="max-w-lg text-center space-y-5">
        <p className="text-xs font-mono uppercase tracking-wider text-[#5E5D57]">Error 404</p>
        <h1 className="text-3xl md:text-4xl font-medium text-[#121212] tracking-tight">Page not found</h1>
        <p className="text-[#262523] leading-relaxed">
          The page you were looking for does not exist or has moved.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <button
            onClick={() => setPage("home")}
            className="px-5 py-2.5 rounded-[2px] bg-[#121212] text-white text-sm font-medium hover:bg-[#262523]"
          >
            Go to the home page
          </button>
          <button
            onClick={() => setPage("use-cases")}
            className="px-5 py-2.5 rounded-[2px] border border-[#CBC8BE] text-[#121212] text-sm font-medium hover:bg-[#EBE9E2]"
          >
            See use cases
          </button>
        </div>
      </div>
    </main>
  );
}
