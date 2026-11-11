const STORAGE_KEY = "money-pots-v1";
const BACKUP_VERSION = 2;
const UNALLOCATED_ID = "__unallocated__";
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
    lastAutoPostMonth: "",
    splits: [],
    theme: { ...DEFAULT_THEME },
  },
  pots: [],
  unallocatedBalance: 0,
  transactions: [],
};

let state = loadState();
let activePotId = null;

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
  addSplit: document.querySelector("#addSplit"),
  splitList: document.querySelector("#splitList"),
  splitValidation: document.querySelector("#splitValidation"),
  appearanceForm: document.querySelector("#appearanceForm"),
  settingAmount: document.querySelector("#settingAmount"),
  settingDay: document.querySelector("#settingDay"),
  settingApy: document.querySelector("#settingApy"),
  settingCurrency: document.querySelector("#settingCurrency"),
  themeAccent: document.querySelector("#themeAccent"),
  themeHeader: document.querySelector("#themeHeader"),
  themeBackground: document.querySelector("#themeBackground"),
  themeSurface: document.querySelector("#themeSurface"),
  themeSwatches: document.querySelector("#themeSwatches"),
  potForm: document.querySelector("#potForm"),
  potId: document.querySelector("#potId"),
  potName: document.querySelector("#potName"),
  potBalance: document.querySelector("#potBalance"),
  potTarget: document.querySelector("#potTarget"),
  potColor: document.querySelector("#potColor"),
  resetPotForm: document.querySelector("#resetPotForm"),
  deletePot: document.querySelector("#deletePot"),
  resetAllData: document.querySelector("#resetAllData"),
  potSwatches: document.querySelector("#potSwatches"),
  editorList: document.querySelector("#editorList"),
  exportData: document.querySelector("#exportData"),
  importData: document.querySelector("#importData"),
  transactionComposer: document.querySelector("#transactionComposer"),
  toggleTransaction: document.querySelector("#toggleTransaction"),
  activityComposerHost: document.querySelector("#activityComposerHost"),
  detailComposerHost: document.querySelector("#detailComposerHost"),
  detailTransactionList: document.querySelector("#detailTransactionList"),
};

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return structuredClone(defaultState);
  try {
    return hydrateState(JSON.parse(raw));
  } catch {
    return structuredClone(defaultState);
  }
}

function hydrateState(parsed, options = {}) {
  const settings = { ...defaultState.settings, ...parsed.settings };
  settings.theme = { ...DEFAULT_THEME, ...parsed.settings?.theme };
  const rawPots = Array.isArray(parsed.pots) ? parsed.pots : [];
  const pots = rawPots.map(normalizePot);
  settings.splits = Array.isArray(parsed.settings?.splits) ? parsed.settings.splits.map(normalizeSplit) : migrateSplits(parsed, rawPots);

  if (options.imported && !settings.lastAutoPostMonth && parsed.backupExportedAt) {
    settings.lastAutoPostMonth = baselineProcessedMonthKey(new Date(parsed.backupExportedAt), settings);
  }

  return {
    settings,
    pots,
    unallocatedBalance: roundMoney(parsed.unallocatedBalance || 0),
    transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
  };
}

function normalizePot(pot) {
  return {
    id: pot.id || crypto.randomUUID(),
    name: pot.name || "Untitled",
    balance: roundMoney(pot.balance || 0),
    target: roundMoney(pot.target || 0),
    color: pot.color || DEFAULT_THEME.accent,
  };
}

function normalizeSplit(split) {
  return {
    id: split.id || crypto.randomUUID(),
    potId: split.potId || "",
    amount: roundMoney(split.amount || 0),
  };
}

function migrateSplits(parsed, pots) {
  const amount = roundMoney(parsed.settings?.monthlyTransfer || 0);
  const totalAllocation = pots.reduce((sum, pot) => sum + parseNumber(pot.allocation || 0), 0);
  if (!amount || !totalAllocation) return [];
  let used = 0;
  return pots
    .filter((pot) => parseNumber(pot.allocation || 0) > 0)
    .map((pot, index, eligible) => {
      const isLast = index === eligible.length - 1;
      const splitAmount = isLast ? roundMoney(amount - used) : roundMoney(amount * (parseNumber(pot.allocation) / totalAllocation));
      used += splitAmount;
      return { id: crypto.randomUUID(), potId: pot.id, amount: splitAmount };
    });
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function contrastingText(color) {
  const hex = /^#[0-9a-f]{6}$/i.test(color) ? color : DEFAULT_THEME.accent;
  const channels = [1, 3, 5].map((offset) => {
    const channel = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  const luminance = channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  return luminance > 0.179 ? "#000000" : "#ffffff";
}

function applyTheme() {
  const theme = { ...DEFAULT_THEME, ...state.settings.theme };
  const root = document.documentElement;
  root.style.setProperty("--accent", theme.accent);
  root.style.setProperty("--on-accent", contrastingText(theme.accent));
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

function roundMoney(value) {
  return Math.round(parseNumber(value) * 100) / 100;
}

function regularPots() {
  return state.pots;
}

function unallocatedPot() {
  return {
    id: UNALLOCATED_ID,
    name: "Unallocated",
    balance: roundMoney(state.unallocatedBalance || 0),
    target: 0,
    color: "#98a2b3",
    system: true,
  };
}

function visiblePots() {
  const pots = [...regularPots()];
  if (Math.abs(Number(state.unallocatedBalance || 0)) > 0.009) pots.push(unallocatedPot());
  return pots;
}

function getPot(id) {
  return id === UNALLOCATED_ID ? unallocatedPot() : state.pots.find((pot) => pot.id === id);
}

function updatePotBalance(id, amountDelta) {
  if (id === UNALLOCATED_ID) {
    state.unallocatedBalance = roundMoney(Number(state.unallocatedBalance || 0) + amountDelta);
    return;
  }
  const pot = state.pots.find((item) => item.id === id);
  if (pot) pot.balance = roundMoney(Number(pot.balance || 0) + amountDelta);
}

function setPotBalance(id, amount) {
  if (id === UNALLOCATED_ID) {
    state.unallocatedBalance = roundMoney(amount);
    return;
  }
  const pot = state.pots.find((item) => item.id === id);
  if (pot) pot.balance = roundMoney(amount);
}

function totalBalance() {
  return visiblePots().reduce((sum, pot) => sum + Number(pot.balance || 0), 0);
}

function scheduledTotal() {
  return state.settings.splits.reduce((sum, split) => sum + Number(split.amount || 0), 0);
}

function monthlyInterestEstimate() {
  return totalBalance() * (Number(state.settings.interestApy || 0) / 100 / 12);
}

function splitDifference() {
  return roundMoney(Number(state.settings.monthlyTransfer || 0) - scheduledTotal());
}

function scheduleIsValid() {
  if (!state.settings.monthlyTransfer || !state.settings.arrivalDay) return false;
  if (!state.settings.splits.length) return false;
  return Math.abs(splitDifference()) < 0.01 && state.settings.splits.every((split) => split.potId && Number(split.amount || 0) > 0);
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

function dateFromMonthKey(key, day = 1) {
  const [year, month] = String(key).split("-").map(Number);
  if (!year || !month) return null;
  return new Date(year, month - 1, day);
}

function addMonths(date, count) {
  return new Date(date.getFullYear(), date.getMonth() + count, date.getDate());
}

function latestDueMonthKey(now = new Date(), settings = state.settings) {
  if (!settings.arrivalDay) return "";
  const day = Number(settings.arrivalDay || 1);
  const currentMonthDue = new Date(now.getFullYear(), now.getMonth(), day);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const latest = today >= currentMonthDue ? currentMonthDue : new Date(now.getFullYear(), now.getMonth() - 1, day);
  return monthKey(latest);
}

function baselineProcessedMonthKey(now = new Date(), settings = state.settings) {
  if (!settings.arrivalDay) return monthKey(now);
  const day = Number(settings.arrivalDay || 1);
  const currentMonthDue = new Date(now.getFullYear(), now.getMonth(), day);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const baseline = today >= currentMonthDue ? currentMonthDue : new Date(now.getFullYear(), now.getMonth() - 1, day);
  return monthKey(baseline);
}

function dueCycleDates(now = new Date()) {
  if (!scheduleIsValid()) return [];
  if (!state.settings.lastAutoPostMonth) {
    state.settings.lastAutoPostMonth = baselineProcessedMonthKey(now);
    saveState();
    return [];
  }
  const latestKey = latestDueMonthKey(now);
  const dates = [];
  let cursor = addMonths(dateFromMonthKey(state.settings.lastAutoPostMonth, Number(state.settings.arrivalDay || 1)), 1);
  while (monthKey(cursor) <= latestKey) {
    dates.push(new Date(cursor));
    cursor = addMonths(cursor, 1);
  }
  return dates;
}

function addTransaction(transaction) {
  const pot = getPot(transaction.potId);
  const toPot = getPot(transaction.toPotId);
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

function addToUnallocated(amount, date, note, type = "unallocated") {
  const rounded = roundMoney(amount);
  if (rounded <= 0) return;
  state.unallocatedBalance = roundMoney(Number(state.unallocatedBalance || 0) + rounded);
  addTransaction({ type, potId: UNALLOCATED_ID, amount: rounded, date, note });
}

function applyMonthlySplitForDate(transferDate) {
  if (!scheduleIsValid()) return false;
  const transferISO = transferDate.toISOString().slice(0, 10);

  state.settings.splits.forEach((split) => {
    const pot = state.pots.find((item) => item.id === split.potId);
    const amount = roundMoney(split.amount);
    if (!pot) {
      addToUnallocated(amount, transferISO, "Missing pot in monthly split");
      return;
    }

    const target = Number(pot.target || 0);
    const remainingToTarget = target > 0 ? Math.max(0, roundMoney(target - Number(pot.balance || 0))) : amount;
    const deposit = target > 0 ? Math.min(amount, remainingToTarget) : amount;
    const overflow = roundMoney(amount - deposit);

    if (deposit > 0) {
      pot.balance = roundMoney(Number(pot.balance || 0) + deposit);
      addTransaction({
        type: "scheduled",
        potId: pot.id,
        date: transferISO,
        amount: deposit,
        note: "Automatic monthly split",
      });
    }
    if (overflow > 0) addToUnallocated(overflow, transferISO, `Overflow from ${pot.name}`);
  });

  return true;
}

function applyEstimatedInterestForDate(date) {
  const amount = roundMoney(monthlyInterestEstimate());
  if (amount <= 0) return false;
  addToUnallocated(amount, date.toISOString().slice(0, 10), "Estimated monthly interest", "interest");
  return true;
}

function processDueCycles() {
  const cycles = dueCycleDates();
  if (!cycles.length) return;
  cycles.forEach((date) => {
    applyMonthlySplitForDate(date);
    applyEstimatedInterestForDate(date);
    state.settings.lastAutoPostMonth = monthKey(date);
  });
  saveState();
}

function render() {
  applyTheme();
  renderSummary();
  renderPots();
  renderSelectors();
  renderTransactions();
  renderSettings();
  renderEditorList();
  renderSplitRows();
  renderSwatches();
  renderPotDetail();
}

function renderSummary() {
  const nextTransfer = nextTransferDate();
  const difference = splitDifference();
  const validSchedule = scheduleIsValid();
  const regularPotCount = state.pots.length;
  els.totalBalance.textContent = money(totalBalance());
  els.potCount.textContent = `${regularPotCount} ${regularPotCount === 1 ? "pot" : "pots"}${Math.abs(Number(state.unallocatedBalance || 0)) > 0.009 ? ` + ${money(state.unallocatedBalance)} unallocated` : ""}`;
  els.monthlyAmount.textContent = state.settings.monthlyTransfer === "" ? "Not set" : money(state.settings.monthlyTransfer);
  els.nextTransfer.textContent = nextTransfer ? `Next on ${nextTransfer.toLocaleDateString()}` : "No schedule";
  els.allocationTotal.textContent = money(scheduledTotal());
  els.allocationStatus.textContent = !state.settings.monthlyTransfer
    ? "Needs transfer amount"
    : validSchedule
      ? "Balanced"
      : `${money(Math.abs(difference))} ${difference > 0 ? "unassigned" : "over"}`;
  els.monthlyInterest.textContent = money(monthlyInterestEstimate());
  els.interestApy.textContent = state.settings.interestApy === "" ? "No APY" : `${Number(state.settings.interestApy || 0).toFixed(2)}% APY`;

  if (!state.settings.monthlyTransfer || !state.settings.arrivalDay) {
    els.scheduleHint.textContent = "Add a transfer amount, date, and destinations in Settings.";
  } else if (!validSchedule) {
    els.scheduleHint.textContent = "Monthly split needs to match the transfer amount.";
  } else {
    els.scheduleHint.textContent = `Automatic split and interest processing. Next check: ${nextTransfer.toLocaleDateString()}.`;
  }
}

function renderPots() {
  const template = document.querySelector("#potCardTemplate");
  const pots = visiblePots();
  els.potsGrid.innerHTML = "";
  if (!pots.length) {
    els.potsGrid.innerHTML = `<div class="empty-state">Create your first pot in Settings.</div>`;
    return;
  }

  pots.forEach((pot) => {
    const node = template.content.firstElementChild.cloneNode(true);
    const target = Number(pot.target || 0);
    const progress = target > 0 ? Math.min(100, (Number(pot.balance || 0) / target) * 100) : 100;
    node.querySelector(".color-dot").style.background = pot.color;
    node.querySelector(".pot-title h3").textContent = pot.name;
    node.querySelector(".pot-balance").textContent = money(pot.balance);
    const openButton = node.querySelector(".pot-open");
    openButton.dataset.potId = pot.id;
    openButton.setAttribute("aria-label", `Open ${pot.name}`);
    openButton.addEventListener("click", () => openPotDetail(pot.id));
    node.querySelector(".progress-fill").style.width = `${progress}%`;
    node.querySelector(".progress-fill").style.background = pot.color;
    node.querySelector(".pot-status").textContent = pot.system ? "Overflow and interest" : target > 0 ? `${money(Math.max(0, target - pot.balance))} to target` : "No target";
    node.querySelector(".pot-target").textContent = target > 0 ? `${money(target)} target` : "";
    const editButton = node.querySelector(".edit-pot");
    if (pot.system) {
      editButton.hidden = true;
    } else {
      editButton.addEventListener("click", () => {
        switchView("settings");
        fillPotForm(pot.id);
      });
    }
    els.potsGrid.appendChild(node);
  });
}

function potOptions(selected = "", includeUnallocated = false) {
  const pots = includeUnallocated ? [...state.pots, unallocatedPot()] : state.pots;
  return pots.map((pot) => `<option value="${pot.id}"${pot.id === selected ? " selected" : ""}>${escapeHtml(pot.name)}</option>`).join("");
}

function renderSelectors() {
  const selectedPot = els.txPot.value;
  const selectedToPot = els.txToPot.value;
  const selectedFilter = els.historyPot.value;
  const optionsWithUnallocated = potOptions("", true);
  els.txPot.innerHTML = optionsWithUnallocated;
  els.txToPot.innerHTML = optionsWithUnallocated;
  els.historyPot.innerHTML = `<option value="all">All pots</option>${optionsWithUnallocated}`;
  if (getPot(selectedPot)) els.txPot.value = selectedPot;
  if (getPot(selectedToPot)) els.txToPot.value = selectedToPot;
  if (selectedFilter === "all" || getPot(selectedFilter)) els.historyPot.value = selectedFilter;
}

function renderSplitRows() {
  els.splitList.innerHTML = "";
  if (!state.pots.length) {
    els.splitList.innerHTML = `<div class="empty-state">Create pots before defining transfer destinations.</div>`;
  } else {
    state.settings.splits.forEach((split) => {
      const row = document.createElement("div");
      row.className = "split-row";
      row.dataset.id = split.id;
      row.innerHTML = `
        <select class="split-pot" aria-label="Destination pot">${potOptions(split.potId)}</select>
        <input class="split-amount" aria-label="Destination amount" type="text" inputmode="decimal" autocomplete="off" value="${split.amount || ""}" />
        <button class="icon-button small remove-split" type="button" title="Remove destination" aria-label="Remove destination">x</button>
      `;
      els.splitList.appendChild(row);
    });
  }
  renderSplitValidation();
}

function renderSplitValidation() {
  const transfer = Number(state.settings.monthlyTransfer || 0);
  const total = scheduledTotal();
  const diff = roundMoney(transfer - total);
  els.splitValidation.className = "validation-line";
  if (!transfer) {
    els.splitValidation.textContent = "Enter a transfer amount to validate destinations.";
  } else if (!state.settings.splits.length) {
    els.splitValidation.textContent = "Add at least one destination.";
    els.splitValidation.classList.add("invalid");
  } else if (Math.abs(diff) < 0.01) {
    els.splitValidation.textContent = `Destinations match ${money(transfer)}.`;
    els.splitValidation.classList.add("valid");
  } else {
    els.splitValidation.textContent = `${money(Math.abs(diff))} ${diff > 0 ? "still unassigned" : "over the transfer amount"}.`;
    els.splitValidation.classList.add("invalid");
  }
}

function readSplitRows() {
  return [...els.splitList.querySelectorAll(".split-row")]
    .map((row) => ({
      id: row.dataset.id || crypto.randomUUID(),
      potId: row.querySelector(".split-pot").value,
      amount: roundMoney(row.querySelector(".split-amount").value),
    }))
    .filter((split) => split.potId);
}

function renderTransactions() {
  const potFilter = els.historyPot.value || "all";
  const typeFilter = els.historyType.value || "all";
  renderTransactionList(els.transactionList, potFilter, typeFilter);
}

function renderTransactionList(container, potFilter = "all", typeFilter = "all") {
  const filtered = state.transactions.filter((tx) => {
    const matchesPot = potFilter === "all" || tx.potId === potFilter || tx.toPotId === potFilter;
    const matchesType = typeFilter === "all" || tx.type === typeFilter;
    return matchesPot && matchesType;
  }).sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));

  container.innerHTML = "";
  if (!filtered.length) {
    container.innerHTML = `<div class="empty-state">No transactions match the current filters.</div>`;
    return;
  }

  filtered.forEach((tx) => {
    const signed = tx.type === "withdrawal" || tx.type === "deleted" ? -Math.abs(tx.amount) : tx.amount;
    const contextualTransfer = tx.type === "transfer" && potFilter !== "all";
    const displayedSigned = contextualTransfer ? (tx.potId === potFilter ? -Math.abs(tx.amount) : Math.abs(tx.amount)) : signed;
    const neutral = tx.type === "transfer" && !contextualTransfer;
    const amountClass = neutral ? "amount-neutral" : displayedSigned < 0 ? "amount-negative" : "amount-positive";
    const prefix = neutral ? "" : displayedSigned < 0 ? "-" : "+";
    const row = document.createElement("article");
    row.className = "transaction-row";
    row.innerHTML = `
      <div>
        <strong>${escapeHtml(transactionTitle(tx))}</strong>
        <span>${escapeHtml(tx.date?.slice(0, 10) || "")}${tx.note ? ` - ${escapeHtml(tx.note)}` : ""}</span>
      </div>
      <div class="${amountClass}">${prefix}${money(Math.abs(signed))}</div>
    `;
    container.appendChild(row);
  });
}

function setComposerOpen(open) {
  els.transactionForm.hidden = !open;
  els.toggleTransaction.setAttribute("aria-expanded", String(open));
  els.toggleTransaction.querySelector("span").textContent = open ? "Cancel transaction" : "New transaction";
  els.toggleTransaction.querySelector("svg path").setAttribute("d", open ? "m6 6 12 12M18 6 6 18" : "M12 5v14M5 12h14");
}

function openPotDetail(id) {
  activePotId = id;
  switchView("potDetail");
  renderPotDetail();
  document.querySelector("#detailPotName").focus({ preventScroll: true });
  window.scrollTo({ top: 0 });
}

function renderPotDetail() {
  if (!activePotId) return;
  const pot = getPot(activePotId);
  if (!pot) { switchView("overview"); return; }
  document.querySelector("#detailPotName").textContent = pot.name;
  document.querySelector("#detailPotBalance").textContent = money(pot.balance);
  const detailStyle = document.querySelector("#potDetailView").style;
  detailStyle.setProperty("--pot-color", pot.color);
  detailStyle.setProperty("--on-pot-color", contrastingText(pot.color));
  const progress = document.querySelector("#detailProgress");
  progress.hidden = !pot.target;
  progress.firstElementChild.style.width = `${pot.target ? Math.min(100, Math.max(0, pot.balance / pot.target * 100)) : 0}%`;
  document.querySelector("#detailPotTarget").textContent = pot.target ? `${money(pot.target)} target` : "No target";
  document.querySelector("#editDetailPot").hidden = Boolean(pot.system);
  els.txPot.value = activePotId;
  els.txPot.disabled = true;
  renderTransactionList(els.detailTransactionList, activePotId);
}

function transactionTitle(tx) {
  const potName = getPot(tx.potId)?.name || tx.potName || "Deleted pot";
  const toPotName = getPot(tx.toPotId)?.name || tx.toPotName || "Deleted pot";
  if (tx.type === "transfer") return `${potName} to ${toPotName}`;
  const labels = {
    scheduled: "Monthly split",
    interest: "Interest",
    unallocated: "Unallocated",
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
  if (!state.pots.length) {
    els.editorList.innerHTML = '<div class="empty-state">No pots yet.</div>';
  }
  state.pots.forEach((pot) => {
    const row = document.createElement("article");
    row.className = "editor-row";
    row.innerHTML = `
      <div>
        <strong>${escapeHtml(pot.name)}</strong>
        <span>${money(pot.balance)} - ${pot.target ? `${money(pot.target)} target` : "no target"}</span>
      </div>
      <button class="icon-button" type="button" title="Edit pot" aria-label="Edit ${escapeHtml(pot.name)}">
        <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m16 3 5 5M4 20l4-.8L21 6a2.1 2.1 0 0 0-3-3L5 16z" /></svg>
      </button>
    `;
    row.querySelector("button").addEventListener("click", () => fillPotForm(pot.id));
    els.editorList.appendChild(row);
  });
}

function fillPotForm(id) {
  const pot = state.pots.find((item) => item.id === id);
  if (!pot) return;
  selectSettingsSection("pots");
  els.potId.value = pot.id;
  els.potName.value = pot.name;
  els.potBalance.value = pot.balance;
  els.potTarget.value = pot.target || "";
  els.potColor.value = pot.color || DEFAULT_THEME.accent;
  els.deletePot.hidden = false;
  showPotEditor(`Edit ${pot.name}`);
  renderSwatches();
  els.potName.focus();
}

function showPotEditor(title) {
  document.querySelector("#potEditorTitle").textContent = title;
  els.potForm.hidden = false;
  els.resetPotForm.setAttribute("aria-expanded", "true");
}

function resetPotForm() {
  els.potId.value = "";
  els.potName.value = "";
  els.potBalance.value = "";
  els.potTarget.value = "";
  els.potColor.value = DEFAULT_THEME.accent;
  els.deletePot.hidden = true;
  els.potForm.hidden = true;
  els.resetPotForm.setAttribute("aria-expanded", "false");
}

function selectSettingsSection(section) {
  document.querySelectorAll("[data-settings]").forEach((button) => {
    const active = button.dataset.settings === section;
    button.classList.toggle("active", active);
    if (active) button.setAttribute("aria-current", "true");
    else button.removeAttribute("aria-current");
  });
  document.querySelectorAll("[data-settings-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.settingsPanel !== section;
  });
}

function switchView(view) {
  if (view !== "potDetail") activePotId = null;
  const host = view === "potDetail" ? els.detailComposerHost : els.activityComposerHost;
  host.appendChild(els.transactionComposer);
  els.transactionForm.reset();
  els.txToPot.setCustomValidity("");
  els.txDate.value = todayISO();
  els.toPotWrap.classList.add("hidden");
  els.txPot.disabled = view === "potDetail";
  setComposerOpen(false);
  document.querySelector("#appHeader").hidden = view === "potDetail";
  document.querySelector("#appNavigation").hidden = view === "potDetail";
  document.querySelector("#accountSummary").hidden = view !== "overview";
  document.querySelectorAll("[data-view]").forEach((tab) => tab.classList.toggle("active", tab.dataset.view === view));
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

document.querySelectorAll("[data-view]").forEach((tab) => {
  tab.addEventListener("click", () => switchView(tab.dataset.view));
});
document.querySelectorAll("[data-settings]").forEach((button) => {
  button.addEventListener("click", () => selectSettingsSection(button.dataset.settings));
});

els.toggleTransaction.addEventListener("click", () => setComposerOpen(els.transactionForm.hidden));
document.querySelector("#backToPots").addEventListener("click", () => {
  const potId = activePotId;
  switchView("overview");
  [...els.potsGrid.querySelectorAll(".pot-open")].find((button) => button.dataset.potId === potId)?.focus();
});
document.querySelector("#editDetailPot").addEventListener("click", () => {
  const id = activePotId;
  switchView("settings");
  fillPotForm(id);
});

els.txType.addEventListener("change", () => {
  els.txToPot.setCustomValidity("");
  els.toPotWrap.classList.toggle("hidden", els.txType.value !== "transfer");
});

els.transactionForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const type = els.txType.value;
  const amount = roundMoney(els.txAmount.value);
  const pot = getPot(els.txPot.value);
  const toPot = getPot(els.txToPot.value);
  if (!pot || amount < 0) return;
  if (type === "transfer" && (!toPot || toPot.id === pot.id)) {
    els.txToPot.setCustomValidity("Choose a different destination pot.");
    els.txToPot.reportValidity();
    return;
  }

  if (type === "addition") {
    updatePotBalance(pot.id, amount);
    addTransaction({ type, potId: pot.id, amount, date: els.txDate.value, note: els.txNote.value });
  }

  if (type === "withdrawal") {
    updatePotBalance(pot.id, -amount);
    addTransaction({ type, potId: pot.id, amount, date: els.txDate.value, note: els.txNote.value });
  }

  if (type === "set") {
    const previous = Number(pot.balance || 0);
    setPotBalance(pot.id, amount);
    addTransaction({ type, potId: pot.id, amount: amount - previous, date: els.txDate.value, note: els.txNote.value || "Manual balance edit" });
  }

  if (type === "transfer" && toPot && toPot.id !== pot.id) {
    updatePotBalance(pot.id, -amount);
    updatePotBalance(toPot.id, amount);
    addTransaction({ type, potId: pot.id, toPotId: toPot.id, amount, date: els.txDate.value, note: els.txNote.value });
  }

  els.transactionForm.reset();
  els.txDate.value = todayISO();
  els.toPotWrap.classList.add("hidden");
  setComposerOpen(false);
  saveState();
  render();
});

els.txToPot.addEventListener("change", () => els.txToPot.setCustomValidity(""));

els.addSplit.addEventListener("click", () => {
  if (!state.pots.length) return;
  state.settings.splits.push({ id: crypto.randomUUID(), potId: state.pots[0].id, amount: 0 });
  renderSplitRows();
});

els.splitList.addEventListener("input", () => {
  state.settings.splits = readSplitRows();
  renderSplitValidation();
});

els.splitList.addEventListener("change", () => {
  state.settings.splits = readSplitRows();
  renderSplitValidation();
});

els.splitList.addEventListener("click", (event) => {
  const button = event.target.closest(".remove-split");
  if (!button) return;
  const row = button.closest(".split-row");
  state.settings.splits = state.settings.splits.filter((split) => split.id !== row.dataset.id);
  renderSplitRows();
});

els.settingAmount.addEventListener("input", () => {
  state.settings.monthlyTransfer = els.settingAmount.value.trim() === "" ? "" : roundMoney(els.settingAmount.value);
  renderSplitValidation();
});

els.settingsForm.addEventListener("submit", (event) => {
  event.preventDefault();
  state.settings.monthlyTransfer = els.settingAmount.value.trim() === "" ? "" : roundMoney(els.settingAmount.value);
  state.settings.arrivalDay = els.settingDay.value === "" ? "" : Math.min(28, Math.max(1, parseNumber(els.settingDay.value)));
  state.settings.interestApy = els.settingApy.value.trim() === "" ? "" : parseNumber(els.settingApy.value);
  state.settings.currency = els.settingCurrency.value;
  state.settings.splits = readSplitRows();
  if (state.settings.monthlyTransfer && !scheduleIsValid()) {
    render();
    return;
  }
  if (scheduleIsValid() && !state.settings.lastAutoPostMonth) {
    state.settings.lastAutoPostMonth = baselineProcessedMonthKey();
  }
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

els.resetPotForm.addEventListener("click", () => {
  resetPotForm();
  showPotEditor("New pot");
  renderSwatches();
  els.potName.focus();
});
document.querySelector("#cancelPotEdit").addEventListener("click", () => {
  resetPotForm();
  els.resetPotForm.focus();
});
els.potColor.addEventListener("input", renderSwatches);

els.deletePot.addEventListener("click", () => {
  const pot = state.pots.find((item) => item.id === els.potId.value);
  if (!pot) return;
  if (!confirm(`Delete "${pot.name}"? Its balance will move to Unallocated and history will stay available.`)) return;
  state.pots = state.pots.filter((item) => item.id !== pot.id);
  state.settings.splits = state.settings.splits.filter((split) => split.potId !== pot.id);
  if (Number(pot.balance || 0) > 0) addToUnallocated(pot.balance, todayISO(), `Balance from deleted pot ${pot.name}`);
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
  const backup = {
    ...state,
    backupVersion: BACKUP_VERSION,
    backupExportedAt: new Date().toISOString(),
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `money-pots-backup-${todayISO()}.json`;
  link.click();
  URL.revokeObjectURL(url);
});

document.querySelector("#importBackup").addEventListener("click", () => els.importData.click());
document.querySelector("#settingsImport").addEventListener("click", () => els.importData.click());
document.querySelector("#settingsExport").addEventListener("click", () => els.exportData.click());

els.importData.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  const imported = JSON.parse(await file.text());
  if (!Array.isArray(imported.pots) || !imported.settings) return;
  state = hydrateState(imported, { imported: true });
  processDueCycles();
  saveState();
  render();
  event.target.value = "";
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js"));
}

resetPotForm();
processDueCycles();
render();
