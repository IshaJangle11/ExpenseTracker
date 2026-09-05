const form = document.getElementById('expenseForm');
const expenses = JSON.parse(localStorage.getItem("expenses")) || [];
const expenseList = document.getElementById('expenseList');
const totalAmount = document.getElementById('totalExpenses');
const filterCategory = document.getElementById('filterCategory');

function displayExpenses(expenseArray = expenses) {
    expenseList.innerHTML = ''; // empty the list before displaying

    expenseArray.forEach(function(expense , index) {
        const expenseItem = document.createElement('div');
        expenseItem.innerHTML  = `<p> Expense Name: ${expense.expenseName} | Amount: ${expense.amount} | Category: ${expense.category} | Date: ${expense.date} | <button class="edit-btn"> EDIT </button> <button class="delete-btn"> DELETE </button> </p>`;
        const deleteButton = expenseItem.querySelector('.delete-btn');
        deleteButton.addEventListener('click', function() {
            expenses.splice(index, 1); // remove the expense from the array
            saveExpenses();
            displayExpenses(); // update the displayed list
            calculateTotal(); // update the total amount
        }) 
        const editButton = expenseItem.querySelector('.edit-btn');
        editButton.addEventListener('click', function() {
           const newName = prompt("Enter expense name:", expense.expenseName);
           const newAmount = prompt("Enter expense amount:", expense.amount);
           const newCategory = prompt("Enter expense category:", expense.category);
            const newDate = prompt("enter new date:", expense.date);
            if (newName && newAmount && newCategory && newDate) {  
                expense.expenseName = newName;
                expense.amount = newAmount; 
                expense.category = newCategory;
                expense.date = newDate;
                saveExpenses();
                displayExpenses();
                calculateTotal();    
           }
           

        });
        expenseList.appendChild(expenseItem);
    });
}

function calculateTotal(expenseArray = expenses) {
    const total = expenseArray.reduce(function (sum,expense) {
        return sum +Number(expense.amount);
    },0);

    totalAmount.textContent = total;
}

function saveExpenses() {
    localStorage.setItem('expenses', JSON.stringify(expenses));
}

filterCategory.addEventListener('change', function() {
    const selectedCategory = filterCategory.value;
    const filteredExpenses = expenses.filter(function(expense) {
        return expense.category === selectedCategory || selectedCategory === 'All';
    });
    displayExpenses(filteredExpenses);
    calculateTotal(filteredExpenses);

});
form.addEventListener('submit', function(event) {
    event.preventDefault();
    const expenseName = document.getElementById('expenseName').value;
    const amount = document.getElementById('amount').value;
    const category = document.getElementById('category').value;
    const date = document.getElementById('date').value;

    const expense = {
        expenseName: expenseName,
        amount: amount,
        category: category,
        date: date
    };



    expenses.push(expense);
    saveExpenses();

    console.log(expense);
    displayExpenses();
    calculateTotal();

});


displayExpenses();
calculateTotal();