import { useEffect, useState } from "react";
import "./App.css";

type Health = { status: string };

function App() {
	const [health, setHealth] = useState<Health | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		fetch("/api/health")
			.then((res) => {
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				return res.json() as Promise<Health>;
			})
			.then(setHealth)
			.catch((err: unknown) => setError(String(err)));
	}, []);

	return (
		<main className="app">
			<h1>SaaS Template</h1>
			<p className="subtitle">React + Vite + Hono + Cloudflare Workers</p>
			<p className="status">
				<code>GET /api/health</code>{" "}
				{error ? `error: ${error}` : health ? `→ ${health.status}` : "…"}
			</p>
		</main>
	);
}

export default App;
