// ==== Constants and Selectors ====
const form = document.getElementById('transaction-form');
const tableBody = document.getElementById('transactionTableBody'); // Updated ID
const pagination = document.getElementById('pagination');
// Update filter selectors to match HTML
const filterType = document.getElementById('transactionType'); // Updated ID
const startDateFilter = document.getElementById('startDate');
const endDateFilter = document.getElementById('endDate');
const minAmountFilter = document.getElementById('minAmount');
const maxAmountFilter = document.getElementById('maxAmount');
const searchTextFilter = document.getElementById('searchText');
const applyFiltersBtn = document.getElementById('applyFilters');
const resetFiltersBtn = document.getElementById('resetFilters');
// Chart selectors
const typeChartCanvas = document.getElementById('typeChart'); // Updated ID
const monthlyChartCanvas = document.getElementById('monthlyChart'); // Updated ID

const ITEMS_PER_PAGE = 5;
let currentPage = 1;
let transactions = JSON.parse(localStorage.getItem('transactions')) || [];

// ==== Chart Setup ====
let chart = new Chart(typeChartCanvas, {
    type: 'bar',
    data: {
        labels: [],
        datasets: [{
            label: 'Amount by Category',
            data: [],
            backgroundColor: 'rgba(54, 162, 235, 0.6)',
        }]
    },
    options: {
        responsive: true,
        scales: {
            y: {
                beginAtZero: true
            }
        }
    }
});

// ==== Form Submission ====
form.addEventListener('submit', (e) => {
    e.preventDefault();

    const newTransaction = {
        id: Date.now(),
        amount: parseFloat(form.amount.value),
        type: form.type.value,
        category: form.category.value,
        date: form.date.value,
        description: form.description.value.trim(),
    };

    transactions.push(newTransaction);
    localStorage.setItem('transactions', JSON.stringify(transactions));
    form.reset();

    renderTable();
    renderChart();
});

// ==== Table Rendering ====
function renderTable() {
    const filtered = getFilteredTransactions();
    const paginated = paginate(filtered, currentPage);

    tableBody.innerHTML = '';
    paginated.forEach(tx => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${tx.date}</td>
            <td>${tx.type}</td>
            <td>${tx.category}</td>
            <td>${tx.amount}</td>
            <td>${tx.description}</td>
        `;
        tableBody.appendChild(row);
    });

    renderPagination(filtered.length);
}

// ==== Filtering ====
applyFiltersBtn.addEventListener('click', () => {
    currentPage = 1;
    renderTable();
    renderChart();
});

resetFiltersBtn.addEventListener('click', () => {
    filterType.value = '';
    startDateFilter.value = '';
    endDateFilter.value = '';
    minAmountFilter.value = '';
    maxAmountFilter.value = '';
    searchTextFilter.value = '';
    
    currentPage = 1;
    renderTable();
    renderChart();
});

function getFilteredTransactions() {
    return transactions.filter(tx => {
        // Type filter
        if (filterType.value && tx.type !== filterType.value && tx.category !== filterType.value) {
            return false;
        }
        
        // Date range filter
        if (startDateFilter.value && tx.date < startDateFilter.value) {
            return false;
        }
        if (endDateFilter.value && tx.date > endDateFilter.value) {
            return false;
        }
        
        // Amount range filter
        if (minAmountFilter.value && tx.amount < parseFloat(minAmountFilter.value)) {
            return false;
        }
        if (maxAmountFilter.value && tx.amount > parseFloat(maxAmountFilter.value)) {
            return false;
        }
        
        // Search text filter
        if (searchTextFilter.value && 
            !tx.description.toLowerCase().includes(searchTextFilter.value.toLowerCase())) {
            return false;
        }
        
        return true;
    });
}

// ==== Pagination ====
function paginate(array, page) {
    const start = (page - 1) * ITEMS_PER_PAGE;
    return array.slice(start, start + ITEMS_PER_PAGE);
}

function renderPagination(totalItems) {
    pagination.innerHTML = '';
    const pageCount = Math.ceil(totalItems / ITEMS_PER_PAGE);

    for (let i = 1; i <= pageCount; i++) {
        const btn = document.createElement('button');
        btn.textContent = i;
        btn.className = i === currentPage ? 'active' : '';
        btn.addEventListener('click', () => {
            currentPage = i;
            renderTable();
        });
        pagination.appendChild(btn);
    }
}

// ==== Chart Rendering ====
function renderChart() {
    const filtered = getFilteredTransactions();
    const summary = {};

    filtered.forEach(tx => {
        if (!summary[tx.category]) {
            summary[tx.category] = 0;
        }
        summary[tx.category] += tx.amount;
    });

    chart.data.labels = Object.keys(summary);
    chart.data.datasets[0].data = Object.values(summary);
    chart.update();
}

// ==== Initial Load ====
renderTable();
renderChart();

// ==== XML Import ====
const importForm = document.getElementById('import-form');

importForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const fileInput = document.getElementById('xml-file');
    
    if (fileInput.files.length === 0) {
        alert('Please select an XML file to import');
        return;
    }
    
    const file = fileInput.files[0];
    const reader = new FileReader();
    
    reader.onload = (e) => {
        const xmlString = e.target.result;
        try {
            const importedTransactions = parseXmlSms(xmlString);
            
            if (importedTransactions.length > 0) {
                // Add imported transactions to existing ones
                transactions = [...transactions, ...importedTransactions];
                localStorage.setItem('transactions', JSON.stringify(transactions));
                
                // Update UI
                renderTable();
                renderChart();
                
                alert(`Successfully imported ${importedTransactions.length} transactions!`);
                importForm.reset();
            } else {
                alert('No valid transactions found in the XML file');
            }
        } catch (err) {
            console.error('Error parsing XML:', err);
            alert('Error parsing the XML file. Please ensure it contains valid SMS data.');
        }
    };
    
    reader.onerror = () => {
        alert('Error reading the file');
    };
    
    reader.readAsText(file);
});

// Function to parse XML and extract transactions
function parseXmlSms(xmlString) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
    const smsNodes = xmlDoc.getElementsByTagName('sms');
    
    const parsedTransactions = [];
    
    for (let i = 0; i < smsNodes.length; i++) {
        const sms = smsNodes[i];
        const body = sms.getAttribute('body');
        const dateMs = parseInt(sms.getAttribute('date'));
        const smsDate = new Date(dateMs);
        
        // Only process mobile money SMS
        if (body.includes('RWF') && isMobileMoneyMessage(body)) {
            // Extract transaction details
            const transaction = extractTransactionDetails(body, smsDate);
            if (transaction) {
                parsedTransactions.push(transaction);
            }
        }
    }
    
    return parsedTransactions;
}

function isMobileMoneyMessage(body) {
    // Check if this is a mobile money message
    const mobileMoneyKeywords = ['M-PESA', 'Mobile Money', 'transaction', 'received', 
                               'sent', 'payment', 'transfer', 'balance', 'withdraw'];
    
    return mobileMoneyKeywords.some(keyword => 
        body.toLowerCase().includes(keyword.toLowerCase()));
}

function extractTransactionDetails(body, date) {
    // Default transaction object
    const transaction = {
        id: Date.now() + Math.random().toString(16).slice(2),
        date: date.toISOString().split('T')[0],
        amount: 0,
        description: body,
        type: 'unknown',
        category: 'Uncategorized'
    };
    
    // Extract amount
    const amountMatch = body.match(/(\d{1,3}(?:,\d{3})*|\d+)(?:\.\d+)?\s*RWF/i);
    if (amountMatch) {
        transaction.amount = parseFloat(amountMatch[1].replace(/,/g, ''));
    }
    
    // Categorize the transaction
    transaction.category = categorizeMessage(body);
    
    // Determine if incoming or outgoing
    if (transaction.category === 'Incoming Money') {
        transaction.type = 'incoming';
    } else {
        transaction.type = 'outgoing';
    }
    
    return transaction;
}

function categorizeMessage(body) {
    if (/received .* RWF/i.test(body)) return 'Incoming Money';
    if (/payment .* to .* \d{4,}/i.test(body)) return 'Payments to Code Holders';
    if (/payment .* to .* [a-z]+/i.test(body)) return 'Transfers to Mobile Numbers';
    if (/bank deposit/i.test(body)) return 'Bank Deposits';
    if (/airtime/i.test(body)) return 'Airtime Bill Payments';
    if (/cash power/i.test(body)) return 'Cash Power Bill Payments';
    if (/initiated by/i.test(body)) return 'Third Party Transactions';
    if (/withdrawal/i.test(body)) return 'Withdrawals from Agents';
    if (/bank transfer/i.test(body)) return 'Bank Transfers';
    if (/bundle/i.test(body)) return 'Bundle Purchases';
    return 'Uncategorized';
}
