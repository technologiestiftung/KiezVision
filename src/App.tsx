import React from "react";
import { PasswordGate } from "./components/auth/password-gate.tsx";
import { AppProvider, useIsAuthenticated } from "./context/app-context.tsx";
import { AppRoutes } from "./routes/index.tsx";

function AppShell() {
	const [isAuthenticated, unlock] = useIsAuthenticated();

	if (!isAuthenticated) {
		return <PasswordGate onUnlock={unlock} />;
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
