/*
  Weekly Free Time Calculator
  - Pure frontend app for GitHub Pages
  - Uses localStorage for persistence
*/

const STORAGE_KEY = "free-time-weekly-v2";

const DAY_OPTIONS = [
  { value: 1, short: "Mo", label: "Montag" },
  { value: 2, short: "Di", label: "Dienstag" },
  { value: 3, short: "Mi", label: "Mittwoch" },
  { value: 4, short: "Do", label: "Donnerstag" },
  { value: 5, short: "Fr", label: "Freitag" },
  { value: 6, short: "Sa", label: "Samstag" },
  { value: 0, short: "So", label: "Sonntag" },
];

const DEFAULT_STATE = {
  settings: {
    weekDate: getTodayIsoDate(),
    workStart: "07:00",
    workEnd: "18:00",
    minDurationHours: 1,
    filterMinHours: 1,
    sortMode: "chronological",
    viewMode: "list",
    taskDurationHours: 2,
  },
  workByDay: {
    enabled: false,
    days: DAY_OPTIONS.reduce((acc, day) => {
      acc[day.value] = { active: false, start: "", end: "" };
      return acc;
    }, {}),
  },
  recurring: [createBlankRow({ day: "1" })],
  variable: [createBlankRow({ day: "1" })],
};

let state = structuredClone(DEFAULT_STATE);
let lastComputation = null;
let highlightedSlots = new Set();
let pendingSlot = null;

const el = {
  weekDate: document.querySelector("#weekDate"),
  workStart: document.querySelector("#workStart"),
  workEnd: document.querySelector("#workEnd"),
  minDuration: document.querySelector("#minDuration"),
  slotFilterMin: document.querySelector("#slotFilterMin"),
  sortMode: document.querySelector("#sortMode"),
  viewMode: document.querySelector("#viewMode"),
  taskDuration: document.querySelector("#taskDuration"),
  taskFeedback: document.querySelector("#taskFeedback"),
  computeBtn: document.querySelector("#computeBtn"),
  findTaskBtn: document.querySelector("#findTaskBtn"),
  resetBtn: document.querySelector("#resetBtn"),
  clearStorageBtn: document.querySelector("#clearStorageBtn"),
  toggleSettings: document.querySelector("#toggleSettings"),
  settingsPanel: document.querySelector("#settingsPanel"),
  addRecurringBtn: document.querySelector("#addRecurringBtn"),
  addVariableBtn: document.querySelector("#addVariableBtn"),
  toggleRecurring: document.querySelector("#toggleRecurring"),
  recurringPanel: document.querySelector("#recurringPanel"),
  toggleVariable: document.querySelector("#toggleVariable"),
  variablePanel: document.querySelector("#variablePanel"),
  toggleWorkByDay: document.querySelector("#toggleWorkByDay"),
  workByDayPanel: document.querySelector("#workByDayPanel"),
  dailyWorkRows: document.querySelector("#dailyWorkRows"),
  recurringRows: document.querySelector("#recurringRows"),
  variableRows: document.querySelector("#variableRows"),
  template: document.querySelector("#rowTemplate"),
  errors: document.querySelector("#errors"),
  summary: document.querySelector("#summary"),
  results: document.querySelector("#results"),
  resultsSection: document.querySelector("#resultsSection"),
  slotDialog: document.querySelector("#slotDialog"),
  slotDialogForm: document.querySelector("#slotDialogForm"),
  dialogDay: document.querySelector("#dialogDay"),
  dialogStart: document.querySelector("#dialogStart"),
  dialogEnd: document.querySelector("#dialogEnd"),
  dialogLabel: document.querySelector("#dialogLabel"),
};

init();

function init() {
  state = loadState();
  bindSettings();
  bindButtons();
  renderDailyWorkRows();
  renderRows("recurring");
  renderRows("variable");
  computeAndRender({ scrollToResults: false });
}

function bindSettings() {
  el.weekDate.value = state.settings.weekDate;
  el.workStart.value = state.settings.workStart;
  el.workEnd.value = state.settings.workEnd;
  el.minDuration.value = Number(state.settings.minDurationHours).toFixed(1);
  el.slotFilterMin.value = String(state.settings.filterMinHours || 1);
  el.sortMode.value = state.settings.sortMode;
  el.viewMode.value = state.settings.viewMode;
  el.taskDuration.value = Number(state.settings.taskDurationHours || 2).toFixed(1);

  [
    el.weekDate,
    el.workStart,
    el.workEnd,
    el.minDuration,
    el.slotFilterMin,
    el.sortMode,
    el.viewMode,
    el.taskDuration,
  ].forEach((input) => {
    input.addEventListener("change", () => {
      saveSettingsFromUI();
      if (input === el.viewMode || input === el.sortMode || input === el.slotFilterMin) {
        computeAndRender({ scrollToResults: false });
      }
    });
  });
}

function bindButtons() {
  el.computeBtn.addEventListener("click", () => computeAndRender({ scrollToResults: true }));
  el.findTaskBtn.addEventListener("click", findTaskSlot);

  el.resetBtn.addEventListener("click", () => {
    resetToDefaults();
    computeAndRender({ scrollToResults: false });
  });

  el.clearStorageBtn.addEventListener("click", () => {
    localStorage.removeItem(STORAGE_KEY);
    resetToDefaults();
    computeAndRender({ scrollToResults: false });
  });

  el.addRecurringBtn.addEventListener("click", () => {
    state.recurring.push(createBlankRow());
    saveState(state);
    renderRows("recurring");
  });

  el.addVariableBtn.addEventListener("click", () => {
    state.variable.push(createBlankRow());
    saveState(state);
    renderRows("variable");
  });

  bindCollapsibleToggle(el.toggleSettings, el.settingsPanel, "Arbeitszeiten & globale Einstellungen", true);
  bindCollapsibleToggle(el.toggleRecurring, el.recurringPanel, "Feste wiederkehrende Termine", true);
  bindCollapsibleToggle(el.toggleVariable, el.variablePanel, "Variable Termine (aktuelle Woche)", true);
  bindCollapsibleToggle(el.toggleWorkByDay, el.workByDayPanel, "Arbeitszeiten pro Tag", false);

  el.slotDialogForm.addEventListener("submit", (event) => {
    event.preventDefault();
    saveSlotFromDialog();
  });

  el.slotDialogForm.addEventListener("reset", () => {
    el.slotDialog.close();
  });
}

function bindCollapsibleToggle(toggleButton, panel, label, expandedByDefault) {
  if (!toggleButton || !panel) return;

  panel.classList.toggle("collapsed", !expandedByDefault);
  toggleButton.textContent = `${expandedByDefault ? "▼" : "▶"} ${label}`;

  toggleButton.addEventListener("click", () => {
    const isCollapsed = panel.classList.toggle("collapsed");
    toggleButton.textContent = `${isCollapsed ? "▶" : "▼"} ${label}`;
  });
}

function createBlankRow(overrides = {}) {
  // New rows start with a weekday so they stay visible and editable right away.
  return { active: false, day: "1", start: "", end: "", label: "", ...overrides };
}

function isRowFilled(row) {
  return Boolean(row.active || row.day || row.start || row.end || row.label);
}

function renderRows(type) {
  const target = type === "recurring" ? el.recurringRows : el.variableRows;
  target.innerHTML = "";

  const visibleRows = state[type]
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => isRowFilled(row));

  if (!visibleRows.length) {
    const hint = document.createElement("p");
    hint.className = "hint";
    hint.textContent = "Noch keine Einträge.";
    target.appendChild(hint);
    return;
  }

  visibleRows.forEach(({ row, index }) => {
    const node = el.template.content.firstElementChild.cloneNode(true);
    node.dataset.type = type;
    node.dataset.index = String(index);

    const activeInput = node.querySelector('[data-field="active"]');
    const dayInput = node.querySelector('[data-field="day"]');
    const startInput = node.querySelector('[data-field="start"]');
    const endInput = node.querySelector('[data-field="end"]');
    const labelInput = node.querySelector('[data-field="label"]');
    const removeBtn = node.querySelector('[data-field="remove"]');

    activeInput.checked = Boolean(row.active);
    dayInput.value = row.day;
    startInput.value = row.start;
    endInput.value = row.end;
    labelInput.value = row.label || "";

    [activeInput, dayInput, startInput, endInput, labelInput].forEach((input) => {
      input.addEventListener("change", () => {
        updateRowStateFromNode(node);
        saveState(state);
      });
    });

    removeBtn.addEventListener("click", () => {
      state[type].splice(index, 1);
      saveState(state);
      renderRows(type);
      computeAndRender({ scrollToResults: false });
    });

    target.appendChild(node);
  });
}

function renderDailyWorkRows() {
  el.dailyWorkRows.innerHTML = "";

  const globalToggle = document.createElement("label");
  globalToggle.className = "daily-global-toggle";
  globalToggle.innerHTML = `
    <input id="useWorkByDay" type="checkbox" ${state.workByDay.enabled ? "checked" : ""} />
    Tagesbezogene Arbeitszeiten aktivieren
  `;
  el.dailyWorkRows.appendChild(globalToggle);

  globalToggle.querySelector("#useWorkByDay").addEventListener("change", (event) => {
    state.workByDay.enabled = event.target.checked;
    saveState(state);
    computeAndRender({ scrollToResults: false });
  });

  DAY_OPTIONS.forEach((day) => {
    const config = state.workByDay.days[day.value] || { active: false, start: "", end: "" };
    const row = document.createElement("div");
    row.className = "daily-row";
    row.innerHTML = `
      <label class="checkbox-label">
        <input data-day-field="active" type="checkbox" ${config.active ? "checked" : ""} />
        ${day.label}
      </label>
      <label>
        Von
        <input data-day-field="start" type="time" step="60" value="${config.start || ""}" />
      </label>
      <label>
        Bis
        <input data-day-field="end" type="time" step="60" value="${config.end || ""}" />
      </label>
    `;

    row.querySelectorAll("[data-day-field]").forEach((input) => {
      input.addEventListener("change", () => {
        const next = {
          active: row.querySelector('[data-day-field="active"]').checked,
          start: row.querySelector('[data-day-field="start"]').value,
          end: row.querySelector('[data-day-field="end"]').value,
        };
        state.workByDay.days[day.value] = next;
        saveState(state);
      });
    });

    el.dailyWorkRows.appendChild(row);
  });
}

function updateRowStateFromNode(rowNode) {
  const type = rowNode.dataset.type;
  const index = Number(rowNode.dataset.index);

  state[type][index] = {
    active: rowNode.querySelector('[data-field="active"]').checked,
    day: rowNode.querySelector('[data-field="day"]').value,
    start: rowNode.querySelector('[data-field="start"]').value,
    end: rowNode.querySelector('[data-field="end"]').value,
    label: rowNode.querySelector('[data-field="label"]').value || "",
  };
}

function saveSettingsFromUI() {
  state.settings.weekDate = el.weekDate.value;
  state.settings.workStart = el.workStart.value;
  state.settings.workEnd = el.workEnd.value;
  state.settings.minDurationHours = Number(el.minDuration.value);
  state.settings.filterMinHours = Number(el.slotFilterMin.value);
  state.settings.sortMode = el.sortMode.value;
  state.settings.viewMode = el.viewMode.value;
  state.settings.taskDurationHours = Number(el.taskDuration.value);
  saveState(state);
}

function getWorkWindowForDay(dayValue, globalStart, globalEnd, errors) {
  if (!state.workByDay.enabled) {
    return { start: globalStart, end: globalEnd };
  }

  const dayConfig = state.workByDay.days[dayValue];
  if (!dayConfig?.active) {
    return { start: globalStart, end: globalEnd };
  }

  const start = parseTimeToMinutes(dayConfig.start);
  const end = parseTimeToMinutes(dayConfig.end);

  if (start == null || end == null || start >= end) {
    const dayLabel = DAY_OPTIONS.find((day) => day.value === dayValue)?.label || "Tag";
    errors.push(`${dayLabel}: Tages-Arbeitszeit ist ungültig.`);
    return { start: globalStart, end: globalEnd };
  }

  return { start, end };
}

function computeAndRender({ scrollToResults }) {
  saveSettingsFromUI();
  clearValidationStyles();
  highlightedSlots = new Set();
  el.taskFeedback.textContent = "";

  const errors = [];
  const globalWorkStart = parseTimeToMinutes(state.settings.workStart);
  const globalWorkEnd = parseTimeToMinutes(state.settings.workEnd);
  const minDurationMinutes = Math.round(Number(state.settings.minDurationHours) * 60);
  const filterMinMinutes = Math.round(Number(state.settings.filterMinHours) * 60);

  if (globalWorkStart == null || globalWorkEnd == null) {
    errors.push("Arbeitszeit muss im Format HH:MM gesetzt sein.");
  } else if (globalWorkStart >= globalWorkEnd) {
    errors.push("Arbeitszeit von muss früher als bis sein.");
    markInputError(el.workStart);
    markInputError(el.workEnd);
  }

  if (!Number.isFinite(minDurationMinutes) || minDurationMinutes <= 0) {
    errors.push("Mindestdauer muss größer als 0 sein.");
    markInputError(el.minDuration);
  }

  const weekDays = getWeekDays(state.settings.weekDate);
  if (!weekDays.length) {
    errors.push("Bitte ein gültiges Datum für die Woche wählen.");
    markInputError(el.weekDate);
  }

  const recurringValidation = collectValidatedRows("recurring", globalWorkStart, globalWorkEnd);
  const variableValidation = collectValidatedRows("variable", globalWorkStart, globalWorkEnd);

  errors.push(...recurringValidation.errors, ...variableValidation.errors);
  renderErrors(errors);

  if (errors.some((msg) => msg.includes("Arbeitszeit") || msg.includes("Mindestdauer") || msg.includes("Datum"))) {
    el.summary.textContent = "Keine Berechnung wegen globaler Fehler.";
    el.results.innerHTML = "";
    return;
  }

  const dayResults = [];
  let totalFreeMinutes = 0;
  let totalSlots = 0;
  let longestSlotMinutes = 0;

  DAY_OPTIONS.forEach((day) => {
    const workWindow = getWorkWindowForDay(day.value, globalWorkStart, globalWorkEnd, errors);

    const busy = [
      ...recurringValidation.rows.filter((r) => r.day === day.value),
      ...variableValidation.rows.filter((r) => r.day === day.value),
    ].map((r) => ({ start: r.startMinutes, end: r.endMinutes }));

    const mergedBusy = mergeIntervals(busy);
    let freeIntervals = computeFreeIntervals(workWindow.start, workWindow.end, mergedBusy).filter(
      (slot) => slot.end - slot.start >= Math.max(minDurationMinutes, filterMinMinutes),
    );

    if (state.settings.sortMode === "length") {
      freeIntervals = [...freeIntervals].sort((a, b) => b.end - b.start - (a.end - a.start));
    }

    freeIntervals.forEach((slot) => {
      longestSlotMinutes = Math.max(longestSlotMinutes, slot.end - slot.start);
    });

    const freeMinutesForDay = freeIntervals.reduce((sum, slot) => sum + (slot.end - slot.start), 0);
    totalFreeMinutes += freeMinutesForDay;
    totalSlots += freeIntervals.length;

    dayResults.push({
      day,
      date: weekDays.find((d) => d.dayValue === day.value)?.date,
      workWindow,
      busyIntervals: mergedBusy,
      freeIntervals,
    });
  });

  if (errors.length) {
    renderErrors(errors);
  }

  lastComputation = {
    dayResults,
    totalFreeMinutes,
    totalSlots,
    longestSlotMinutes,
  };

  renderResults(lastComputation);

  if (scrollToResults) {
    el.resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function collectValidatedRows(type, workStart, workEnd) {
  const rows = [];
  const errors = [];
  const rowNodes = [...document.querySelectorAll(`.row[data-type="${type}"]`)];

  rowNodes.forEach((node, visibleIndex) => {
    const index = Number(node.dataset.index);
    const row = state[type][index];
    const validation = validateRow(row, workStart, workEnd);

    const rowError = node.querySelector("[data-row-error]");
    rowError.textContent = validation.error || "";

    if (validation.error) {
      errors.push(`${type === "recurring" ? "Fester" : "Variabler"} Termin ${visibleIndex + 1}: ${validation.error}`);
      markRowInputs(node, validation.invalidFields);
      return;
    }

    if (validation.normalized) {
      rows.push(validation.normalized);
    }
  });

  return { rows, errors };
}

function validateRow(row, workStart, workEnd) {
  if (!row || !isRowFilled(row)) {
    return { normalized: null };
  }

  if (!row.active) {
    return { normalized: null };
  }

  const invalidFields = [];

  if (!row.day) invalidFields.push("day");
  if (!row.start) invalidFields.push("start");
  if (!row.end) invalidFields.push("end");

  if (invalidFields.length) {
    return {
      error: "Aktive Zeile braucht Wochentag, Start und Ende.",
      invalidFields,
    };
  }

  const startMinutes = parseTimeToMinutes(row.start);
  const endMinutes = parseTimeToMinutes(row.end);

  if (startMinutes == null || endMinutes == null) {
    return { error: "Zeitformat muss HH:MM sein.", invalidFields: ["start", "end"] };
  }

  if (startMinutes >= endMinutes) {
    return { error: "Start muss vor Ende liegen.", invalidFields: ["start", "end"] };
  }

  const clamped = clampIntervalToWorkWindow(startMinutes, endMinutes, workStart, workEnd);
  if (!clamped) {
    return { normalized: null };
  }

  return {
    normalized: {
      day: Number(row.day),
      startMinutes: clamped.start,
      endMinutes: clamped.end,
      label: row.label || "",
    },
  };
}

function findTaskSlot() {
  if (!lastComputation) {
    el.taskFeedback.textContent = "Bitte zuerst berechnen.";
    return;
  }

  const taskMinutes = Math.round(Number(el.taskDuration.value) * 60);
  if (!Number.isFinite(taskMinutes) || taskMinutes <= 0) {
    el.taskFeedback.textContent = "Aufgabendauer muss größer als 0 sein.";
    markInputError(el.taskDuration);
    return;
  }

  saveSettingsFromUI();

  const allSlots = [];
  lastComputation.dayResults.forEach((entry) => {
    entry.freeIntervals.forEach((slot) => {
      allSlots.push({
        day: entry.day,
        date: entry.date,
        start: slot.start,
        end: slot.end,
        duration: slot.end - slot.start,
      });
    });
  });

  const single = allSlots.find((slot) => slot.duration >= taskMinutes);
  if (single) {
    highlightedSlots = new Set([slotKey(single.day.value, single.start, single.end)]);
    renderResults(lastComputation);
    el.taskFeedback.textContent = `Passender Slot gefunden: ${formatDuration(taskMinutes)} am ${single.day.label} (${formatMinutesToTime(single.start)}–${formatMinutesToTime(single.end)}).`;
    return;
  }

  const picks = findBestSplit(allSlots, taskMinutes);

  if (!picks) {
    highlightedSlots = new Set();
    renderResults(lastComputation);
    el.taskFeedback.textContent = "Kein passender Slot gefunden – auch keine sinnvolle Aufteilung in 2–3 Slots möglich.";
    return;
  }

  highlightedSlots = new Set(picks.map((slot) => slotKey(slot.day.value, slot.start, slot.end)));
  renderResults(lastComputation);

  const phrase = picks
    .slice(0, 3)
    .map((slot) => `${formatDuration(slot.duration)} am ${slot.day.label}`)
    .join(" und ");
  el.taskFeedback.textContent = `Kein einzelner Slot gefunden, aber möglich: ${phrase}.`;
}

function findBestSplit(slots, taskMinutes) {
  // Try to find a split of exactly 2 or 3 slots with minimal unused time.
  const byTime = [...slots].sort((a, b) => {
    if (a.day.value !== b.day.value) return a.day.value - b.day.value;
    return a.start - b.start;
  });

  let best = null;

  const consider = (selection) => {
    const total = selection.reduce((sum, slot) => sum + slot.duration, 0);
    if (total < taskMinutes) return;

    const over = total - taskMinutes;
    const candidate = { selection, over, total };

    if (!best || candidate.over < best.over || (candidate.over === best.over && candidate.total < best.total)) {
      best = candidate;
    }
  };

  for (let i = 0; i < byTime.length; i += 1) {
    for (let j = i + 1; j < byTime.length; j += 1) {
      consider([byTime[i], byTime[j]]);
      for (let k = j + 1; k < byTime.length; k += 1) {
        consider([byTime[i], byTime[j], byTime[k]]);
      }
    }
  }

  return best?.selection || null;
}

function renderResults(data) {
  el.summary.textContent = `Slots: ${data.totalSlots} • Gesamtfrei: ${formatDuration(data.totalFreeMinutes)} • Längster Slot: ${formatDuration(data.longestSlotMinutes)}`;
  el.results.innerHTML = "";

  data.dayResults.forEach((entry) => {
    const box = document.createElement("article");
    box.className = "result-day";

    const title = document.createElement("h3");
    title.textContent = `${entry.day.label} (${entry.date || "-"})`;
    box.appendChild(title);

    if (state.settings.viewMode === "timeline") {
      box.appendChild(renderTimeline(entry));
    }

    if (!entry.freeIntervals.length) {
      const noData = document.createElement("p");
      noData.textContent = "Kein freies Zeitfenster (>= Filter/Mindestdauer).";
      box.appendChild(noData);
    } else {
      const list = document.createElement("ul");

      entry.freeIntervals.forEach((slot, idx) => {
        const li = document.createElement("li");
        const button = document.createElement("button");
        const duration = slot.end - slot.start;
        const key = slotKey(entry.day.value, slot.start, slot.end);

        button.type = "button";
        button.className = `slot-btn ${highlightedSlots.has(key) ? "highlight" : ""}`;
        button.textContent = `${idx + 1}. ${formatMinutesToTime(slot.start)}–${formatMinutesToTime(slot.end)} (${formatDuration(duration)})`;
        button.addEventListener("click", () => openSlotDialog(entry, slot));

        li.appendChild(button);
        list.appendChild(li);
      });

      box.appendChild(list);
    }

    el.results.appendChild(box);
  });
}

function renderTimeline(entry) {
  const timeline = document.createElement("div");
  timeline.className = "timeline";

  const total = entry.workWindow.end - entry.workWindow.start;
  if (total <= 0) {
    timeline.textContent = "Keine gültige Arbeitszeit.";
    return timeline;
  }

  const busySegments = mergeIntervals(entry.busyIntervals).map((busy) => ({
    left: ((busy.start - entry.workWindow.start) / total) * 100,
    width: ((busy.end - busy.start) / total) * 100,
  }));

  busySegments.forEach((segment) => {
    const block = document.createElement("span");
    block.className = "timeline-busy";
    block.style.left = `${Math.max(0, segment.left)}%`;
    block.style.width = `${Math.max(0, segment.width)}%`;
    timeline.appendChild(block);
  });

  return timeline;
}

function openSlotDialog(entry, slot) {
  pendingSlot = { entry, slot };
  el.dialogDay.value = String(entry.day.value);
  el.dialogStart.value = formatMinutesToTime(slot.start);
  el.dialogEnd.value = formatMinutesToTime(slot.end);
  el.dialogLabel.value = "";
  el.slotDialog.showModal();
}

function saveSlotFromDialog() {
  if (!pendingSlot) return;

  const newRow = {
    active: true,
    day: el.dialogDay.value,
    start: el.dialogStart.value,
    end: el.dialogEnd.value,
    label: el.dialogLabel.value.trim(),
  };

  state.variable.push(newRow);
  saveState(state);
  renderRows("variable");
  computeAndRender({ scrollToResults: false });
  el.slotDialog.close();
  pendingSlot = null;
}

function slotKey(day, start, end) {
  return `${day}-${start}-${end}`;
}

function renderErrors(errorList) {
  el.errors.innerHTML = "";
  errorList.forEach((err) => {
    const li = document.createElement("li");
    li.textContent = err;
    el.errors.appendChild(li);
  });
}

function parseTimeToMinutes(timeText) {
  if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(timeText || "")) {
    return null;
  }
  const [hours, minutes] = timeText.split(":").map(Number);
  return hours * 60 + minutes;
}

function formatMinutesToTime(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function formatDuration(minutes) {
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hrs}h ${String(mins).padStart(2, "0")}m`;
}

function clampIntervalToWorkWindow(start, end, workStart, workEnd) {
  const clampedStart = Math.max(start, workStart);
  const clampedEnd = Math.min(end, workEnd);
  if (clampedStart >= clampedEnd) return null;
  return { start: clampedStart, end: clampedEnd };
}

function mergeIntervals(intervals) {
  if (!intervals.length) return [];
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const merged = [sorted[0]];

  for (let i = 1; i < sorted.length; i += 1) {
    const current = sorted[i];
    const last = merged[merged.length - 1];

    if (current.start <= last.end) {
      last.end = Math.max(last.end, current.end);
    } else {
      merged.push({ ...current });
    }
  }

  return merged;
}

function computeFreeIntervals(workStart, workEnd, busyIntervals) {
  const free = [];
  let cursor = workStart;

  busyIntervals.forEach((busy) => {
    if (busy.start > cursor) {
      free.push({ start: cursor, end: busy.start });
    }
    cursor = Math.max(cursor, busy.end);
  });

  if (cursor < workEnd) {
    free.push({ start: cursor, end: workEnd });
  }

  return free;
}

function getWeekDays(inputDate) {
  const raw = new Date(inputDate);
  if (Number.isNaN(raw.getTime())) {
    return [];
  }

  const mondayOffset = (raw.getDay() + 6) % 7;
  const monday = new Date(raw);
  monday.setDate(raw.getDate() - mondayOffset);

  const days = [];
  for (let i = 0; i < 7; i += 1) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    days.push({
      dayValue: d.getDay(),
      date: d.toISOString().slice(0, 10),
    });
  }

  return days;
}

function markRowInputs(node, fields) {
  fields.forEach((field) => {
    const input = node.querySelector(`[data-field="${field}"]`);
    if (input) input.classList.add("error");
  });
}

function markInputError(input) {
  input.classList.add("error");
}

function clearValidationStyles() {
  document.querySelectorAll(".error").forEach((n) => n.classList.remove("error"));
  document.querySelectorAll("[data-row-error]").forEach((n) => {
    n.textContent = "";
  });
}

function saveState(nextState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
}

function normalizeRows(inputRows) {
  const rows = Array.isArray(inputRows) ? inputRows : [];
  return rows.map((row) => ({
    active: Boolean(row.active),
    day: row.day ?? "",
    start: row.start ?? "",
    end: row.end ?? "",
    label: row.label ?? "",
  }));
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return normalizeState(parsed);
    }

    // Migration support for the previous state key.
    const legacyRaw = localStorage.getItem("free-time-weekly-v1");
    if (legacyRaw) {
      const parsedLegacy = JSON.parse(legacyRaw);
      return normalizeState(parsedLegacy);
    }

    return structuredClone(DEFAULT_STATE);
  } catch (error) {
    return structuredClone(DEFAULT_STATE);
  }
}

function normalizeState(input) {
  const normalized = {
    settings: {
      ...DEFAULT_STATE.settings,
      ...(input.settings || {}),
    },
    workByDay: {
      enabled: Boolean(input.workByDay?.enabled),
      days: DAY_OPTIONS.reduce((acc, day) => {
        const row = input.workByDay?.days?.[day.value] || {};
        acc[day.value] = {
          active: Boolean(row.active),
          start: row.start || "",
          end: row.end || "",
        };
        return acc;
      }, {}),
    },
    recurring: normalizeRows(input.recurring),
    variable: normalizeRows(input.variable),
  };

  // Ensure at least one visible row per section if data is empty.
  if (!normalized.recurring.length) normalized.recurring = [createBlankRow({ day: "1" })];
  if (!normalized.variable.length) normalized.variable = [createBlankRow({ day: "1" })];

  return normalized;
}

function resetToDefaults() {
  state = structuredClone(DEFAULT_STATE);
  if (!state.recurring.length) state.recurring = [createBlankRow({ day: "1" })];
  if (!state.variable.length) state.variable = [createBlankRow({ day: "1" })];
  bindSettings();
  renderDailyWorkRows();
  renderRows("recurring");
  renderRows("variable");
  saveState(state);
}

function getTodayIsoDate() {
  const now = new Date();
  const tzOffsetMs = now.getTimezoneOffset() * 60 * 1000;
  return new Date(now.getTime() - tzOffsetMs).toISOString().slice(0, 10);
}
