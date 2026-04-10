const PLANNER_STORAGE_KEY = 'hisaab-kitaab-travel-plan-v1';
const TRAVEL_EXPENSES_STORAGE_KEY = 'hisaab-kitaab-travel-expenses-v1';

const fields = {
	travelDestination: document.getElementById('travelDestination'),
	travelNotes: document.getElementById('travelNotes'),
	foodBudget: document.getElementById('foodBudget'),
	foodNotes: document.getElementById('foodNotes'),
	stayBudget: document.getElementById('stayBudget'),
	stayNotes: document.getElementById('stayNotes')
};

const toast = document.getElementById('toast');
const savePlannerBtn = document.getElementById('savePlanner');
const clearPlannerBtn = document.getElementById('clearPlanner');
const revealNodes = document.querySelectorAll('.reveal');

const travelExpenseForm = document.getElementById('travelExpenseForm');
const travelAmount = document.getElementById('travelAmount');
const travelCategory = document.getElementById('travelCategory');
const travelDate = document.getElementById('travelDate');
const travelNote = document.getElementById('travelNote');
const travelExpenseTotal = document.getElementById('travelExpenseTotal');
const travelExpenseList = document.getElementById('travelExpenseList');
const clearTravelExpensesBtn = document.getElementById('clearTravelExpenses');

let toastTimer;
let travelExpenses = loadTravelExpenses();

init();

function init() {
	loadPlan();
	travelDate.value = new Date().toISOString().slice(0, 10);
	renderTravelExpenses();
	revealNodes.forEach((node, index) => {
		setTimeout(() => {
			node.classList.add('visible');
		}, 90 + index * 90);
	});
}

savePlannerBtn.addEventListener('click', () => {
	const payload = {
		travelDestination: fields.travelDestination.value.trim(),
		travelNotes: fields.travelNotes.value.trim(),
		foodBudget: fields.foodBudget.value.trim(),
		foodNotes: fields.foodNotes.value.trim(),
		stayBudget: fields.stayBudget.value.trim(),
		stayNotes: fields.stayNotes.value.trim()
	};

	localStorage.setItem(PLANNER_STORAGE_KEY, JSON.stringify(payload));
	renderTravelExpenses();
	showToast('Travel plan saved');
});

clearPlannerBtn.addEventListener('click', () => {
	Object.values(fields).forEach((el) => {
		el.value = '';
	});
	localStorage.removeItem(PLANNER_STORAGE_KEY);
	renderTravelExpenses();
	showToast('Travel plan cleared');
});

travelExpenseForm.addEventListener('submit', (event) => {
	event.preventDefault();

	const amount = Number(travelAmount.value);
	const category = travelCategory.value.trim();
	const date = travelDate.value;
	const note = travelNote.value.trim();

	if (!amount || amount <= 0 || !category || !date) {
		showToast('Enter valid expense values');
		return;
	}

	travelExpenses.unshift({
		id: crypto.randomUUID(),
		amount,
		category,
		date,
		note: note || 'No note'
	});

	persistTravelExpenses();
	renderTravelExpenses();
	travelExpenseForm.reset();
	travelDate.value = new Date().toISOString().slice(0, 10);
	showToast('Travel expense added');
});

clearTravelExpensesBtn.addEventListener('click', () => {
	if (!travelExpenses.length) {
		showToast('No travel expenses to clear');
		return;
	}

	travelExpenses = [];
	persistTravelExpenses();
	renderTravelExpenses();
	showToast('Travel expenses cleared');
});

function loadPlan() {
	try {
		const raw = localStorage.getItem(PLANNER_STORAGE_KEY);
		if (!raw) {
			return;
		}
		const saved = JSON.parse(raw);
		Object.entries(fields).forEach(([key, el]) => {
			el.value = saved[key] || '';
		});
	} catch {
		// Ignore malformed saved data and keep form empty.
	}
}

function loadTravelExpenses() {
	try {
		const raw = localStorage.getItem(TRAVEL_EXPENSES_STORAGE_KEY);
		if (!raw) {
			return [];
		}
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

function persistTravelExpenses() {
	localStorage.setItem(TRAVEL_EXPENSES_STORAGE_KEY, JSON.stringify(travelExpenses));
}

function renderTravelExpenses() {
	travelExpenseList.innerHTML = '';

	const sorted = [...travelExpenses].sort((a, b) => b.date.localeCompare(a.date));
	if (!sorted.length) {
		travelExpenseList.innerHTML = '<li class="empty-state">No travel expenses logged yet.</li>';
	} else {
		const fragment = document.createDocumentFragment();
		sorted.forEach((item) => {
			const li = document.createElement('li');
			li.className = 'travel-expense-item';

			const info = document.createElement('div');
			info.innerHTML = `
				<p><strong>${escapeHtml(item.note)}</strong></p>
				<p class="travel-expense-meta">${escapeHtml(item.category)} • ${formatDate(item.date)}</p>
			`;

			const amount = document.createElement('strong');
			amount.className = 'travel-expense-amount';
			amount.textContent = formatCurrency(item.amount);

			const del = document.createElement('button');
			del.type = 'button';
			del.className = 'delete-btn';
			del.textContent = 'Delete';
			del.addEventListener('click', () => {
				travelExpenses = travelExpenses.filter((entry) => entry.id !== item.id);
				persistTravelExpenses();
				renderTravelExpenses();
				showToast('Travel expense removed');
			});

			li.append(info, amount, del);
			fragment.appendChild(li);
		});

		travelExpenseList.appendChild(fragment);
	}

	const budgetTotal = Number(fields.foodBudget.value || 0) + Number(fields.stayBudget.value || 0);
	const expensesTotal = travelExpenses.reduce((sum, item) => sum + item.amount, 0);
	travelExpenseTotal.textContent = formatCurrency(budgetTotal + expensesTotal);
}

function formatCurrency(value) {
	return new Intl.NumberFormat('en-IN', {
		style: 'currency',
		currency: 'INR',
		maximumFractionDigits: 2
	}).format(value);
}

function formatDate(value) {
	const date = new Date(`${value}T00:00:00`);
	return date.toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric'
	});
}

function escapeHtml(text) {
	return text
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

function showToast(message) {
	toast.textContent = message;
	toast.classList.add('show');
	clearTimeout(toastTimer);
	toastTimer = setTimeout(() => {
		toast.classList.remove('show');
	}, 1100);
}
