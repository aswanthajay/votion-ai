import React, { useState, useMemo } from 'react'
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Plus,
  Trash2,
  Filter,
  Search,
  PieChart,
  ShoppingBag,
  Utensils,
  Zap,
  Car,
  Film,
  HeartPulse,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  X,
  CreditCard,
  Briefcase
} from 'lucide-react'

const CATEGORY_CONFIG = {
  'Food & Dining': { color: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/40', icon: Utensils },
  'Housing & Utilities': { color: 'bg-blue-500', text: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/40', icon: Zap },
  'Transportation': { color: 'bg-purple-500', text: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-950/40', icon: Car },
  'Entertainment': { color: 'bg-pink-500', text: 'text-pink-600 dark:text-pink-400', bg: 'bg-pink-50 dark:bg-pink-950/40', icon: Film },
  'Shopping': { color: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/40', icon: ShoppingBag },
  'Health & Fitness': { color: 'bg-rose-500', text: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-950/40', icon: HeartPulse },
  'Income & Freelance': { color: 'bg-teal-500', text: 'text-teal-600 dark:text-teal-400', bg: 'bg-teal-50 dark:bg-teal-950/40', icon: Briefcase },
  'Other': { color: 'bg-slate-500', text: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-50 dark:bg-slate-950/40', icon: CreditCard }
}

const INITIAL_TRANSACTIONS = [
  { id: '1', description: 'Whole Foods Market', amount: 128.40, category: 'Food & Dining', type: 'expense', date: '2026-09-12' },
  { id: '2', description: 'Monthly Tech Salary', amount: 4800.00, category: 'Income & Freelance', type: 'income', date: '2026-09-01' },
  { id: '3', description: 'Electric & Gas Utility', amount: 94.60, category: 'Housing & Utilities', type: 'expense', date: '2026-09-04' },
  { id: '4', description: 'Uber Ride Downtown', amount: 34.20, category: 'Transportation', type: 'expense', date: '2026-09-08' },
  { id: '5', description: 'Netflix & Spotify Subs', amount: 32.99, category: 'Entertainment', type: 'expense', date: '2026-09-03' },
  { id: '6', description: 'Nike Running Shoes', amount: 145.00, category: 'Shopping', type: 'expense', date: '2026-09-09' },
  { id: '7', description: 'Equinox Gym Pass', amount: 75.00, category: 'Health & Fitness', type: 'expense', date: '2026-09-02' },
  { id: '8', description: 'Freelance Mobile UI', amount: 650.00, category: 'Income & Freelance', type: 'income', date: '2026-09-10' },
  { id: '9', description: 'Trader Joe’s Groceries', amount: 68.30, category: 'Food & Dining', type: 'expense', date: '2026-09-11' }
]

export default function App() {
  const [transactions, setTransactions] = useState(INITIAL_TRANSACTIONS)
  const [monthlyBudget, setMonthlyBudget] = useState(2500)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [selectedType, setSelectedType] = useState('all')
  const [sortBy, setSortBy] = useState('date-desc')
  const [showAddModal, setShowAddModal] = useState(false)

  // Form State
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('Food & Dining')
  const [type, setType] = useState('expense')
  const [date, setDate] = useState('2026-09-13')

  // Financial calculations
  const totals = useMemo(() => {
    let income = 0
    let expense = 0
    transactions.forEach(t => {
      if (t.type === 'income') income += Number(t.amount)
      else expense += Number(t.amount)
    })
    return {
      income,
      expense,
      balance: income - expense,
      budgetUsedPct: Math.min(Math.round((expense / monthlyBudget) * 100), 100)
    }
  }, [transactions, monthlyBudget])

  // Category breakdown calculation
  const categoryBreakdown = useMemo(() => {
    const map = {}
    let totalExpense = 0
    transactions.forEach(t => {
      if (t.type === 'expense') {
        map[t.category] = (map[t.category] || 0) + Number(t.amount)
        totalExpense += Number(t.amount)
      }
    })

    return Object.entries(map)
      .map(([cat, amt]) => ({
        name: cat,
        amount: amt,
        pct: totalExpense > 0 ? Math.round((amt / totalExpense) * 100) : 0,
        config: CATEGORY_CONFIG[cat] || CATEGORY_CONFIG['Other']
      }))
      .sort((a, b) => b.amount - a.amount)
  }, [transactions])

  // Filtered and sorted transactions
  const filteredTransactions = useMemo(() => {
    return transactions
      .filter(t => {
        const matchesSearch = t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.category.toLowerCase().includes(searchQuery.toLowerCase())
        const matchesCategory = selectedCategory === 'All' || t.category === selectedCategory
        const matchesType = selectedType === 'all' || t.type === selectedType
        return matchesSearch && matchesCategory && matchesType
      })
      .sort((a, b) => {
        if (sortBy === 'date-desc') return new Date(b.date) - new Date(a.date)
        if (sortBy === 'date-asc') return new Date(a.date) - new Date(b.date)
        if (sortBy === 'amount-desc') return b.amount - a.amount
        if (sortBy === 'amount-asc') return a.amount - b.amount
        return 0
      })
  }, [transactions, searchQuery, selectedCategory, selectedType, sortBy])

  const handleAddTransaction = (e) => {
    e.preventDefault()
    if (!description.trim() || !amount || Number(amount) <= 0) return

    const newTx = {
      id: String(Date.now()),
      description: description.trim(),
      amount: parseFloat(Number(amount).toFixed(2)),
      category: type === 'income' ? 'Income & Freelance' : category,
      type,
      date
    }

    setTransactions(prev => [newTx, ...prev])
    setDescription('')
    setAmount('')
    setShowAddModal(false)
  }

  const handleDelete = (id) => {
    setTransactions(prev => prev.filter(t => t.id !== id))
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 font-sans antialiased">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/80 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/80">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm shadow-indigo-600/30">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">ExpenseFlow</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">September 2026 Overview</p>
            </div>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 active:scale-95"
          >
            <Plus className="h-4 w-4" />
            Add Expense
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        {/* Monthly Summary Cards */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Total Income */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">Total Income</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                <ArrowUpRight className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-3 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              ${totals.income.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
            <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="h-3.5 w-3.5" />
              <span>+12.4% vs last month</span>
            </div>
          </div>

          {/* Total Expenses */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">Total Expenses</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
                <ArrowDownRight className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-3 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              ${totals.expense.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
            <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-rose-600 dark:text-rose-400">
              <TrendingDown className="h-3.5 w-3.5" />
              <span>{totals.budgetUsedPct}% of budget spent</span>
            </div>
          </div>

          {/* Net Savings */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">Net Savings</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400">
                <DollarSign className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-3 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              ${totals.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
            <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <span>Healthy cash reserve</span>
            </div>
          </div>

          {/* Monthly Budget Progress */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">Monthly Budget</span>
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">${monthlyBudget.toLocaleString()}</span>
            </div>
            <div className="mt-3">
              <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                <span>Remaining: ${(Math.max(monthlyBudget - totals.expense, 0)).toFixed(2)}</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">{totals.budgetUsedPct}%</span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${totals.budgetUsedPct > 90 ? 'bg-rose-500' : totals.budgetUsedPct > 70 ? 'bg-amber-500' : 'bg-indigo-600'}`}
                  style={{ width: `${totals.budgetUsedPct}%` }}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Middle Section: Category Breakdown + Fast Add Form */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Category Breakdown Chart Card */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 lg:col-span-2">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <PieChart className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Category Breakdown</h2>
              </div>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                ${totals.expense.toFixed(2)} Total Spent
              </span>
            </div>

            {/* Segmented Progress Bar */}
            <div className="mt-6">
              <div className="flex h-3.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                {categoryBreakdown.map((item) => (
                  <div
                    key={item.name}
                    className={`${item.config.color} transition-all duration-300 hover:opacity-80`}
                    style={{ width: `${item.pct}%` }}
                    title={`${item.name}: $${item.amount.toFixed(2)} (${item.pct}%)`}
                  />
                ))}
              </div>
            </div>

            {/* Category Rows */}
            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {categoryBreakdown.map((item) => {
                const Icon = item.config.icon
                return (
                  <div
                    key={item.name}
                    className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-800/40"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${item.config.bg} ${item.config.text}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-900 dark:text-white">{item.name}</p>
                        <p className="text-[11px] text-slate-500">{item.pct}% of expenses</p>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                      ${item.amount.toFixed(2)}
                    </span>
                  </div>
                )
              })}
              {categoryBreakdown.length === 0 && (
                <p className="text-xs text-slate-500 col-span-2 text-center py-6">No expenses recorded yet.</p>
              )}
            </div>
          </section>

          {/* Quick Add Form Card */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Quick Add</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Record a new transaction instantly</p>

            <form onSubmit={handleAddTransaction} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">Transaction Type</label>
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setType('expense')}
                    className={`rounded-lg py-2 text-xs font-semibold transition ${type === 'expense' ? 'bg-rose-50 text-rose-600 border border-rose-200 dark:bg-rose-950/40 dark:border-rose-900' : 'bg-slate-100 text-slate-600 border border-transparent dark:bg-slate-800 dark:text-slate-300'}`}
                  >
                    Expense
                  </button>
                  <button
                    type="button"
                    onClick={() => setType('income')}
                    className={`rounded-lg py-2 text-xs font-semibold transition ${type === 'income' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-900' : 'bg-slate-100 text-slate-600 border border-transparent dark:bg-slate-800 dark:text-slate-300'}`}
                  >
                    Income
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">Description</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Grocery Store, Coffee"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">Amount ($)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </div>

              {type === 'expense' && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  >
                    {Object.keys(CATEGORY_CONFIG).filter(c => c !== 'Income & Freelance').map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">Date</label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </div>

              <button
                type="submit"
                className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 active:scale-95"
              >
                Save Transaction
              </button>
            </form>
          </section>
        </div>

        {/* Filterable Transactions List */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
          {/* Controls Bar */}
          <div className="border-b border-slate-200 p-5 dark:border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Recent Transactions</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Showing {filteredTransactions.length} transaction{filteredTransactions.length === 1 ? '' : 's'}</p>
              </div>

              {/* Search & Sort Controls */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative min-w-[200px] flex-1 sm:flex-initial">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by merchant…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-slate-50/50 pl-9 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-hidden dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                </div>

                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
                >
                  <option value="date-desc">Newest First</option>
                  <option value="date-asc">Oldest First</option>
                  <option value="amount-desc">Highest Amount</option>
                  <option value="amount-asc">Lowest Amount</option>
                </select>
              </div>
            </div>

            {/* Category Filter Pills */}
            <div className="flex flex-wrap gap-2 pt-1">
              {['All', ...Object.keys(CATEGORY_CONFIG)].map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${selectedCategory === cat ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'}`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Transactions Table/List */}
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredTransactions.map((t) => {
              const cfg = CATEGORY_CONFIG[t.category] || CATEGORY_CONFIG['Other']
              const Icon = cfg.icon
              const isIncome = t.type === 'income'

              return (
                <div
                  key={t.id}
                  className="flex items-center justify-between px-6 py-4 transition hover:bg-slate-50/60 dark:hover:bg-slate-800/40"
                >
                  <div className="flex items-center gap-4">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${cfg.bg} ${cfg.text}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">{t.description}</p>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span>{t.category}</span>
                        <span>•</span>
                        <span>{t.date}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className={`text-sm font-bold ${isIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'}`}>
                      {isIncome ? '+' : '-'}${Number(t.amount).toFixed(2)}
                    </span>
                    <button
                      onClick={() => handleDelete(t.id)}
                      className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40"
                      title="Delete transaction"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )
            })}

            {filteredTransactions.length === 0 && (
              <div className="py-12 text-center">
                <Filter className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600" />
                <p className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-300">No transactions match your filters</p>
                <p className="text-xs text-slate-400">Try clearing your search query or selecting another category.</p>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}

