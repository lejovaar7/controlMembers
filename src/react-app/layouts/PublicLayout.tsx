import { Link, Outlet } from "react-router";

export function PublicLayout() {
	return (
		<div className="flex min-h-svh flex-col">
			<header className="border-b">
				<div className="mx-auto flex h-14 w-full max-w-5xl items-center px-4 sm:px-6">
					<Link to="/" className="font-semibold">
						Home
					</Link>
				</div>
			</header>
			<main className="flex-1">
				<Outlet />
			</main>
		</div>
	);
}
