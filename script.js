const form = document.getElementById('expenseForm');
const expenseList = document.getElementById('expenseList');
const totalAmount = document.getElementById('totalExpenses');
const monthlyAmount = document.getElementById('monthlyExpenses');
const expenseCount = document.getElementById('expenseCount');
const highestAmount = document.getElementById('highestExpense');
const filterCategory = document.getElementById('filterCategory');
const searchExpenses = document.getElementById('searchExpenses');
const sortExpenses = document.getElementById('sortExpenses');
const clearExpenses = document.getElementById('clearExpenses');
const exportExpenses = document.getElementById('exportExpenses');
const editDialog = document.getElementById('editDialog');
const editForm = document.getElementById('editForm');
const cancelEdit = document.getElementById('cancelEdit');
const storageStatus = document.getElementById('storageStatus');

const DATABASE_NAME = 'expenseTrackerDB';
const DATABASE_VERSION = 1;
const STORE_NAME = 'expenses';

let database;
let editingId = null;
let expenses = [];

function openDatabase() {
    return new Promise((resolve, reject) => {
        if (!('indexedDB' in window)) {
            reject(new Error('IndexedDB is not supported by this browser.'));
            return;
        }

        const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };

        request.onsuccess = () => {
            database = request.result;
            database.onversionchange = () => database.close();
            resolve(database);
        };

        request.onerror = () => {
            reject(request.error || new Error('Could not open the expense database.'));
        };
    });
}

function transactionError(transaction) {
    return transaction.error || new Error('The database transaction failed.');
}

function readExpenses() {
    return new Promise((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, 'readonly');
        const request = transaction.objectStore(STORE_NAME).getAll();
        let result;

        request.onsuccess = () => {
            result = request.result;
        };
        request.onerror = () => reject(request.error || transactionError(transaction));
        transaction.oncomplete = () => resolve(result);
        transaction.onabort = () => reject(transactionError(transaction));
    });
}

function writeTransaction(operation) {
    return new Promise((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, 'readwrite');
        transaction.oncomplete = () => resolve();
        transaction.onabort = () => reject(transactionError(transaction));
        transaction.onerror = () => reject(transactionError(transaction));

        try {
            operation(transaction.objectStore(STORE_NAME));
        } catch (error) {
            transaction.abort();
            reject(error);
        }
    });
}

function migrateLocalStorage() {
    const saved = localStorage.getItem('expenses');
    if (saved === null) return Promise.resolve();

    let oldExpenses;
    try {
        oldExpenses = JSON.parse(saved);
    } catch (error) {
        return Promise.reject(new Error('Existing saved expenses could not be read.'));
    }

    if (!Array.isArray(oldExpenses)) {
        return Promise.reject(new Error('Existing saved expenses have an invalid format.'));
    }

    return new Promise((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const countRequest = store.count();

        countRequest.onsuccess = () => {
            if (countRequest.result === 0) {
                oldExpenses.forEach((expense, index) => {
                    store.add({
                        id: `migrated-${Date.now()}-${index}`,
                        expenseName: String((expense && expense.expenseName) || ''),
                        amount: Number((expense && expense.amount)) || 0,
                        category: (expense && expense.category) || 'Other',
                        date: (expense && expense.date) || new Date().toISOString().slice(0, 10)
                    });
                });
            }
        };
        countRequest.onerror = () => reject(countRequest.error || transactionError(transaction));
        transaction.oncomplete = () => {
            try {
                localStorage.removeItem('expenses');
                resolve();
            } catch (error) {
                reject(error);
            }
        };
        transaction.onabort = () => reject(transactionError(transaction));
        transaction.onerror = () => reject(transactionError(transaction));
    });
}

function showStorageError(message, error) {
    console.error(message, error);
    storageStatus.textContent = message;
    storageStatus.hidden = false;
}

function clearStorageError() {
    storageStatus.textContent = '';
    storageStatus.hidden = true;
}

function formatMoney(value) {
    return Number(value).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function formatDate(value) {
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function getFilteredExpenses() {
    const category = filterCategory.value;
    const search = searchExpenses.value.trim().toLowerCase();
    const sort = sortExpenses.value;

    const filtered = expenses.filter((expense) => {
        const matchesCategory = category === 'All' || expense.category === category;
        const matchesSearch = !search ||
            expense.expenseName.toLowerCase().includes(search) ||
            expense.category.toLowerCase().includes(search);
        return matchesCategory && matchesSearch;
    });

    return [...filtered].sort((a, b) => {
        if (sort === 'date-asc') return a.date.localeCompare(b.date);
        if (sort === 'amount-desc') return b.amount - a.amount;
        if (sort === 'amount-asc') return a.amount - b.amount;
        if (sort === 'name-asc') return a.expenseName.localeCompare(b.expenseName);
        return b.date.localeCompare(a.date);
    });
}

function displayExpenses() {
    const visibleExpenses = getFilteredExpenses();
    expenseList.replaceChildren();

    if (visibleExpenses.length === 0) {
        const emptyState = document.createElement('p');
        emptyState.className = 'empty-state';
        emptyState.textContent = expenses.length
            ? 'No expenses match your filters.'
            : 'No expenses yet. Add your first expense.';
        expenseList.appendChild(emptyState);
        return;
    }

    visibleExpenses.forEach((expense) => {
        const item = document.createElement('article');
        item.className = 'expense-item';

        const icon = document.createElement('div');
        icon.className = 'category-icon';
        icon.textContent = expense.category.charAt(0).toUpperCase();
        icon.title = expense.category;

        const details = document.createElement('div');
        details.className = 'expense-details';
        const name = document.createElement('strong');
        name.textContent = expense.expenseName;
        const meta = document.createElement('span');
        meta.textContent = `${expense.category} · ${formatDate(expense.date)}`;
        details.append(name, meta);

        const amount = document.createElement('div');
        amount.className = 'expense-amount';
        amount.append(document.createTextNode(`$${formatMoney(expense.amount)}`));

        const actions = document.createElement('div');
        actions.className = 'expense-actions';
        const editButton = document.createElement('button');
        editButton.type = 'button';
        editButton.className = 'edit-btn';
        editButton.textContent = 'Edit';
        editButton.setAttribute('aria-label', `Edit ${expense.expenseName}`);
        editButton.addEventListener('click', () => openEditDialog(expense.id));

        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.className = 'delete-btn';
        deleteButton.textContent = 'Delete';
        deleteButton.setAttribute('aria-label', `Delete ${expense.expenseName}`);
        deleteButton.addEventListener('click', () => deleteExpense(expense.id));

        actions.append(editButton, deleteButton);
        item.append(icon, details, amount, actions);
        expenseList.appendChild(item);
    });
}

function calculateSummary() {
    const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthlyTotal = expenses
        .filter((expense) => expense.date.startsWith(currentMonth))
        .reduce((sum, expense) => sum + expense.amount, 0);
    const highest = expenses.reduce((max, expense) => Math.max(max, expense.amount), 0);

    totalAmount.textContent = formatMoney(total);
    monthlyAmount.textContent = formatMoney(monthlyTotal);
    expenseCount.textContent = String(expenses.length);
    highestAmount.textContent = formatMoney(highest);
}

function renderExpenses() {
    displayExpenses();
    calculateSummary();
}

async function deleteExpense(id) {
    const expense = expenses.find((item) => item.id === id);
    if (!expense || !confirm(`Delete "${expense.expenseName}"?`)) return;

    try {
        await writeTransaction((store) => store.delete(id));
        expenses = expenses.filter((item) => item.id !== id);
        clearStorageError();
        renderExpenses();
    } catch (error) {
        showStorageError('Could not delete the expense. Please try again.', error);
    }
}

function openEditDialog(id) {
    const expense = expenses.find((item) => item.id === id);
    if (!expense) return;

    editingId = id;
    document.getElementById('editName').value = expense.expenseName;
    document.getElementById('editAmount').value = expense.amount;
    document.getElementById('editCategory').value = expense.category;
    document.getElementById('editDate').value = expense.date;
    editDialog.showModal();
}

function exportToCsv() {
    if (expenses.length === 0) {
        alert('There are no expenses to export.');
        return;
    }

    const rows = [
        ['Expense Name', 'Amount', 'Category', 'Date'],
        ...expenses.map((expense) => [
            expense.expenseName,
            expense.amount.toFixed(2),
            expense.category,
            expense.date
        ])
    ];
    const csv = rows.map((row) =>
        row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')
    ).join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `expenses-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
}

form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const expense = {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        expenseName: document.getElementById('expenseName').value.trim(),
        amount: Number(document.getElementById('amount').value),
        category: document.getElementById('category').value,
        date: document.getElementById('date').value
    };

    if (!expense.expenseName || !expense.category || !expense.date || expense.amount <= 0) return;

    try {
        await writeTransaction((store) => store.add(expense));
        expenses.push(expense);
        form.reset();
        document.getElementById('date').value = new Date().toISOString().slice(0, 10);
        clearStorageError();
        renderExpenses();
    } catch (error) {
        showStorageError('Could not save the expense. Please try again.', error);
    }
});

editForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const existing = expenses.find((item) => item.id === editingId);
    if (!existing) return;

    const updatedExpense = {
        ...existing,
        expenseName: document.getElementById('editName').value.trim(),
        amount: Number(document.getElementById('editAmount').value),
        category: document.getElementById('editCategory').value,
        date: document.getElementById('editDate').value
    };

    if (!updatedExpense.expenseName || !updatedExpense.date || updatedExpense.amount <= 0) return;

    try {
        await writeTransaction((store) => store.put(updatedExpense));
        expenses = expenses.map((item) => item.id === editingId ? updatedExpense : item);
        editDialog.close();
        editingId = null;
        clearStorageError();
        renderExpenses();
    } catch (error) {
        showStorageError('Could not update the expense. Please try again.', error);
    }
});

cancelEdit.addEventListener('click', () => {
    editingId = null;
    editDialog.close();
});

clearExpenses.addEventListener('click', async () => {
    if (expenses.length === 0) return;
    if (!confirm('Clear all expenses? This cannot be undone.')) return;

    try {
        await writeTransaction((store) => store.clear());
        expenses = [];
        clearStorageError();
        renderExpenses();
    } catch (error) {
        showStorageError('Could not clear expenses. Please try again.', error);
    }
});

filterCategory.addEventListener('change', displayExpenses);
searchExpenses.addEventListener('input', displayExpenses);
sortExpenses.addEventListener('change', displayExpenses);
exportExpenses.addEventListener('click', exportToCsv);

document.getElementById('date').value = new Date().toISOString().slice(0, 10);
form.querySelector('button[type="submit"]').disabled = true;
clearExpenses.disabled = true;
exportExpenses.disabled = true;
renderExpenses();

openDatabase()
    .then(migrateLocalStorage)
    .then(readExpenses)
    .then((savedExpenses) => {
        expenses = savedExpenses;
        form.querySelector('button[type="submit"]').disabled = false;
        clearExpenses.disabled = false;
        exportExpenses.disabled = false;
        clearStorageError();
        renderExpenses();
    })
    .catch((error) => {
        form.querySelector('button[type="submit"]').disabled = true;
        clearExpenses.disabled = true;
        exportExpenses.disabled = true;
        showStorageError('Could not load expenses from this browser. Check storage permissions and reload.', error);
    });
