import { Upload, Camera } from "lucide-react";
import { BERLIN_DISTRICTS, KIEZVISION_LOGO_URL } from "../../constants.ts";
import { useAppContext } from "../../context/app-context.tsx";

export default function HomePage() {
	const {
		language,
		content,
		searchQuery,
		processing,
		setSearchQuery,
		handleSearch,
		handleAutoDetect,
		handleFileUpload,
		openDeviceCamera,
		cameraFileFallbackRef,
	} = useAppContext();

	return (
		<div className="flex flex-col items-center justify-center min-h-[calc(100vh-80px)] p-6 text-center max-w-5xl mx-auto overflow-y-auto">
			<div className="w-24 h-24 bg-white flex items-center justify-center mb-6 border-4 border-eb-900 shadow-[8px_8px_0px_0px_rgba(255,207,214,1)] rotate-3 overflow-hidden">
				<img
					src={KIEZVISION_LOGO_URL}
					className="w-full h-full object-cover"
					alt="KiezVision Logo"
				/>
			</div>
			<h2 className="text-4xl md:text-5xl font-black mb-4 tracking-tighter leading-[0.9]">
				{content.reimagine}
				<br />
				{content.yourStreet}
			</h2>
			<p className="text-eb-900/60 mb-6 max-w-2xl text-lg font-bold tracking-tight">
				{content.subtitle}
			</p>

			<div className="w-full space-y-8">
				<div className="bg-white border-4 border-eb-900 p-6 shadow-[12px_12px_0px_0px_rgba(32,32,27,1)]">
					<div className="flex justify-center mb-4">
						<button
							type="button"
							onClick={() => void handleAutoDetect()}
							disabled={processing.isProcessing}
							className="px-4 h-10 text-xs font-black transition-all border-2 border-eb-900 bg-eb-900 text-eb-50 shadow-[4px_4px_0px_0px_rgba(255,207,214,1)] hover:shadow-none disabled:opacity-50 disabled:cursor-not-allowed"
						>
							{content.autoDetect}
						</button>
					</div>

					<form
						onSubmit={(e) => {
							e.preventDefault();
							void handleSearch(searchQuery);
						}}
						className="relative"
					>
						<label htmlFor="street-search" className="sr-only">
							{language === "en"
								? "Search for a street"
								: "Nach einer Straße suchen"}
						</label>
						<input
							id="street-search"
							type="text"
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							placeholder={content.searchPlaceholder}
							className="w-full bg-gray-50 border-2 border-eb-900 h-16 px-6 pr-28 text-lg font-black tracking-tighter focus:bg-white transition-all placeholder:text-eb-900/40"
							disabled={processing.isProcessing}
						/>
						<button
							type="submit"
							disabled={!searchQuery.trim() || processing.isProcessing}
							className="absolute right-2 top-1/2 -translate-y-1/2 bg-coral-500 hover:bg-eb-900 text-eb-50 px-8 h-12 border-2 border-eb-900 font-black shadow-[4px_4px_0px_0px_rgba(32,32,27,1)] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
						>
							{content.go}
						</button>
					</form>

					<div className="mt-6 pt-6 border-t-2 border-eb-900/10">
						<h3 className="text-xs font-black text-eb-900 mb-4">
							{content.exploreDistricts}
						</h3>
						<div className="flex gap-2 overflow-x-auto">
							{BERLIN_DISTRICTS.map((district) => (
								<button
									key={district}
									onClick={() => void handleSearch(district)}
									className="px-3 h-10 border-2 border-eb-900 bg-white text-xs font-black hover:bg-eb-900 hover:text-eb-50 transition-all shadow-[2px_2px_0px_0px_rgba(32,32,27,0.1)] hover:shadow-none"
								>
									{district}
								</button>
							))}
						</div>
					</div>
				</div>

				<div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2 text-center">
					<label className="group w-full sm:w-auto cursor-pointer bg-white text-eb-900 px-8 h-16 border-2 border-eb-900 shadow-[6px_6px_0px_0px_rgba(255,207,214,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all flex items-center justify-center gap-3 text-lg font-black tracking-tighter">
						<Upload className="w-6 h-6" aria-hidden="true" />{" "}
						{content.uploadPhoto}
						<input
							type="file"
							accept="image/*,.heic,.heif"
							multiple
							onChange={handleFileUpload}
							className="hidden"
						/>
					</label>

					<button
						type="button"
						onClick={() => void openDeviceCamera()}
						className="group w-full sm:w-auto cursor-pointer bg-white text-eb-900 px-8 h-16 border-2 border-eb-900 shadow-[6px_6px_0px_0px_rgba(254,68,65,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all flex items-center justify-center gap-3 text-lg font-black tracking-tighter"
					>
						<Camera className="w-6 h-6" aria-hidden="true" /> {content.capture}
					</button>
					<input
						ref={cameraFileFallbackRef}
						type="file"
						accept="image/*"
						capture="environment"
						className="hidden"
						onChange={handleFileUpload}
					/>
				</div>
			</div>
		</div>
	);
}
