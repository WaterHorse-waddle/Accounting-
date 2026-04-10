const STORAGE_KEY = 'expense-tracker-v1';

const expenseForm = document.getElementById('expenseForm');
const amountInput = document.getElementById('amount');
const categoryInput = document.getElementById('category');
const dateInput = document.getElementById('date');
const noteInput = document.getElementById('note');
const expenseList = document.getElementById('expenseList');
const monthFilter = document.getElementById('monthFilter');
const clearAllBtn = document.getElementById('clearAll');
const toast = document.getElementById('toast');

const totalSpendEl = document.getElementById('totalSpend');
const avgSpendEl = document.getElementById('avgSpend');
const topCategoryEl = document.getElementById('topCategory');
const txCountEl = document.getElementById('txCount');
const reportCaption = document.getElementById('reportCaption');

const categoryCanvas = document.getElementById('categoryChart');
const trendCanvas = document.getElementById('trendChart');

let expenses = loadExpenses();
let currentFilter = 'all';
let toastTimer;
let resizeTimer;

dateInput.value = new Date().toISOString().slice(0, 10);

setupMonthFilter();
render();
revealBlocks();

expenseForm.addEventListener('submit', (event) => {
	event.preventDefault();

	const amount = Number(amountInput.value);
	const category = categoryInput.value.trim();
	const date = dateInput.value;
	const note = noteInput.value.trim();

	if (!amount || amount <= 0 || !category || !date) {
		showToast('Please fill valid values');
		return;
	}

	expenses.unshift({
		id: crypto.randomUUID(),
		amount,
		category,
		date,
		note: note || 'No note'
	});

	persistExpenses();
	setupMonthFilter();
	render();
	expenseForm.reset();
	dateInput.value = new Date().toISOString().slice(0, 10);
	showToast('Expense added');
});

monthFilter.addEventListener('change', () => {
	currentFilter = monthFilter.value;
	render();
});

window.addEventListener('resize', () => {
	clearTimeout(resizeTimer);
	resizeTimer = setTimeout(() => {
		renderCharts(filteredExpenses());
	}, 120);
});

clearAllBtn.addEventListener('click', () => {
	if (!expenses.length) {
		showToast('Nothing to clear');
		return;
	}

	const ok = window.confirm('Delete all transactions?');
	if (!ok) {
		return;
	}

	expenses = [];
	persistExpenses();
	setupMonthFilter();
	render();
	showToast('All transactions removed');
});

function loadExpenses() {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) {
			return [];
		}
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

function persistExpenses() {
	localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
}

function setupMonthFilter() {
	const months = Array.from(new Set(expenses.map((item) => item.date.slice(0, 7)))).sort().reverse();
	const previous = currentFilter;

	monthFilter.innerHTML = '';
	monthFilter.add(new Option('All Months', 'all'));
	months.forEach((month) => {
		const [year, mm] = month.split('-');
		const label = `${monthName(Number(mm))} ${year}`;
		monthFilter.add(new Option(label, month));
	});

	currentFilter = months.includes(previous) || previous === 'all' ? previous : 'all';
	monthFilter.value = currentFilter;
}

function filteredExpenses() {
	if (currentFilter === 'all') {
		return [...expenses];
	}
	return expenses.filter((item) => item.date.startsWith(currentFilter));
}

function render() {
	const current = filteredExpenses().sort((a, b) => b.date.localeCompare(a.date));
	renderList(current);
	renderSummary(current);
	renderCharts(current);
}

function renderList(items) {
	expenseList.innerHTML = '';

	if (!items.length) {
		expenseList.innerHTML = '<li class="empty-state">No expenses for this filter yet.</li>';
		return;
	}

	const fragment = document.createDocumentFragment();
	items.forEach((item) => {
		const li = document.createElement('li');
		li.className = 'expense-item';

		const main = document.createElement('div');
		main.className = 'expense-main';
		main.innerHTML = `
			<p>${escapeHtml(item.note)}</p>
			<span class="expense-meta">${escapeHtml(item.category)} • ${formatDate(item.date)}</span>
		`;

		const amount = document.createElement('strong');
		amount.className = 'expense-amount';
		amount.textContent = formatCurrency(item.amount);

		const del = document.createElement('button');
		del.className = 'delete-btn';
		del.type = 'button';
		del.textContent = 'Delete';
		del.addEventListener('click', () => {
			expenses = expenses.filter((entry) => entry.id !== item.id);
			persistExpenses();
			setupMonthFilter();
			render();
			showToast('Expense removed');
		});

		li.append(main, amount, del);
		fragment.appendChild(li);
	});

	expenseList.appendChild(fragment);
}

function renderSummary(items) {
	const total = items.reduce((sum, item) => sum + item.amount, 0);
	const days = new Set(items.map((item) => item.date));
	const avg = days.size ? total / days.size : 0;
	const byCategory = groupByCategory(items);
	const sortedCategories = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);

	totalSpendEl.textContent = formatCurrency(total);
	avgSpendEl.textContent = formatCurrency(avg);
	topCategoryEl.textContent = sortedCategories[0]?.[0] || '-';
	txCountEl.textContent = String(items.length);
}

function renderCharts(items) {
	const byCategory = groupByCategory(items);
	const byDay = groupByDay(items);

	drawCategoryChart(categoryCanvas, byCategory);
	drawTrendChart(trendCanvas, byDay);

	if (currentFilter === 'all') {
		reportCaption.textContent = 'Showing all months.';
	} else {
		const [year, mm] = currentFilter.split('-');
		reportCaption.textContent = `Showing ${monthName(Number(mm))} ${year}.`;
	}
}

function drawCategoryChart(canvas, data) {
	const ctx = canvas.getContext('2d');
	const dpr = window.devicePixelRatio || 1;
	const width = canvas.clientWidth;
	const height = Math.round(width * 0.52);

	canvas.width = Math.floor(width * dpr);
	canvas.height = Math.floor(height * dpr);
	ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

	ctx.clearRect(0, 0, width, height);
	ctx.fillStyle = '#11172b';
	ctx.fillRect(0, 0, width, height);

	const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
	if (!entries.length) {
		drawEmptyChartMessage(ctx, width, height);
		return;
	}

	const max = Math.max(...entries.map(([, value]) => value));
	const pad = { top: 26, right: 24, bottom: 54, left: 56 };
	const chartW = width - pad.left - pad.right;
	const chartH = height - pad.top - pad.bottom;
	const barW = chartW / entries.length;

	ctx.strokeStyle = '#d7e3ff';
	ctx.lineWidth = 3;
	ctx.beginPath();
	ctx.moveTo(pad.left, pad.top);
	ctx.lineTo(pad.left, pad.top + chartH);
	ctx.lineTo(pad.left + chartW, pad.top + chartH);
	ctx.stroke();

	entries.forEach(([label, value], index) => {
		const x = pad.left + index * barW + 7;
		const h = max ? (value / max) * (chartH - 8) : 0;
		const y = pad.top + chartH - h;
		const w = Math.max(barW - 14, 16);

		ctx.fillStyle = pickColor(index);
		ctx.fillRect(x, y, w, h);
		ctx.strokeStyle = '#d7e3ff';
		ctx.lineWidth = 3;
		ctx.strokeRect(x, y, w, h);

		ctx.fillStyle = '#f3f6ff';
		ctx.font = '700 12px "Space Grotesk"';
		ctx.textAlign = 'center';
		ctx.fillText(shorten(label, 10), x + w / 2, pad.top + chartH + 20);

		ctx.font = '700 11px "Space Grotesk"';
		ctx.fillText(formatShortCurrency(value), x + w / 2, y - 8);
	});
}

function drawTrendChart(canvas, data) {
	const ctx = canvas.getContext('2d');
	const dpr = window.devicePixelRatio || 1;
	const width = canvas.clientWidth;
	const height = Math.round(width * 0.52);

	canvas.width = Math.floor(width * dpr);
	canvas.height = Math.floor(height * dpr);
	ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

	ctx.clearRect(0, 0, width, height);
	ctx.fillStyle = '#11172b';
	ctx.fillRect(0, 0, width, height);

	const entries = Object.entries(data).sort((a, b) => a[0].localeCompare(b[0]));
	if (!entries.length) {
		drawEmptyChartMessage(ctx, width, height);
		return;
	}

	const max = Math.max(...entries.map(([, value]) => value));
	const pad = { top: 24, right: 28, bottom: 46, left: 56 };
	const chartW = width - pad.left - pad.right;
	const chartH = height - pad.top - pad.bottom;

	ctx.strokeStyle = '#d7e3ff';
	ctx.lineWidth = 3;
	ctx.beginPath();
	ctx.moveTo(pad.left, pad.top);
	ctx.lineTo(pad.left, pad.top + chartH);
	ctx.lineTo(pad.left + chartW, pad.top + chartH);
	ctx.stroke();

	ctx.strokeStyle = '#7fa8e6';
	ctx.lineWidth = 3;
	ctx.beginPath();

	entries.forEach(([date, value], index) => {
		const x = pad.left + (index / Math.max(entries.length - 1, 1)) * chartW;
		const y = pad.top + chartH - (max ? (value / max) * (chartH - 8) : 0);

		if (index === 0) {
			ctx.moveTo(x, y);
		} else {
			ctx.lineTo(x, y);
		}
	});

	ctx.stroke();

	entries.forEach(([date, value], index) => {
		const x = pad.left + (index / Math.max(entries.length - 1, 1)) * chartW;
		const y = pad.top + chartH - (max ? (value / max) * (chartH - 8) : 0);

		ctx.fillStyle = '#a8bfdc';
		ctx.strokeStyle = '#d7e3ff';
		ctx.lineWidth = 3;
		ctx.beginPath();
		ctx.arc(x, y, 4.8, 0, Math.PI * 2);
		ctx.fill();
		ctx.stroke();

		if (index % Math.ceil(entries.length / 6) === 0 || index === entries.length - 1) {
			ctx.fillStyle = '#f3f6ff';
			ctx.font = '700 11px "Space Grotesk"';
			ctx.textAlign = 'center';
			ctx.fillText(date.slice(5), x, pad.top + chartH + 18);
		}
		if (index === entries.length - 1) {
			ctx.fillStyle = '#f3f6ff';
			ctx.font = '700 12px "Space Grotesk"';
			ctx.textAlign = 'left';
			ctx.fillText(formatShortCurrency(value), x + 10, y - 10);
		}
	});
}

function drawEmptyChartMessage(ctx, width, height) {
	ctx.fillStyle = '#b9c3df';
	ctx.font = '700 14px "Space Grotesk"';
	ctx.textAlign = 'center';
	ctx.fillText('No data yet. Add expenses to generate reports.', width / 2, height / 2);
}

function groupByCategory(items) {
	return items.reduce((acc, item) => {
		acc[item.category] = (acc[item.category] || 0) + item.amount;
		return acc;
	}, {});
}

function groupByDay(items) {
	return items.reduce((acc, item) => {
		acc[item.date] = (acc[item.date] || 0) + item.amount;
		return acc;
	}, {});
}

function pickColor(index) {
	const palette = ['#4f8cff', '#7fa8e6', '#b8c8df', '#8fa6c2', '#dbe5f2', '#6f87ab', '#a3b8d3'];
	return palette[index % palette.length];
}

function revealBlocks() {
	const revealNodes = document.querySelectorAll('.reveal');
	revealNodes.forEach((node, index) => {
		setTimeout(() => {
			node.classList.add('visible');
		}, 90 + index * 90);
	});
}

function showToast(message) {
	toast.textContent = message;
	toast.classList.add('show');
	clearTimeout(toastTimer);
	toastTimer = setTimeout(() => {
		toast.classList.remove('show');
	}, 1000);
}

function formatCurrency(value) {
	return new Intl.NumberFormat('en-IN', {
		style: 'currency',
		currency: 'INR',
		maximumFractionDigits: 2
	}).format(value);
}

function formatShortCurrency(value) {
	if (value >= 10000000) {
		return `₹${(value / 10000000).toFixed(1)}Cr`;
	}
	if (value >= 100000) {
		return `₹${(value / 100000).toFixed(1)}L`;
	}
	if (value >= 1000) {
		return `₹${(value / 1000).toFixed(1)}K`;
	}
	return `₹${value.toFixed(0)}`;
}

function formatDate(value) {
	const date = new Date(`${value}T00:00:00`);
	return date.toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric'
	});
}

function monthName(mm) {
	const date = new Date(2026, mm - 1, 1);
	return date.toLocaleDateString('en-US', { month: 'long' });
}

function shorten(text, max) {
	if (text.length <= max) {
		return text;
	}
	return `${text.slice(0, max - 1)}…`;
}

function escapeHtml(text) {
	return text
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}
