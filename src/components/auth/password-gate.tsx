import React, { useState } from "react";
import { Lock } from "lucide-react";
import { ensureApiSession } from "../../lib/api.ts";
import { PrimaryButton } from "../primitives/buttons/primary-button.tsx";

export interface PasswordGateProps {
	onUnlock: () => void;
}

export const PasswordGate: React.FC<PasswordGateProps> = ({ onUnlock }) => {
	const [input, setInput] = useState("");
	const [error, setError] = useState(false);
	const [busy, setBusy] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setBusy(true);
		try {
			await ensureApiSession(input);
			sessionStorage.setItem("kv_auth", "1");
			onUnlock();
		} catch {
			setError(true);
			setTimeout(() => setError(false), 1500);
		} finally {
			setBusy(false);
		}
	};

	return (
		<div className="min-h-screen bg-eb-50 flex flex-col items-center justify-center p-6">
			<div className="w-full max-w-md">
				<div className="flex flex-col items-center mb-8">
					<div className="w-16 h-16 bg-white flex items-center justify-center border-4 border-eb-900 shadow-[6px_6px_0px_0px_rgba(255,207,214,1)] mb-6">
						<Lock className="w-8 h-8 text-eb-900" />
					</div>
					<h1 className="text-3xl font-black tracking-tighter text-eb-900">
						KiezVision
					</h1>
					<p
						className="text-sm font-bold text-eb-900/50 mt-1"
						id="password-hint"
					>
						Enter password to continue
					</p>
				</div>
				<form
					onSubmit={handleSubmit}
					className="bg-white border-4 border-eb-900 shadow-[12px_12px_0px_0px_rgba(32,32,27,1)] p-8"
				>
					<label htmlFor="site-password" className="sr-only">
						Password
					</label>
					<input
						id="site-password"
						type="password"
						value={input}
						onChange={(e) => setInput(e.target.value)}
						placeholder="Password"
						autoFocus
						disabled={busy}
						aria-describedby="password-hint"
						aria-invalid={error || undefined}
						className={`w-full bg-gray-50 border-2 h-14 px-6 text-lg font-black tracking-tighter focus:bg-white transition-all placeholder:text-eb-900/30 ${
							error ? "border-red-500 bg-red-50" : "border-eb-900"
						}`}
					/>
					{error && (
						<p className="text-red-600 text-xs font-black mt-2" role="alert">
							Incorrect password
						</p>
					)}
					<PrimaryButton
						type="submit"
						className="w-full mt-4 h-14 text-sm"
						disabled={busy}
					>
						Unlock
					</PrimaryButton>
				</form>
			</div>
		</div>
	);
};
