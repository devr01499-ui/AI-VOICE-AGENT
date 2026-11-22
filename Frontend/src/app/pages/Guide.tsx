import { ArrowRight, CheckCircle2, Lightbulb, MapPin } from "lucide-react";
import GUIDE from "../data/guideContent.json";
import { PUBLIC_PLANS, LOWEST_PLAN, PLAN_VALIDITY_DAYS, NUMBER_RELEASE_GRACE_DAYS, formatInr } from "../lib/plans";

type Page = any;
interface GuideProps { setPage: (p: Page) => void; }

interface GuideImage { src: string; alt: string; caption: string; }
interface GuideSection { title: string; where: string; lead: string; steps: string[]; tips: string[]; images: GuideImage[]; }

const SECTIONS = GUIDE.sections as Record<string, GuideSection>;

/** Plan facts come from lib/plans.ts (the server-checked source), never typed into the guide text. */
const FACTS: Record<string, string> = {
  plans: PUBLIC_PLANS.map((p) => `${p.name} ${formatInr(p.price)} for ${p.minutes.toLocaleString("en-IN")} minutes`).join(", "),
  lowestPlan: `from ${formatInr(LOWEST_PLAN.price)} for ${LOWEST_PLAN.minutes.toLocaleString("en-IN")} minutes`,
  kbDocs: `${PUBLIC_PLANS.map((p) => p.kbDocuments.toLocaleString("en-IN")).join(", ")} documents on ${PUBLIC_PLANS.map((p) => p.name).join(", ")}`,
  validity: String(PLAN_VALIDITY_DAYS),
  grace: String(NUMBER_RELEASE_GRACE_DAYS),
};
export const fillGuideText = (text: string) => text.replace(/\{(\w+)\}/g, (m, key) => FACTS[key] ?? m);

function SectionLabel({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 text-xs font-mono text-[#121212]">
      <span className="font-semibold">|</span>
      <span className="uppercase tracking-wider">{text}</span>
    </div>
  );
}

function Screenshot({ img }: { img: GuideImage }) {
  return (
    <figure className="bg-[#EBE9E2] border border-[#CBC8BE] rounded-[2px] p-2 sm:p-3">
      <img
        src={img.src}
        alt={img.alt}
        width={1440}
        height={900}
        loading="lazy"
        decoding="async"
        className="w-full h-auto rounded-[2px] border border-[#CBC8BE] bg-white"
      />
      <figcaption className="text-xs text-[#262523] font-mono mt-2 px-1 leading-relaxed">{img.caption}</figcaption>
    </figure>
  );
}

export default function Guide({ setPage }: GuideProps) {
  const go = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    history.replaceState(null, "", `#${id}`);
  };
  let sectionNumber = 0;

  return (
    <div className="bg-[#E5E3DC] min-h-screen pb-24 font-sans text-[#121212]">
      {/* ── Header ── */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto pt-8">
        <div className="hatched-strip h-10 w-full mb-10" />
        <div className="max-w-3xl space-y-5">
          <SectionLabel text="Product guide · Updated 21 November 2026" />
          <h1 className="text-4xl sm:text-5xl font-normal sm:font-medium tracking-tight leading-[1.1]">{GUIDE.title}</h1>
          {GUIDE.intro.map((p, i) => (
            <p key={i} className="text-[#262523] text-base sm:text-lg leading-relaxed">{p}</p>
          ))}
          <div className="flex flex-wrap gap-3 pt-2">
            <button onClick={() => setPage("dashboard")} className="btn-primary uppercase font-mono text-xs tracking-wider px-6 py-3">
              Create your free account <ArrowRight className="w-4 h-4" />
            </button>
            <button onClick={() => setPage("pricing")} className="btn-secondary uppercase font-mono text-xs tracking-wider px-6 py-3">
              See plans and pricing
            </button>
          </div>
        </div>
      </section>

      {/* ── Quick start ── */}
      <section id="quick-start" className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto mt-16 scroll-mt-24">
        <SectionLabel text="Quick start" />
        <h2 className="text-3xl sm:text-4xl font-normal sm:font-medium tracking-tight mt-3">{GUIDE.quickStart.title}</h2>
        <p className="text-[#262523] mt-3 max-w-3xl leading-relaxed">{GUIDE.quickStart.lead}</p>
        <ol className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
          {GUIDE.quickStart.steps.map((s, i) => (
            <li key={i} className="bg-[#EBE9E2] border border-[#CBC8BE] rounded-[2px] p-5 flex flex-col justify-between hover:border-[#9C998F] transition-colors">
              <div>
                <span className="font-mono text-2xl font-bold">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="text-sm sm:text-base font-medium mt-3 mb-2 leading-snug">{s.name}</h3>
                <p className="text-xs sm:text-sm text-[#262523] leading-relaxed">{fillGuideText(s.text)}</p>
              </div>
              <a href={`#${s.anchor}`} onClick={go(s.anchor)} className="mt-4 pt-3 border-t border-[#CBC8BE]/60 text-[11px] font-mono uppercase tracking-wider text-[#121212] hover:underline">
                Read the details →
              </a>
            </li>
          ))}
        </ol>
      </section>

      {/* ── Contents + sections ── */}
      <div className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto mt-16 grid grid-cols-1 lg:grid-cols-12 gap-10">
        <nav aria-label="Guide contents" className="lg:col-span-3">
          <div className="lg:sticky lg:top-24 bg-[#EBE9E2] border border-[#CBC8BE] rounded-[2px] p-5 space-y-5">
            <SectionLabel text="On this page" />
            {GUIDE.groups.map((g) => (
              <div key={g.id}>
                <p className="text-[11px] font-mono uppercase tracking-wider text-[#262523] mb-2">{g.title}</p>
                <ul className="space-y-1.5">
                  {g.sections.map((id) => (
                    <li key={id}>
                      <a href={`#${id}`} onClick={go(id)} className="text-sm text-[#121212] hover:underline leading-snug">
                        {SECTIONS[id].title.split(":")[0]}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <a href="#guide-faq" onClick={go("guide-faq")} className="block text-sm text-[#121212] hover:underline">Questions</a>
          </div>
        </nav>

        <div className="lg:col-span-9 space-y-16 min-w-0">
          {GUIDE.groups.map((g) => (
            <div key={g.id} className="space-y-16">
              <div className="hatched-strip h-8 w-full" />
              {g.sections.map((id) => {
                const s = SECTIONS[id];
                sectionNumber += 1;
                return (
                  <section key={id} id={id} className="scroll-mt-24 space-y-5">
                    <SectionLabel text={`${String(sectionNumber).padStart(2, "0")} · ${g.title}`} />
                    <h2 className="text-2xl sm:text-3xl font-normal sm:font-medium tracking-tight leading-tight">{s.title}</h2>
                    <p className="flex items-center gap-2 text-xs font-mono text-[#262523]">
                      <MapPin className="w-3.5 h-3.5 flex-shrink-0" /> {s.where}
                    </p>
                    <p className="text-[#262523] leading-relaxed">{fillGuideText(s.lead)}</p>
                    <ol className="space-y-2.5">
                      {s.steps.map((step, i) => (
                        <li key={i} className="flex gap-3 text-sm sm:text-base leading-relaxed">
                          <span className="font-mono text-xs font-bold bg-[#DFDCD4] border border-[#CBC8BE] rounded-[2px] w-6 h-6 flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                          <span>{fillGuideText(step)}</span>
                        </li>
                      ))}
                    </ol>
                    {s.images.map((img) => <Screenshot key={img.src} img={img} />)}
                    {s.tips.length > 0 && (
                      <div className="bg-[#EBE9E2] border border-[#CBC8BE] rounded-[2px] p-5 space-y-2.5">
                        <p className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider"><Lightbulb className="w-4 h-4" /> Good to know</p>
                        <ul className="space-y-2">
                          {s.tips.map((t, i) => (
                            <li key={i} className="flex gap-2.5 text-sm text-[#262523] leading-relaxed">
                              <CheckCircle2 className="w-4 h-4 text-[#121212] flex-shrink-0 mt-0.5" />
                              <span>{fillGuideText(t)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          ))}

          {/* ── FAQ ── */}
          <section id="guide-faq" className="scroll-mt-24 space-y-5">
            <div className="hatched-strip h-8 w-full" />
            <SectionLabel text="Questions" />
            <h2 className="text-2xl sm:text-3xl font-normal sm:font-medium tracking-tight">Questions people ask while setting up</h2>
            <div className="space-y-3">
              {GUIDE.faqs.map((f, i) => (
                <div key={i} className="bg-[#EBE9E2] border border-[#CBC8BE] rounded-[2px] p-5">
                  <h3 className="font-medium text-base">{f.q}</h3>
                  <p className="text-sm text-[#262523] leading-relaxed mt-2">{fillGuideText(f.a)}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ── CTA ── */}
          <section className="bg-[#EBE9E2] border border-[#CBC8BE] rounded-[2px] p-8 sm:p-10 space-y-4">
            <h2 className="text-2xl sm:text-3xl font-normal sm:font-medium tracking-tight">Build your first agent today</h2>
            <p className="text-[#262523] leading-relaxed max-w-2xl">
              Creating an account and building agents is free. When you are ready for real calls, plans start {FACTS.lowestPlan}, with a local +91 number included.
            </p>
            <div className="flex flex-wrap gap-3">
              <button onClick={() => setPage("dashboard")} className="btn-primary uppercase font-mono text-xs tracking-wider px-6 py-3">
                Create your free account <ArrowRight className="w-4 h-4" />
              </button>
              <button onClick={() => setPage("contact")} className="btn-secondary uppercase font-mono text-xs tracking-wider px-6 py-3">
                Talk to us
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
