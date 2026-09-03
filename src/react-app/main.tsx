import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import { router } from "@/router";
import { I18nProvider } from "@/components/i18n-provider";
import "./index.css";

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<I18nProvider><RouterProvider router={router} /></I18nProvider>
	</StrictMode>,
);
