/*
  Weekly Free Time Calculator
  - Pure frontend app for GitHub Pages
  - Uses localStorage for persistence
*/

const STORAGE_KEY = "free-time-weekly-v1";

const DAY_OPTIONS = [
  { value: 1, label: "Montag" },
  { value: 2, label: "Dienstag" },
  { value: 3, label: "Mittwoch" },
  { value: 4, label: "Donnerstag" },
  { value: 5, label: "Freitag" },
  { value: 6, label: "Samstag" },
  { value: 0, label: "Sonntag" },
];

const DEFAULT_STATE = {
  settings: {
    weekDate: getTodayIsoDate(),
    workStart: "07:00",
    workEnd: "18:00",
    minDurationHours: 1.0,
  },
  recurring: [
    { active: true, day: "1", start: "10:30", end: "12:30", label: "" },
    { active: true, day: "2", start: "08:30", end: "10:30", label: "" },
    { active: true, day: "2", start: "13:00", end: "15:00", label: "" },
    { active: false, day: "", start: "", end: "", label: "" },
    { active: false, day: "", start: "", end: "", label: "" },
  ],
  variable: Array.from({ length: 10 }, () => ({
    active: false,
    day: "",
    start: "",
    end: "",
    label: "",
  })),
};

let state = structuredClone(DEFAULT_STATE);

const el = {
  weekDate: document.querySelector("#weekDate"),
  workStart: document.querySelector("#workStart"),
  workEnd: document.querySelector("#workEnd"),
  minDuration: document.querySelector("#minDuration"),
  computeBtn: document.querySelector("#computeBtn"),
  resetBtn: document.querySelector("#resetBtn"),
  clearStorageBtn: document.querySelector("#clearStorageBtn"),
  recurringRows: document.querySelector("#recurringRows"),
  variableRows: document.querySelector("#variableRows"),
  template: document.querySelector("#rowTemplate"),
  errors: document.querySelector("#errors"),
  summary: document.querySelector("#summary"),
  results: document.querySelector("#results"),
};

init();

function init() {
  state = loadState();
  bindSettings();
  renderRows("recurring", 5, true);
  renderRows("variable", 10, false);
  bindButtons();
  computeAndRender();
}

function bindSettings() {
  el.weekDate.value = state.settings.weekDate;
  el.workStart.value = state.settings.workStart;
  el.workEnd.value = state.settings.workEnd;
  el.minDuration.value = Number(state.settings.minDurationHours).toFixed(1);

  el.weekDate.addEventListener("change", saveSettingsFromUI);
  el.workStart.addEventListener("change", saveSettingsFromUI);
  el.workEnd.addEventListener("change", saveSettingsFromUI);
  el.minDuration.addEventListener("change", saveSettingsFromUI);
}

function bindButtons() {
  el.computeBtn.addEventListener("click", computeAndRender);

  el.resetBtn.addEventListener("click", () => {
    resetToDefaults();
    computeAndRender();
  });

  el.clearStorageBtn.addEventListener("click", () => {
    localStorage.removeItem(STORAGE_KEY);
    resetToDefaults();
    computeAndRender();
  });
}

function renderRows(type, count, includeLabel) {
  const target = type === "recurring" ? el.recurringRows : el.variableRows;
  target.innerHTML = "";

  for (let i = 0; i < count; i += 1) {
    const rowData = state[type][i];
    const node = el.template.content.firstElementChild.cloneNode(true);
    node.dataset.type = type;
    node.dataset.index = String(i);

    const activeInput = node.querySelector('[data-field="active"]');
    const dayInput = node.querySelector('[data-field="day"]');
    const startInput = node.querySelector('[data-field="start"]');
    const endInput = node.querySelector('[data-field="end"]');
    const labelInput = node.querySelector('[data-field="label"]');

    activeInput.checked = Boolean(rowData.active);
    dayInput.value = rowData.day;
    startInput.value = rowData.start;
    endInput.value = rowData.end;
    labelInput.value = rowData.label || "";

    if (!includeLabel) {
      labelInput.closest("label").remove();
    }

    [activeInput, dayInput, startInput, endInput, labelInput].forEach((input) => {
      if (!input) return;
      input.addEventListener("change", () => {
        updateRowStateFromNode(node);
        saveState(state);
      });
    });

    target.appendChild(node);
  }
}

function updateRowStateFromNode(rowNode) {
  const type = rowNode.dataset.type;
  const index = Number(rowNode.dataset.index);

  state[type][index] = {
    active: rowNode.querySelector('[data-field="active"]').checked,
    day: rowNode.querySelector('[data-field="day"]').value,
    start: rowNode.querySelector('[data-field="start"]').value,
    end: rowNode.querySelector('[data-field="end"]').value,
    label: rowNode.querySelector('[data-field="label"]')?.value || "",
  };
}

function saveSettingsFromUI() {
  state.settings.weekDate = el.weekDate.value;
  state.settings.workStart = el.workStart.value;
  state.settings.workEnd = el.workEnd.value;
  state.settings.minDurationHours = Number(el.minDuration.value);
  saveState(state);
}

function computeAndRender() {
  saveSettingsFromUI();
  clearValidationStyles();

  const errors = [];

  const workStart = parseTimeToMinutes(state.settings.workStart);
  const workEnd = parseTimeToMinutes(state.settings.workEnd);
  const minDurationMinutes = Math.round(Number(state.settings.minDurationHours) * 60);

  if (workStart == null || workEnd == null) {
    errors.push("Arbeitszeit muss im Format HH:MM gesetzt sein.");
  } else if (workStart >= workEnd) {
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

  const recurringValidation = collectValidatedRows("recurring", workStart, workEnd);
  const variableValidation = collectValidatedRows("variable", workStart, workEnd);

  errors.push(...recurringValidation.errors, ...variableValidation.errors);
  renderErrors(errors);

  if (
    errors.some((msg) => msg.includes("Arbeitszeit") || msg.includes("Mindestdauer") || msg.includes("Datum"))
  ) {
    el.summary.textContent = "Keine Berechnung wegen globaler Fehler.";
    el.results.innerHTML = "";
    return;
  }

  const dayResults = [];
  let totalFreeMinutes = 0;
  let totalSlots = 0;

  DAY_OPTIONS.forEach((day) => {
    const busy = [
      ...recurringValidation.rows.filter((r) => r.day === day.value),
      ...variableValidation.rows.filter((r) => r.day === day.value),
    ].map((r) => ({ start: r.startMinutes, end: r.endMinutes }));

    const mergedBusy = mergeIntervals(busy);
    const freeIntervals = computeFreeIntervals(workStart, workEnd, mergedBusy).filter(
      (slot) => slot.end - slot.start >= minDurationMinutes,
    );

    const freeMinutesForDay = freeIntervals.reduce((sum, slot) => sum + (slot.end - slot.start), 0);
    totalFreeMinutes += freeMinutesForDay;
    totalSlots += freeIntervals.length;

    dayResults.push({
      day,
      date: weekDays.find((d) => d.dayValue === day.value)?.date,
      freeIntervals,
    });
  });

  renderResults(dayResults, totalFreeMinutes, totalSlots);
}

function collectValidatedRows(type, workStart, workEnd) {
  const rows = [];
  const errors = [];
  const rowNodes = [...document.querySelectorAll(`.row[data-type="${type}"]`)];

  rowNodes.forEach((node, index) => {
    const row = state[type][index];
    const validation = validateRow(row, workStart, workEnd);

    const rowError = node.querySelector("[data-row-error]");
    rowError.textContent = validation.error || "";

    if (validation.error) {
      errors.push(`${type === "recurring" ? "Fester" : "Variabler"} Termin ${index + 1}: ${validation.error}`);
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

function renderResults(dayResults, totalFreeMinutes, totalSlots) {
  el.summary.textContent = `Gesamt: ${totalSlots} freie Slots, ${formatDuration(totalFreeMinutes)} freie Zeit in der Woche.`;
  el.results.innerHTML = "";

  dayResults.forEach((entry) => {
    const box = document.createElement("article");
    box.className = "result-day";

    const title = document.createElement("h3");
    title.textContent = `${entry.day.label} (${entry.date || "-"})`;
    box.appendChild(title);

    if (!entry.freeIntervals.length) {
      const noData = document.createElement("p");
      noData.textContent = "Kein freies Zeitfenster (>= Mindestdauer).";
      box.appendChild(noData);
    } else {
      const list = document.createElement("ul");
      entry.freeIntervals.forEach((slot, idx) => {
        const li = document.createElement("li");
        li.textContent = `${idx + 1}. ${formatMinutesToTime(slot.start)}–${formatMinutesToTime(slot.end)}`;
        list.appendChild(li);
      });
      box.appendChild(list);
    }

    el.results.appendChild(box);
  });
}

function renderErrors(errorList) {
  el.errors.innerHTML = "";
  errorList.forEach((err) => {
    const li = document.createElement("li");
    li.textContent = err;
    el.errors.appendChild(li);
  });
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

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return structuredClone(DEFAULT_STATE);
    }

    const parsed = JSON.parse(raw);
    return {
      settings: {
        ...DEFAULT_STATE.settings,
        ...(parsed.settings || {}),
      },
      recurring: normalizeRows(parsed.recurring, 5),
      variable: normalizeRows(parsed.variable, 10),
    };
  } catch (error) {
    return structuredClone(DEFAULT_STATE);
  }
}

function normalizeRows(inputRows, count) {
  const rows = Array.isArray(inputRows) ? inputRows.slice(0, count) : [];
  while (rows.length < count) {
    rows.push({ active: false, day: "", start: "", end: "", label: "" });
  }
  return rows.map((row) => ({
    active: Boolean(row.active),
    day: row.day ?? "",
    start: row.start ?? "",
    end: row.end ?? "",
    label: row.label ?? "",
  }));
}

function resetToDefaults() {
  state = structuredClone(DEFAULT_STATE);
  bindSettings();
  renderRows("recurring", 5, true);
  renderRows("variable", 10, false);
  saveState(state);
}

function getTodayIsoDate() {
  const now = new Date();
  const tzOffsetMs = now.getTimezoneOffset() * 60 * 1000;
  return new Date(now.getTime() - tzOffsetMs).toISOString().slice(0, 10);
}
