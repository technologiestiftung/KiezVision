import { useNavigate } from "react-router-dom";
import { BackToHomeButton } from "../../components/primitives/navigation/back-to-home-button.tsx";
import { useAppContext } from "../../context/app-context.tsx";

export default function AboutPage() {
	const navigate = useNavigate();
	const { language, content } = useAppContext();

	return (
		<div className="max-w-3xl mx-auto px-6 py-12 sm:py-16">
			<BackToHomeButton
				navigate={navigate}
				label={content.backToHome}
				className="mb-10"
			/>

			<div className="bg-white border-4 border-eb-900 p-8 sm:p-10 shadow-[12px_12px_0px_0px_rgba(255,207,214,1)]">
				<h2 className="text-3xl sm:text-4xl font-black tracking-tighter mb-6">
					{content.aboutTitle}
				</h2>
				<p className="text-base sm:text-lg font-bold text-eb-900/80 leading-relaxed mb-4">
					<strong>KiezVision</strong> {content.aboutIntro}
				</p>
				<p className="text-sm font-bold text-eb-900/70 leading-relaxed mb-8">
					{content.aboutBody}
				</p>

				<div className="border-t-2 border-eb-900/10 pt-8 mb-8">
					<h3 className="text-lg font-black tracking-tight mb-3">
						{content.aboutKiezlaborTitle}
					</h3>
					<p className="text-sm font-bold text-eb-900/70 leading-relaxed">
						{content.aboutKiezlaborBody}
					</p>
				</div>

				<div className="border-t-2 border-eb-900/10 pt-8">
					<h3 className="text-xs font-black uppercase tracking-widest text-eb-900/50 mb-4">
						{content.aboutLinksTitle}
					</h3>
					<ul className="space-y-2 text-sm font-black">
						<li>
							<a
								href="https://kiez-vision.vercel.app/"
								target="_blank"
								rel="noreferrer"
								className="underline hover:text-coral-500 transition-colors"
							>
								{content.aboutAppLink}
								<span className="sr-only"> (opens in new window)</span>
							</a>
						</li>
						<li>
							<a
								href="https://www.technologiestiftung-berlin.de/projekte/kiezlabor"
								target="_blank"
								rel="noreferrer"
								className="underline hover:text-coral-500 transition-colors"
							>
								{content.aboutProjectLink}
								<span className="sr-only"> (opens in new window)</span>
							</a>
						</li>
						<li>
							<a
								href={
									language === "de"
										? "https://citylab-berlin.org/de/start/"
										: "https://citylab-berlin.org/en/start/"
								}
								target="_blank"
								rel="noreferrer"
								className="underline hover:text-coral-500 transition-colors"
							>
								CityLAB Berlin
								<span className="sr-only"> (opens in new window)</span>
							</a>
						</li>
						<li>
							<a
								href="https://www.technologiestiftung-berlin.de/"
								target="_blank"
								rel="noreferrer"
								className="underline hover:text-coral-500 transition-colors"
							>
								Technologiestiftung Berlin
								<span className="sr-only"> (opens in new window)</span>
							</a>
						</li>
					</ul>
				</div>
			</div>
		</div>
	);
}
