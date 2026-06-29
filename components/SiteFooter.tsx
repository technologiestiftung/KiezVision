import React from "react";

export interface SiteFooterProps {
  language: "en" | "de";
}

type FooterLogo = {
  href: string;
  src: string;
  labelDe: string;
  labelEn: string;
  className: string;
};

const PROJECT_LOGOS: FooterLogo[] = [
  {
    href: "https://citylab-berlin.org/de/start/",
    src: "/partners/citylab.svg",
    labelDe: "CityLAB Berlin",
    labelEn: "CityLAB Berlin",
    className: "h-8 sm:h-9",
  },
  {
    href: "https://www.technologiestiftung-berlin.de/",
    src: "/partners/technologiestiftung.svg",
    labelDe: "Technologiestiftung Berlin",
    labelEn: "Technologiestiftung Berlin",
    className: "h-8 sm:h-9",
  },
];

const FUNDING_LOGO: FooterLogo = {
  href: "https://www.berlin.de/rbmskzl/",
  src: "/partners/berlin-senatskanzlei.png",
  labelDe: "Der Regierende Bürgermeister von Berlin, Senatskanzlei",
  labelEn: "Governing Mayor of Berlin, Senate Chancellery",
  className: "h-10 sm:h-11",
};

const FooterLogoLink: React.FC<{
  logo: FooterLogo;
  isDe: boolean;
  opensInNewWindow: string;
}> = ({ logo, isDe, opensInNewWindow }) => (
  <a
    href={logo.href}
    target="_blank"
    rel="noreferrer"
    className="flex items-center justify-center opacity-90 hover:opacity-100 transition-opacity"
  >
    <img
      src={logo.src}
      alt={`${isDe ? logo.labelDe : logo.labelEn} ${opensInNewWindow}`}
      className={`w-auto max-w-[180px] sm:max-w-[220px] object-contain ${logo.className}`}
    />
  </a>
);

export const SiteFooter: React.FC<SiteFooterProps> = ({ language }) => {
  const isDe = language === "de";
  const opensInNewWindow = isDe ? "(öffnet in neuem Fenster)" : "(opens in new window)";

  return (
    <footer className="border-t-4 border-eb-900 bg-white mt-auto">
      <div className="w-full max-w-full min-w-0 px-3 sm:px-4 lg:px-6 py-8 sm:py-10 flex flex-col items-start">
        <div className="w-full flex flex-col lg:flex-row lg:items-start lg:justify-between gap-10 lg:gap-12">
          <div className="flex flex-col sm:flex-row flex-wrap items-start gap-10 sm:gap-16 lg:gap-20">
            <div className="flex flex-col items-start">
              <p className="text-xs font-black uppercase tracking-widest text-eb-900/50 mb-4 text-left">
                {isDe ? "Ein Projekt der" : "A project by"}
              </p>
              <div className="flex flex-wrap items-center gap-8 sm:gap-12">
                {PROJECT_LOGOS.map((logo) => (
                  <FooterLogoLink
                    key={logo.src}
                    logo={logo}
                    isDe={isDe}
                    opensInNewWindow={opensInNewWindow}
                  />
                ))}
              </div>
            </div>

            <div className="flex flex-col items-start">
              <p className="text-xs font-black uppercase tracking-widest text-eb-900/50 mb-4 text-left">
                {isDe ? "Gefördert durch" : "Supported by"}
              </p>
              <FooterLogoLink
                logo={FUNDING_LOGO}
                isDe={isDe}
                opensInNewWindow={opensInNewWindow}
              />
            </div>
          </div>

          <div className="lg:ml-auto lg:max-w-[220px] lg:text-right">
            <p className="text-[11px] sm:text-xs font-bold text-eb-900/60 leading-relaxed">
              {isDe ? (
                <>
                  Teil des{" "}
                  <a
                    href="https://www.technologiestiftung-berlin.de/projekte/kiezlabor"
                    target="_blank"
                    rel="noreferrer"
                    className="text-eb-900 underline underline-offset-2 hover:text-coral-500 transition-colors"
                  >
                    Kiezlabors
                  </a>
                  {" "}— mobilem Beteiligungslabor für urbane Mitgestaltung in
                  Berlin.
                </>
              ) : (
                <>
                  Part of{" "}
                  <a
                    href="https://www.technologiestiftung-berlin.de/projekte/kiezlabor"
                    target="_blank"
                    rel="noreferrer"
                    className="text-eb-900 underline underline-offset-2 hover:text-coral-500 transition-colors"
                  >
                    Kiezlabor
                  </a>
                  {" "}— a mobile participation lab for urban co-creation across
                  Berlin.
                </>
              )}
            </p>
          </div>
        </div>
        <p className="mt-8 text-left text-[10px] font-bold text-eb-900/40">
          © {new Date().getFullYear()} Technologiestiftung Berlin & CityLAB Berlin
        </p>
      </div>
    </footer>
  );
};
