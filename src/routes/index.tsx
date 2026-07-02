import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "../layouts/app-layout.tsx";
import AboutPage from "./about/index.tsx";
import EditPage from "./edit/index.tsx";
import HomePage from "./home/index.tsx";
import ImageGalleryPage from "./image-gallery/index.tsx";
import LibraryPage from "./library/index.tsx";

export function AppRoutes() {
	return (
		<Routes>
			<Route element={<AppLayout />}>
				<Route path="/" element={<HomePage />} />
				<Route path="/edit" element={<EditPage />} />
				<Route path="/library" element={<LibraryPage />} />
				<Route path="/image-gallery" element={<ImageGalleryPage />} />
				<Route path="/about" element={<AboutPage />} />
				<Route path="/libray" element={<Navigate to="/library" replace />} />
				<Route path="*" element={<Navigate to="/" replace />} />
			</Route>
		</Routes>
	);
}
