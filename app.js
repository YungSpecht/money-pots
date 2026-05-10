const STORAGE_KEY = "money-pots-v1";
const todayISO = () => new Date().toISOString().slice(0, 10);
const DEFAULT_THEME = {
  accent: "#45c6a3",
  header: "#12362f",
  background: "#10161d",
  surface: "#17212b",
};
const POT_COLOR_PRESETS = ["#45c6a3", "#f08a5d", "#6aa8ff", "#b692f6", "#ee6f9f", "#e3b45f", "#7bd88f", "#98a2b3"];
const THEME_PRESETS = [
  { accent: "#45c6a3", header: "#12362f", background: "#10161d", surface: "#17212b" },
  { accent: "#6aa8ff", header: "#152f4d", background: "#0e1520", surface: "#162231" },
  { accent: "#b692f6", header: "#2d2146", background: "#12101a", surface: "#1e1a2a" },
  { accent: "#f08a5d", header: "#452417", background: "#16110e", surface: "#241a15" },
  { accent: "#7bd88f", header: "#203b29", background: "#0f1712", surface: "#17231b" },
  { accent: "#e3b45f", header: "#43351a", background: "#14130f", surface: "#211f17" },
];

const defaultState = {
  settings: {
    currency: "EUR",
    monthlyTransfer: "",
    arrivalDay: "",
    interestApy: "",
    autoPost: false,
    lastAutoPostMonth: "",
    theme: { ...DEFAULT_THEME },
  },
  pots: [],
  transactions: [],
};

let state = loadState();

const els = {
  totalBalance: document.querySelector("#totalBalance"),
  potCount: document.querySelector("#potCount"),
  monthlyAmount: document.querySelector("#monthlyAmount"),
  nextTransfer: document.querySelector("#nextTransfer"),
  allocationTotal: document.querySelector("#allocationTotal"),
  allocationStatus: document.querySelector("#allocationStatus"),
  monthlyInterest: document.querySelector("#monthlyInterest"),
  interestApy: document.querySelector("#interestApy"),
  scheduleHint: document.querySelector("#scheduleHint"),
  potsGrid: document.querySelector("#potsGrid"),
  postTransfer: document.querySelector("#postTransfer"),
  txType: document.querySelector("#txType"),
  txPot: document.querySelector("#txPot"),
  txToPot: document.querySelector("#txToPot"),
  toPotWrap: document.querySelector("#toPotWrap"),
  txAmount: document.querySelector("#txAmount"),
  txDate: document.querySelector("#txDate"),
  txNote: document.querySelector("#txNote"),
  transactionForm: document.querySelector("#transactionForm"),
  transactionList: document.querySelector("#transactionList"),
  historyPot: document.querySelector("#historyPot"),
  historyType: document.querySelector("#historyType"),
  clearFilters: document.querySelector("#clearFilters"),
  settingsForm: document.querySelector("#settingsForm"),
  appearanceForm: document.querySelector("#appearanceForm"),
  settingAmount: document.querySelector("#settingAmount"),
  settingDay: document.querySelector("#settingDay"),
  settingApy: document.querySelector("#settingApy"),
  settingCurrency: document.querySelector("#settingCurrency"),
  settingAutoPost: document.querySelector("#settingAutoPost"),
  themeAccent: document.querySelector("#themeAccent"),
  themeHeader: document.querySelector("#themeHeader"),
  themeBackground: document.querySelector("#themeBackground"),
  themeSurface: document.querySelector("#themeSurface"),
  themeSwatches: document.querySelector("#themeSwatches"),
  potForm: document.querySelector("#potForm"),
  potId: document.querySelector("#potId"),
  potName: document.querySelector("#potName"),
  potBalance: document.querySelector("#potBalance"),
  potAllocation: document.querySelector("#potAllocation"),
  potTarget: document.querySelector("#potTarget"),
  potColor: document.querySelector("#potColor"),
  resetPotForm: document.querySelector("#resetPotForm"),
  deletePot: document.querySelector("#deletePot"),
  resetAllData: document.querySelector("#resetAllData"),
  potSwatches: document.querySelector("#potSwatches"),
  editorList: document.querySelector("#editorList"),
  exportData: document.querySelector("#exportData"),
  importData: document.querySelector("#importData"),
};

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return structuredClone(defaultState);
  try {
    const parsed = JSON.parse(raw);
    const settings = { ...defaultState.settings, ...parsed.settings };
    settings.theme = { ...DEFAULT_THEME, ...parsed.settings?.theme };
    return {
      settings,
      pots: Array.isArray(parsed.pots) ? parsed.pots : [],
      transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
    };
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function applyTheme() {
  const theme = { ...DEFAULT_THEME, ...state.settings.theme };
  const root = document.documentElement;
  root.style.setProperty("--accent", theme.accent);
  root.style.setProperty("--accent-dark", theme.header);
  root.style.setProperty("--header", theme.header);
  root.style.setProperty("--bg", theme.background);
  root.style.setProperty("--surface", theme.surface);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme.background);
}

function money(value) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: state.settings.currency,
  }).format(Number(value || 0));
}

function parseNumber(value) {
  if (typeof value === "number") return value;
  return Number(String(value || "0").trim().replace(/\s/g, "").replace(",", ".")) || 0;
}

function percent(value) {
  return `${Number(value || 0).toFixed(1).replace(".0", "")}%`;
}

function totalBalance() {
  return state.pots.reduce((sum, pot) => sum + Number(pot.balance || 0), 0);
}

function allocationTotal() {
  return state.pots.reduce((sum, pot) => sum + Number(pot.allocation || 0), 0);
}

function nextTransferDate() {
  if (!state.settings.arrivalDay) return null;
  const now = new Date();
  const day = Number(state.settings.arrivalDay || 1);
  let candidate = new Date(now.getFullYear(), now.getMonth(), day);
  if (candidate < startOfToday()) candidate = new Date(now.getFullYear(), now.getMonth() + 1, day);
  return candidate;
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function transferDue() {
  if (!state.settings.arrivalDay || !state.settings.monthlyTransfer) return false;
  const now = startOfToday();
  const scheduled = new Date(now.getFullYear(), now.getMonth(), Number(state.settings.arrivalDay || 1));
  return scheduled <= now && state.settings.lastAutoPostMonth !== monthKey(now);
}

function addTransaction(transaction) {
  const pot = state.pots.find((item) => item.id === transaction.potId);
  const toPot = state.pots.find((item) => item.id === transaction.toPotId);
  state.transactions.unshift({
    id: crypto.randomUUID(),
    date: todayISO(),
    note: "",
    potName: pot?.name || transaction.potName || "",
    toPotName: toPot?.name || transaction.toPotName || "",
    ...transaction,
    amount: roundMoney(transaction.amount),
  });
}

function roundMoney(value) {
  return Math.round(parseNumber(value) * 100) / 100;
}

function postMonthlySplit(manual = true) {
  const amount = Number(state.settings.monthlyTransfer || 0);
  const total = allocationTotal();
  if (!amount || !state.pots.length || total <= 0) return false;

  const transferDate = todayISO();
  let distributed = 0;
  state.pots.forEach((pot, index) => {
    const isLast = index === state.pots.length - 1;
    const share = isLast ? roundMoney(amount - distributed) : roundMoney(amount * (Number(pot.allocation || 0) / total));
    distributed += share;
    pot.balance = roundMoney(Number(pot.balance || 0) + share);
    addTransaction({
      type: "scheduled",
      potId: pot.id,
      date: transferDate,
      amount: share,
      note: manual ? "Manual monthly split" : "Automatic monthly split",
    });
  });
  state.settings.lastAutoPostMonth = monthKey(new Date());
  saveState();
  render();
  return true;
}

function autoPostIfNeeded() {
  if (state.settings.autoPost && transferDue()) postMonthlySplit(false);
}

function render() {
  applyTheme();
  renderSummary();
  renderPots();
  renderSelectors();
  renderTransactions();
  renderSettings();
  renderEditorList();
  renderSwatches();
}

function renderSummary() {
  const total = totalBalance();
  const allocation = allocationTotal();
  const monthlyInterest = total * (Number(state.settings.interestApy || 0) / 100 / 12);
  const nextTransfer = nextTransferDate();
  els.totalBalance.textContent = money(total);
  els.potCount.textContent = `${state.pots.length} ${state.pots.length === 1 ? "pot" : "pots"}`;
  els.monthlyAmount.textContent = state.settings.monthlyTransfer === "" ? "Not set" : money(state.settings.monthlyTransfer);
  els.nextTransfer.textContent = nextTransfer ? `Next on ${nextTransfer.toLocaleDateString()}` : "No schedule";
  els.allocationTotal.textContent = percent(allocation);
  els.allocationStatus.textContent = allocation > 0 ? "Split uses relative shares" : "Needs setup";
  els.monthlyInterest.textContent = money(monthlyInterest);
  els.interestApy.textContent = state.settings.interestApy === "" ? "No APY" : `${Number(state.settings.interestApy || 0).toFixed(2)}% APY`;

  if (!state.settings.monthlyTransfer || !state.settings.arrivalDay) {
    els.scheduleHint.textContent = "Add a monthly transfer in Settings.";
    els.postTransfer.disabled = true;
  } else if (transferDue()) {
    els.scheduleHint.textContent = "This month's split is due.";
    els.postTransfer.disabled = false;
  } else {
    els.scheduleHint.textContent = `Next split posts on ${nextTransfer.toLocaleDateString()}.`;
    els.postTransfer.disabled = false;
  }
}

function renderPots() {
  const template = document.querySelector("#potCardTemplate");
  els.potsGrid.innerHTML = "";
  if (!state.pots.length) {
    els.potsGrid.innerHTML = `<div class="empty-state">Create your first pot in Settings.</div>`;
    return;
  }

  state.pots.forEach((pot) => {
    const node = template.content.firstElementChild.cloneNode(true);
    const target = Number(pot.target || 0);
    const progress = target > 0 ? Math.min(100, (Number(pot.balance || 0) / target) * 100) : 100;
    node.querySelector(".color-dot").style.background = pot.color;
    node.querySelector(".pot-title h3").textContent = pot.name;
    node.querySelector(".pot-balance").textContent = money(pot.balance);
    node.querySelector(".progress-fill").style.width = `${progress}%`;
    node.querySelector(".progress-fill").style.background = pot.color;
    node.querySelector(".pot-allocation").textContent = `${percent(pot.allocation)} allocation`;
    node.querySelector(".pot-target").textContent = target > 0 ? `${money(target)} target` : "No target";
    node.querySelector(".edit-pot").addEventListener("click", () => {
      switchView("settings");
      fillPotForm(pot.id);
    });
    els.potsGrid.appendChild(node);
  });
}

function renderSelectors() {
  const potOptions = state.pots.map((pot) => `<option value="${pot.id}">${escapeHtml(pot.name)}</option>`).join("");
  els.txPot.innerHTML = potOptions;
  els.txToPot.innerHTML = potOptions;
  els.historyPot.innerHTML = `<option value="all">All pots</option>${potOptions}`;
}

function renderTransactions() {
  const potFilter = els.historyPot.value || "all";
  const typeFilter = els.historyType.value || "all";
  const filtered = state.transactions.filter((tx) => {
    const matchesPot = potFilter === "all" || tx.potId === potFilter || tx.toPotId === potFilter;
    const matchesType = typeFilter === "all" || tx.type === typeFilter;
    return matchesPot && matchesType;
  });

  els.transactionList.innerHTML = "";
  if (!filtered.length) {
    els.transactionList.innerHTML = `<div class="empty-state">No transactions match the current filters.</div>`;
    return;
  }

  filtered.slice(0, 120).forEach((tx) => {
    const pot = state.pots.find((item) => item.id === tx.potId);
    const toPot = state.pots.find((item) => item.id === tx.toPotId);
    const signed = tx.type === "withdrawal" || tx.type === "deleted" ? -Math.abs(tx.amount) : tx.amount;
    const amountClass = tx.type === "transfer" ? "amount-neutral" : signed < 0 ? "amount-negative" : "amount-positive";
    const prefix = tx.type === "transfer" ? "" : signed < 0 ? "-" : "+";
    const row = document.createElement("article");
    row.className = "transaction-row";
    row.innerHTML = `
      <div>
        <strong>${transactionTitle(tx, pot, toPot)}</strong>
        <span>${new Date(tx.date).toLocaleDateString()}${tx.note ? ` - ${escapeHtml(tx.note)}` : ""}</span>
      </div>
      <div class="${amountClass}">${prefix}${money(Math.abs(signed))}</div>
    `;
    els.transactionList.appendChild(row);
  });
}

function transactionTitle(tx, pot, toPot) {
  const potName = pot?.name || tx.potName || "Deleted pot";
  const toPotName = toPot?.name || tx.toPotName || "Deleted pot";
  if (tx.type === "transfer") return `${potName} to ${toPotName}`;
  const labels = {
    scheduled: "Monthly split",
    addition: "Addition",
    withdrawal: "Withdrawal",
    set: "Balance edit",
    deleted: "Deleted pot",
  };
  return `${labels[tx.type] || tx.type} - ${potName}`;
}

function renderSettings() {
  els.settingAmount.value = state.settings.monthlyTransfer;
  els.settingDay.value = state.settings.arrivalDay;
  els.settingApy.value = state.settings.interestApy;
  els.settingCurrency.value = state.settings.currency;
  els.settingAutoPost.checked = Boolean(state.settings.autoPost);
  const theme = { ...DEFAULT_THEME, ...state.settings.theme };
  els.themeAccent.value = theme.accent;
  els.themeHeader.value = theme.header;
  els.themeBackground.value = theme.background;
  els.themeSurface.value = theme.surface;
  if (!els.txDate.value) els.txDate.value = todayISO();
}

function renderSwatches() {
  els.potSwatches.innerHTML = "";
  POT_COLOR_PRESETS.forEach((color) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `swatch-button${els.potColor.value === color ? " active" : ""}`;
    button.title = color;
    button.style.setProperty("--swatch", color);
    button.addEventListener("click", () => {
      els.potColor.value = color;
      renderSwatches();
    });
    els.potSwatches.appendChild(button);
  });

  els.themeSwatches.innerHTML = "";
  THEME_PRESETS.forEach((theme, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "swatch-button";
    button.title = `Theme ${index + 1}`;
    button.style.setProperty("--swatch", theme.accent);
    button.addEventListener("click", () => {
      els.themeAccent.value = theme.accent;
      els.themeHeader.value = theme.header;
      els.themeBackground.value = theme.background;
      els.themeSurface.value = theme.surface;
      state.settings.theme = { ...theme };
      saveState();
      render();
    });
    els.themeSwatches.appendChild(button);
  });
}

function renderEditorList() {
  els.editorList.innerHTML = "";
  state.pots.forEach((pot) => {
    const row = document.createElement("article");
    row.className = "editor-row";
    row.innerHTML = `
      <div>
        <strong>${escapeHtml(pot.name)}</strong>
        <span>${money(pot.balance)} - ${percent(pot.allocation)} - ${pot.target ? `${money(pot.target)} target` : "no target"}</span>
      </div>
      <button class="secondary-action" type="button">Edit</button>
    `;
    row.querySelector("button").addEventListener("click", () => fillPotForm(pot.id));
    els.editorList.appendChild(row);
  });
}

function fillPotForm(id) {
  const pot = state.pots.find((item) => item.id === id);
  if (!pot) return;
  els.potId.value = pot.id;
  els.potName.value = pot.name;
  els.potBalance.value = pot.balance;
  els.potAllocation.value = pot.allocation;
  els.potTarget.value = pot.target || "";
  els.potColor.value = pot.color || "#23695b";
  els.deletePot.hidden = false;
  els.potName.focus();
}

function resetPotForm() {
  els.potId.value = "";
  els.potName.value = "";
  els.potBalance.value = "";
  els.potAllocation.value = "";
  els.potTarget.value = "";
  els.potColor.value = DEFAULT_THEME.accent;
  els.deletePot.hidden = true;
}

function switchView(view) {
  document.querySelectorAll(".tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.view === view));
  document.querySelectorAll(".view").forEach((panel) => panel.classList.remove("active"));
  document.querySelector(`#${view}View`).classList.add("active");
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[char]);
}

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => switchView(tab.dataset.view));
});

els.postTransfer.addEventListener("click", () => {
  postMonthlySplit(true);
});

els.txType.addEventListener("change", () => {
  els.toPotWrap.classList.toggle("hidden", els.txType.value !== "transfer");
});

els.transactionForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const type = els.txType.value;
  const amount = roundMoney(els.txAmount.value);
  const pot = state.pots.find((item) => item.id === els.txPot.value);
  const toPot = state.pots.find((item) => item.id === els.txToPot.value);
  if (!pot || amount < 0) return;

  if (type === "addition") {
    pot.balance = roundMoney(Number(pot.balance || 0) + amount);
    addTransaction({ type, potId: pot.id, amount, date: els.txDate.value, note: els.txNote.value });
  }

  if (type === "withdrawal") {
    pot.balance = roundMoney(Number(pot.balance || 0) - amount);
    addTransaction({ type, potId: pot.id, amount, date: els.txDate.value, note: els.txNote.value });
  }

  if (type === "set") {
    const previous = Number(pot.balance || 0);
    pot.balance = amount;
    addTransaction({ type, potId: pot.id, amount: amount - previous, date: els.txDate.value, note: els.txNote.value || "Manual balance edit" });
  }

  if (type === "transfer" && toPot && toPot.id !== pot.id) {
    pot.balance = roundMoney(Number(pot.balance || 0) - amount);
    toPot.balance = roundMoney(Number(toPot.balance || 0) + amount);
    addTransaction({ type, potId: pot.id, toPotId: toPot.id, amount, date: els.txDate.value, note: els.txNote.value });
  }

  els.transactionForm.reset();
  els.txDate.value = todayISO();
  saveState();
  render();
});

els.settingsForm.addEventListener("submit", (event) => {
  event.preventDefault();
  state.settings.monthlyTransfer = els.settingAmount.value.trim() === "" ? "" : roundMoney(els.settingAmount.value);
  state.settings.arrivalDay = els.settingDay.value === "" ? "" : Math.min(28, Math.max(1, parseNumber(els.settingDay.value)));
  state.settings.interestApy = els.settingApy.value.trim() === "" ? "" : parseNumber(els.settingApy.value);
  state.settings.currency = els.settingCurrency.value;
  state.settings.autoPost = els.settingAutoPost.checked;
  saveState();
  render();
});

els.appearanceForm.addEventListener("submit", (event) => {
  event.preventDefault();
  state.settings.theme = {
    accent: els.themeAccent.value,
    header: els.themeHeader.value,
    background: els.themeBackground.value,
    surface: els.themeSurface.value,
  };
  saveState();
  render();
});

els.potForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const existing = state.pots.find((pot) => pot.id === els.potId.value);
  const payload = {
    name: els.potName.value.trim(),
    balance: roundMoney(els.potBalance.value),
    allocation: parseNumber(els.potAllocation.value || 0),
    target: roundMoney(els.potTarget.value || 0),
    color: els.potColor.value,
  };
  if (!payload.name) return;

  if (existing) {
    const previous = Number(existing.balance || 0);
    Object.assign(existing, payload);
    if (previous !== payload.balance) {
      addTransaction({ type: "set", potId: existing.id, amount: payload.balance - previous, date: todayISO(), note: "Pot editor balance change" });
    }
  } else {
    state.pots.push({ id: crypto.randomUUID(), ...payload });
    addTransaction({ type: "set", potId: state.pots.at(-1).id, amount: payload.balance, date: todayISO(), note: "New pot" });
  }

  resetPotForm();
  saveState();
  render();
});

els.resetPotForm.addEventListener("click", resetPotForm);
els.potColor.addEventListener("input", renderSwatches);
els.deletePot.addEventListener("click", () => {
  const pot = state.pots.find((item) => item.id === els.potId.value);
  if (!pot) return;
  if (!confirm(`Delete "${pot.name}"? Transaction history will stay available.`)) return;
  state.pots = state.pots.filter((item) => item.id !== pot.id);
  addTransaction({
    type: "deleted",
    potId: pot.id,
    potName: pot.name,
    amount: Number(pot.balance || 0),
    date: todayISO(),
    note: "Pot removed",
  });
  resetPotForm();
  saveState();
  render();
});
els.resetAllData.addEventListener("click", () => {
  if (!confirm("Reset everything? This clears pots, settings, and transaction history on this device.")) return;
  localStorage.removeItem(STORAGE_KEY);
  state = structuredClone(defaultState);
  resetPotForm();
  saveState();
  render();
  switchView("overview");
});
els.historyPot.addEventListener("change", renderTransactions);
els.historyType.addEventListener("change", renderTransactions);
els.clearFilters.addEventListener("click", () => {
  els.historyPot.value = "all";
  els.historyType.value = "all";
  renderTransactions();
});

els.exportData.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `money-pots-backup-${todayISO()}.json`;
  link.click();
  URL.revokeObjectURL(url);
});

els.importData.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  const imported = JSON.parse(await file.text());
  if (!Array.isArray(imported.pots) || !imported.settings) return;
  state = {
    settings: { ...defaultState.settings, ...imported.settings, theme: { ...DEFAULT_THEME, ...imported.settings.theme } },
    pots: imported.pots,
    transactions: Array.isArray(imported.transactions) ? imported.transactions : [],
  };
  saveState();
  render();
  event.target.value = "";
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js"));
}

resetPotForm();
autoPostIfNeeded();
render();
