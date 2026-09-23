import { calculateCommission, plans } from "./calculator.mjs";

const currency = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
const number = new Intl.NumberFormat("es-CO");
const clients = document.querySelector("#clients");
const slider = document.querySelector("#clients-range");
const commission = document.querySelector("#commission");
const error = document.querySelector("#input-error");
const result = document.querySelector(".calculator-result");

function update() {
	const plan = plans.find((item) => item.id === document.querySelector('[name="plan"]:checked').value);
	const count = Number(clients.value);
	const rate = Number(commission.value);
	const validClients = clients.value !== "" && clients.validity.valid;
	const validRate = commission.value !== "" && commission.validity.valid;
	clients.setAttribute("aria-invalid", String(!validClients));
	commission.setAttribute("aria-invalid", String(!validRate));
	error.hidden = validClients && validRate;
	result.classList.toggle("result-invalid", !error.hidden);
	if (!error.hidden) {
		error.textContent = !validClients ? "Ingresa de 0 a 10.000 clientes, sin decimales." : "Ingresa una comisión entre 0 y 100%, sin decimales.";
		for (const id of ["monthly-result", "annual-result", "per-client-result", "clients-result", "rate-result"]) document.getElementById(id).textContent = "—";
		return;
	}
	const totals = calculateCommission(plan.price, rate, count);
	slider.max = Math.max(Number(slider.max), Math.ceil(count / 100) * 100);
	slider.value = count;
	document.querySelector("#range-midpoint").textContent = number.format(Number(slider.max) / 2);
	document.querySelector("#range-maximum").textContent = `${number.format(Number(slider.max))} clientes`;
	document.querySelector("#monthly-result").textContent = currency.format(totals.monthly);
	document.querySelector("#per-client-result").textContent = currency.format(totals.perClient);
	document.querySelector("#annual-result").textContent = `${currency.format(totals.annual)} COP`;
	document.querySelector("#clients-result").textContent = number.format(count);
	document.querySelector("#rate-result").textContent = `${rate}%`;
}

slider.addEventListener("input", () => { clients.value = slider.value; update(); });
clients.addEventListener("input", update);
commission.addEventListener("input", update);
document.querySelectorAll('[name="plan"]').forEach((input) => input.addEventListener("change", update));
document.querySelector("#year").textContent = new Date().getFullYear();
const mobileMenu = document.querySelector(".mobile-menu");
mobileMenu.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => {
	mobileMenu.open = false;
}));
document.addEventListener("keydown", (event) => {
	if (event.key === "Escape" && mobileMenu.open) {
		mobileMenu.open = false;
		mobileMenu.querySelector("summary").focus();
	}
});
window.matchMedia("(min-width: 1200px)").addEventListener("change", (event) => {
	if (event.matches) mobileMenu.open = false;
});

update();
