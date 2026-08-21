import React, { useEffect, useState } from "react";
import { PasswordGate } from "./components/auth/password-gate.tsx";
import { AppProvider, useIsAuthenticated } from "./context/app-context.tsx";
import { isPasswordProtectionActive } from "./constants.ts";
import { ensureApiSession, hasApiSession } from "./lib/api.ts";
import { AppRoutes } from "./routes/index.tsx";

function AppShell() {
	const [isAuthenticated, unlock] = useIsAuthenticated();
	const [sessionReady, setSessionReady] = useState(false);
	const [booting, setBooting] = useState(true);

	useEffect(() => {
		let cancelled = false;
		void (async () => {
			try {
				if (await hasApiSession()) {
					if (!cancelled) {
						if (isPasswordProtectionActive) unlock();
						setSessionReady(true);
					}
					return;
				}
				if (!isPasswordProtectionActive) {
					await ensureApiSession();
					if (!cancelled) setSessionReady(true);
					return;
				}
				if (!cancelled) setSessionReady(true);
			} catch (error) {
				console.error("Failed to create API session:", error);
				if (!cancelled) setSessionReady(true);
			} finally {
				if (!cancelled) setBooting(false);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [unlock]);

	if (booting) {
		return (
			<div className="min-h-screen bg-eb-50 flex items-center justify-center">
				<p className="text-sm font-bold text-eb-900/50">Loading…</p>
			</div>
		);
	}

	if (isPasswordProtectionActive && !isAuthenticated) {
		return (
			<PasswordGate
				onUnlock={() => {
					unlock();
					setSessionReady(true);
				}}
			/>
		);
	}

	if (!sessionReady) {
		return (
			<div className="min-h-screen bg-eb-50 flex items-center justify-center">
				<p className="text-sm font-bold text-eb-900/50">Loading…</p>
			</div>
		);
	}

	return <AppRoutes />;
}

export default function App() {
	return (
		<AppProvider>
			<AppShell />
		</AppProvider>
	);
}
