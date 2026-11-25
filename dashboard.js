const DATABASE_NAME = 'expenseTrackerDB';
const DATABASE_VERSION = 1;
const STORE_NAME = 'expenses';

const totalExpenses = document.getElementById('totalExpenses');
const monthlyExpenses = document.getElementById('monthlyExpenses');
const expenseCount = document.getElementById('expenseCount');
const highestExpense = document.getElementById('highestExpense');
const categoryBreakdown = document.getElementById('categoryBreakdown');
const recentExpensesList = document.getElementById('recentExpenses');
const dashboardStatus = document.getElementById('dashboardStatus');

function openDatabase() {
    return new Promise((resolve, reject) => {
        if (!('indexedDB' in window)) {
            reject(new Error('IndexedDB is not supported by this browser.'));
            return;
        }

        const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

        request.onupgradeneeded = () => {
            const database = request.result;
            if (!database.objectStoreNames.contains(STORE_NAME)) {
                database.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };

        request.onsuccess = () => {
            const database = request.result;
            database.onversionchange = () => database.close();
            resolve(database);
        };

        request.onerror = () => {
            reject(request.error || new Error('Could not open the expense database.'));
        };
    });
}

function readExpenses(database) {
    return new Promise((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, 'readonly');
        const request = transaction.objectStore(STORE_NAME).getAll();
        let result;

        request.onsuccess = () => {
            result = request.result;
        };
        request.onerror = () => reject(request.error || transaction.error);
        transaction.oncomplete = () => resolve(result);
        transaction.onabort = () => reject(transaction.error || new Error('Could not read expenses.'));
    });
}

function formatMoney(value) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR'
    }).format(Number(value) || 0);
}

function formatDate(value) {
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function displaySummary(expenses) {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthlyTotal = expenses
        .filter((expense) => expense.date.startsWith(currentMonth))
        .reduce((sum, expense) => sum + Number(expense.amount), 0);
    const total = expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
    const highest = expenses.reduce(
        (max, expense) => Math.max(max, Number(expense.amount)),
        0
    );

    totalExpenses.textContent = formatMoney(total);
    monthlyExpenses.textContent = formatMoney(monthlyTotal);
    expenseCount.textContent = String(expenses.length);
    highestExpense.textContent = formatMoney(highest);
}

function displayCategoryBreakdown(expenses) {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const totals = new Map();

    expenses
        .filter((expense) => expense.date.startsWith(currentMonth))
        .forEach((expense) => {
            totals.set(
                expense.category,
                (totals.get(expense.category) || 0) + Number(expense.amount)
            );
        });

    const categories = [...totals.entries()].sort((a, b) => b[1] - a[1]);
    const largestTotal = categories.length ? categories[0][1] : 0;
    categoryBreakdown.replaceChildren();

    if (categories.length === 0) {
        const emptyState = document.createElement('p');
        emptyState.className = 'dashboard-empty';
        emptyState.textContent = 'No expenses recorded this month yet.';
        categoryBreakdown.appendChild(emptyState);
        return;
    }

    categories.forEach(([category, amount]) => {
        const row = document.createElement('div');
        row.className = 'category-row';

        const heading = document.createElement('div');
        heading.className = 'category-row-heading';
        const name = document.createElement('span');
        name.textContent = category;
        const total = document.createElement('strong');
        total.textContent = formatMoney(amount);
        heading.append(name, total);

        const track = document.createElement('div');
        track.className = 'category-bar-track';
        track.setAttribute('role', 'meter');
        track.setAttribute('aria-label', `${category} spending this month`);
        track.setAttribute('aria-valuemin', '0');
        track.setAttribute('aria-valuemax', '100');
        const percentage = Math.round((amount / largestTotal) * 100);
        track.setAttribute('aria-valuenow', String(percentage));

        const fill = document.createElement('div');
        fill.className = 'category-bar-fill';
        fill.style.width = `${percentage}%`;
        track.appendChild(fill);
        row.append(heading, track);
        categoryBreakdown.appendChild(row);
    });
}

function displayRecentExpenses(expenses) {
    const recent = [...expenses]
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 5);
    recentExpensesList.replaceChildren();

    if (recent.length === 0) {
        const emptyState = document.createElement('p');
        emptyState.className = 'dashboard-empty';
        emptyState.textContent = 'Your recent expenses will appear here.';
        recentExpensesList.appendChild(emptyState);
        return;
    }

    recent.forEach((expense) => {
        const row = document.createElement('div');
        row.className = 'recent-expense';

        const details = document.createElement('div');
        details.className = 'recent-expense-details';
        const name = document.createElement('strong');
        name.textContent = expense.expenseName;
        const meta = document.createElement('span');
        meta.textContent = `${expense.category} · ${formatDate(expense.date)}`;
        details.append(name, meta);

        const amount = document.createElement('strong');
        amount.className = 'recent-expense-amount';
        amount.textContent = formatMoney(expense.amount);
        row.append(details, amount);
        recentExpensesList.appendChild(row);
    });
}

async function loadDashboard() {
    try {
        const database = await openDatabase();
        const expenses = await readExpenses(database);
        database.close();
        displaySummary(expenses);
        displayCategoryBreakdown(expenses);
        displayRecentExpenses(expenses);
    } catch (error) {
        console.error('Could not load dashboard data.', error);
        dashboardStatus.textContent = 'Could not load dashboard data. Check browser storage and try again.';
        dashboardStatus.hidden = false;
    }
}

loadDashboard();
