let transactions = JSON.parse(localStorage.getItem("transactions")) || [];
let charts = {};

// --- Service Worker Registration ---
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js') // You would need to create sw.js
      .then(registration => {
        console.log('Service Worker registered:', registration);
      })
      .catch(error => {
        console.error('Service Worker registration failed:', error);
      });
  });
}

// --- IndexedDB Placeholder ---
// For a more robust offline experience and larger data sets,
// you would replace localStorage with IndexedDB.
// Example conceptual structure:
/*
let db;
function openIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("budgetDB", 1);

    request.onupgradeneeded = (event) => {
      db = event.target.result;
      db.createObjectStore("transactions", { keyPath: "id" });
    };

    request.onsuccess = (event) => {
      db = event.target.result;
      resolve(db);
    };

    request.onerror = (event) => {
      console.error("IndexedDB error:", event.target.errorCode);
      reject(event.target.errorCode);
    };
  });
}

async function saveTransactionIndexedDB(transaction) {
  const db = await openIndexedDB();
  const tx = db.transaction("transactions", "readwrite");
  tx.objectStore("transactions").put(transaction);
  return tx.complete;
}

async function getTransactionsIndexedDB() {
  const db = await openIndexedDB();
  const tx = db.transaction("transactions", "readonly");
  const store = tx.objectStore("transactions");
  return store.getAll();
}

// Call openIndexedDB on load and use these functions instead of localStorage
// window.onload = async function() {
//   await openIndexedDB();
//   transactions = await getTransactionsIndexedDB();
//   updateUI();
//   document.getElementById("date").valueAsDate = new Date();
// };
*/


// Initialize date to today
document.getElementById("date").valueAsDate = new Date();

function saveToStorage() {
  localStorage.setItem("transactions", JSON.stringify(transactions));
}

function addTransaction() {
  const desc = document.getElementById("desc").value.trim();
  const amount = parseFloat(document.getElementById("amount").value);
  const date = document.getElementById("date").value;
  const type = document.getElementById("type").value;
  const category = document.getElementById("category").value;

  if (!desc || isNaN(amount) || amount <= 0 || !date) {
    alert("Please fill all fields correctly.");
    return;
  }

  const entry = { 
    id: Date.now(), 
    desc, 
    amount, 
    date, 
    type, 
    category 
  };
  
  transactions.push(entry);
  saveToStorage();
  updateUI();
  clearInputs();
}

function clearInputs() {
  document.getElementById("desc").value = '';
  document.getElementById("amount").value = '';
  document.getElementById("date").valueAsDate = new Date();
}

function updateUI(data = transactions) {
  // Apply current filters and sorts before updating UI components
  let currentData = [...data];
  currentData = applyFilters(currentData);
  currentData = applySort(currentData);

  updateSummary(currentData);
  updateTransactionLog(currentData); // Pass filtered/sorted data to log
  updateCharts(currentData);
  updateAISuggestions(data); // AI suggestions should use all data for comprehensive analysis
}

function updateSummary(data) {
  let inflow = 0, outflow = 0;
  
  data.forEach(t => {
    if (t.type === 'inflow') inflow += t.amount;
    else outflow += t.amount;
  });

  const net = inflow - outflow;
  const savingsRate = inflow > 0 ? ((net / inflow) * 100) : 0;

  document.getElementById("inflow").textContent = inflow.toFixed(2);
  document.getElementById("outflow").textContent = outflow.toFixed(2);
  document.getElementById("net").textContent = net.toFixed(2);
  document.getElementById("status").textContent = net >= 0 ? "Profit 🟢" : "Loss 🔴";
  document.getElementById("savingsRate").textContent = savingsRate.toFixed(1);
}

function updateTransactionLog(data) {
  const logList = document.getElementById("logList");
  logList.innerHTML = '';

  if (data.length === 0) {
    logList.innerHTML = '<li class="no-transactions">No transactions to display.</li>';
    return;
  }

  data.forEach(t => {
    const li = document.createElement('li');
    li.innerHTML = `
      <div class="transaction-info">
        <span class="date">📅 ${formatDate(t.date)}</span>
        <span class="desc">${t.desc}</span>
        <span class="category">${getCategoryIcon(t.category)} ${t.category}</span>
      </div>
      <div class="transaction-amount ${t.type}">
        ₹${t.amount.toFixed(2)}
        <span class="delete-btn" onclick="confirmDeleteTransaction(${t.id})">❌</span>
      </div>
    `;
    logList.appendChild(li);
  });
}

function formatDate(dateString) {
  const options = { year: 'numeric', month: 'short', day: 'numeric' };
  return new Date(dateString).toLocaleDateString(undefined, options);
}

function getCategoryIcon(category) {
  const icons = {
    'general': '🏷️',
    'salary': '💰',
    'business': '💼',
    'food': '🍔',
    'transport': '🚗',
    'entertainment': '🎬',
    'shopping': '🛍️',
    'health': '🏥',
    'education': '📚'
  };
  return icons[category] || '🏷️';
}

function confirmDeleteTransaction(id) {
  if (confirm("Are you sure you want to delete this transaction?")) {
    deleteTransaction(id);
  }
}

function deleteTransaction(id) {
  transactions = transactions.filter(t => t.id !== id);
  saveToStorage();
  updateUI();
}

function clearLog() {
  if (confirm("Are you sure you want to clear all transactions? This action cannot be undone.")) {
    transactions = [];
    saveToStorage();
    updateUI();
  }
}

function updateCharts(data) {
  updateMainChart(data);
  updateCategoryChart(data);
}

function updateMainChart(data) {
  const ctx = document.getElementById('myChart').getContext('2d');
  let inflow = 0, outflow = 0;
  
  data.forEach(t => {
    if (t.type === 'inflow') inflow += t.amount;
    else outflow += t.amount;
  });

  if (charts.main) charts.main.destroy();

  charts.main = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Inflow 💰', 'Outflow 💸'],
      datasets: [{
        data: [inflow, outflow],
        backgroundColor: ['#28a745', '#dc3545'],
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'bottom',
        },
        title: {
          display: true,
          text: 'Income vs Expenses'
        }
      }
    }
  });
}

function updateCategoryChart(data) {
  const ctx = document.getElementById('categoryChart').getContext('2d');
  const categories = {};
  
  data.filter(t => t.type === 'outflow').forEach(t => {
    categories[t.category] = (categories[t.category] || 0) + t.amount;
  });

  const categoryLabels = Object.keys(categories);
  const categoryData = Object.values(categories);

  if (charts.category) charts.category.destroy();

  if (categoryLabels.length > 0) {
    charts.category = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: categoryLabels.map(cat => `${getCategoryIcon(cat)} ${cat}`),
        datasets: [{
          data: categoryData,
          backgroundColor: [
            '#ff6384', '#36a2eb', '#ffce56', '#4bc0c0', 
            '#9966ff', '#ff9f40', '#8ac24a', '#607d8b',
            '#a1c9f4', '#8de5a1', '#ff9f40' // More colors for more categories
          ]
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: 'bottom',
          },
          title: {
            display: true,
            text: 'Expense Categories'
          }
        }
      }
    });
  } else {
    // If no outflow data, display a message or clear the chart area
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    // You might want to add text like "No expense data for chart"
  }
}

// --- AI Financial Advisor Enhancements ---

function calculateCategorySpending(data) {
  const categorySpending = {};
  data.filter(t => t.type === 'outflow').forEach(t => {
    categorySpending[t.category] = (categorySpending[t.category] || 0) + t.amount;
  });
  return categorySpending;
}

function getPreviousMonthData(allTransactions) {
  const now = new Date();
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  return allTransactions.filter(t => {
    const tDate = new Date(t.date);
    return tDate >= prevMonth && tDate < currentMonth;
  });
}

function updateAISuggestions(allTransactions) { // Use allTransactions for AI analysis
  const ai = document.getElementById("aiSuggestion");
  const insights = document.getElementById("spendingInsights");
  const anomalyDetection = document.getElementById("anomalyDetection");
  insights.innerHTML = '';
  anomalyDetection.innerHTML = '';
  
  if (allTransactions.length === 0) {
    ai.textContent = "🧠 Start adding entries to get personalized financial tips.";
    return;
  }

  // Calculate totals for current period
  let inflow = 0, outflow = 0;
  const currentCategorySpending = calculateCategorySpending(allTransactions);
  
  allTransactions.forEach(t => {
    if (t.type === 'inflow') inflow += t.amount;
    else outflow += t.amount;
  });

  const net = inflow - outflow;
  const savingsRate = inflow > 0 ? (net / inflow) * 100 : 0;

  // --- Main Financial Advice ---
  if (net < 0) {
    ai.textContent = "🚨 You're currently in a deficit! Your expenses exceed your income. Review your spending.";
  } else if (savingsRate < 10 && inflow > 0) {
    ai.textContent = "⚠️ Your savings rate is low. Aim to save at least 10-20% of your income for financial security.";
  } else if (savingsRate >= 20) {
    ai.textContent = "🎉 Excellent! You're saving more than 20% of your income. Keep up the great work!";
  } else if (net > 0) {
    ai.textContent = "👍 Good job! Your finances are balanced. Consider increasing your savings rate if possible.";
  } else {
    ai.textContent = "🧠 Analyze your transactions to get personalized tips.";
  }

  // --- Spending Insights ---
  if (Object.keys(currentCategorySpending).length > 0) {
    const topCategories = Object.entries(currentCategorySpending)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    
    insights.innerHTML = '<strong>💰 Top Spending Categories:</strong><ul>' +
      topCategories.map(([cat, amount]) => 
        `<li>${getCategoryIcon(cat)} ${cat}: ₹${amount.toFixed(2)} (${(amount/outflow*100).toFixed(1)}% of total expenses)</li>`
      ).join('') + '</ul>';
  }

  // --- Anomaly Detection ---
  const prevMonthTransactions = getPreviousMonthData(allTransactions);
  if (prevMonthTransactions.length > 0) {
    const prevMonthCategorySpending = calculateCategorySpending(prevMonthTransactions);
    let anomaliesFound = false;
    let anomalyHtml = '<strong>📈 Spending Anomaly Alerts:</strong><ul>';

    for (const category in currentCategorySpending) {
      const currentAmount = currentCategorySpending[category];
      const prevAmount = prevMonthCategorySpending[category] || 0;

      // Define a threshold for anomaly (e.g., 50% increase and significant amount)
      if (currentAmount > prevAmount * 1.5 && currentAmount > 500) { // 50% increase and over ₹500
        anomalyHtml += `<li>🚨 Your spending in ${getCategoryIcon(category)} ${category} (₹${currentAmount.toFixed(2)}) is significantly higher than last month (₹${prevAmount.toFixed(2)}).</li>`;
        anomaliesFound = true;
      }
    }
    anomalyHtml += '</ul>';

    if (anomaliesFound) {
      anomalyDetection.innerHTML = anomalyHtml;
    } else {
      anomalyDetection.innerHTML = '<p>✅ No significant spending anomalies detected this period compared to last month.</p>';
    }
  } else {
    anomalyDetection.innerHTML = '<p>📊 Add more data over time to enable spending anomaly detection.</p>';
  }
}

// --- Filtering and Sorting ---

function applyFilters(data) {
  const timeFilter = document.getElementById("timeFilter").value;
  const categoryFilter = document.getElementById("categoryFilter").value;
  
  let filtered = [...data];
  
  // Apply time filter
  if (timeFilter !== 'all') {
    const now = new Date();
    filtered = filtered.filter(t => {
      const tDate = new Date(t.date);
      
      if (timeFilter === 'month') {
        return tDate.getMonth() === now.getMonth() && 
               tDate.getFullYear() === now.getFullYear();
      } else if (timeFilter === 'week') {
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return tDate >= oneWeekAgo;
      }
      return true;
    });
  }
  
  // Apply category filter
  if (categoryFilter !== 'all') {
    filtered = filtered.filter(t => t.category === categoryFilter);
  }

  // Apply search filter
  const searchTerm = document.getElementById("searchDesc").value.toLowerCase();
  if (searchTerm) {
    filtered = filtered.filter(t => t.desc.toLowerCase().includes(searchTerm));
  }
  
  return filtered;
}

function applySort(data) {
  const sortOrder = document.getElementById("sortOrder").value;
  let sorted = [...data];

  switch (sortOrder) {
    case 'dateDesc':
      sorted.sort((a, b) => new Date(b.date) - new Date(a.date));
      break;
    case 'dateAsc':
      sorted.sort((a, b) => new Date(a.date) - new Date(b.date));
      break;
    case 'amountDesc':
      sorted.sort((a, b) => b.amount - a.amount);
      break;
    case 'amountAsc':
      sorted.sort((a, b) => a.amount - b.amount);
      break;
  }
  return sorted;
}

function filterTransactions() {
  // This function now just triggers a UI update, which will apply all filters and sorts
  updateUI(transactions); 
}

function searchTransactions() {
  updateUI(transactions); // Re-render UI with search applied
}

function sortTransactions() {
  updateUI(transactions); // Re-render UI with sort applied
}


function downloadCSV() {
  let csv = "Date,Description,Amount,Type,Category\n";
  transactions.forEach(t => {
    // Ensure description with commas are quoted
    const safeDesc = t.desc.includes(',') ? `"${t.desc}"` : t.desc;
    csv += `${t.date},${safeDesc},${t.amount},${t.type},${t.category}\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'transactions.csv';
  a.click();
}

// Initialize on load
window.onload = function() {
  updateUI();
  document.getElementById("date").valueAsDate = new Date();
};

