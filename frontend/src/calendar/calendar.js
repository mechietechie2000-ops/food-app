import { useState, useEffect, useMemo, useCallback } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import listPlugin from "@fullcalendar/list";
import {
  Box,
  Popover,
  TextField,
  Switch,
  FormControlLabel,
  Typography,
  IconButton,
  Button,
  Alert,
  Divider,
  useTheme,
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import { tokens } from "../../theme";

// ---- Category palette ---------------------------------------------------
// Free-text `category` column on the backend, but we constrain the UI to a
// fixed, color-coded set so the calendar reads at a glance (Apple Calendar
// style colored dots/pills) instead of everything looking the same.
const CATEGORIES = [
  { key: "general", label: "General", color: "#6870fa" },
  { key: "work", label: "Work", color: "#4cceac" },
  { key: "personal", label: "Personal", color: "#f2a65a" },
  { key: "birthday", label: "Birthday", color: "#c084fc" },
  { key: "holiday", label: "Holiday", color: "#e2726e" },
];
const categoryOf = (key) =>
  CATEGORIES.find((c) => c.key === key) || CATEGORIES[0];

const generateId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `evt-${Date.now()}-${Math.random().toString(16).slice(2)}`;

// datetime-local / date <input> <-> ISO helpers
const toInputValue = (iso, allDay) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return allDay ? iso.slice(0, 10) : iso.slice(0, 16);
  const pad = (n) => String(n).padStart(2, "0");
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  if (allDay) return date;
  return `${date}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const emptyDraft = () => ({
  id: null,
  title: "",
  category: "general",
  allDay: true,
  start: toInputValue(new Date().toISOString(), true),
  end: "",
});

const Calendar = () => {
  const theme = useTheme();
  const colors = tokens(theme.palette.mode);
  const isDark = theme.palette.mode === "dark";

  const [currentEvents, setCurrentEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  // Popover / editor state
  const [anchorPos, setAnchorPos] = useState(null); // { top, left } or null (closed)
  const [draft, setDraft] = useState(emptyDraft());
  const [mode, setMode] = useState("create"); // "create" | "edit"
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const popoverOpen = Boolean(anchorPos);

  // ---- Load events --------------------------------------------------
  useEffect(() => {
    const fetchEvents = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const response = await fetch("/api/calendar");
        if (!response.ok) {
          throw new Error(
            response.status === 401 || response.status === 403
              ? "You're signed out — sign in to see your calendar."
              : `Couldn't load events (${response.status}).`
          );
        }
        const data = await response.json();
        setCurrentEvents(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Failed to fetch events:", error);
        setLoadError(error.message || "Couldn't load events.");
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
  }, []);

  // ---- Popover open helpers ------------------------------------------
  const openCreateAt = useCallback((point, prefill) => {
    setMode("create");
    setSaveError(null);
    setConfirmingDelete(false);
    setDraft({ ...emptyDraft(), ...prefill });
    setAnchorPos(point);
  }, []);

  const openEditAt = useCallback((point, event) => {
    setMode("edit");
    setSaveError(null);
    setConfirmingDelete(false);
    const allDay = event.allDay;
    setDraft({
      id: event.id,
      title: event.title,
      category: event.extendedProps?.category || "general",
      allDay,
      start: toInputValue(event.startStr, allDay),
      end: event.endStr ? toInputValue(event.endStr, allDay) : "",
    });
    setAnchorPos(point);
  }, []);

  const closePopover = () => {
    setAnchorPos(null);
    setConfirmingDelete(false);
  };

  // ---- FullCalendar callbacks -----------------------------------------
  const handleSelect = (selected) => {
    const calendarApi = selected.view.calendar;
    calendarApi.unselect();
    const point = { top: selected.jsEvent?.clientY ?? 200, left: selected.jsEvent?.clientX ?? 200 };
    openCreateAt(point, {
      allDay: selected.allDay,
      start: toInputValue(selected.startStr, selected.allDay),
      end: selected.endStr ? toInputValue(selected.endStr, selected.allDay) : "",
    });
  };

  const handleEventClick = (selected) => {
    const point = { top: selected.jsEvent?.clientY ?? 200, left: selected.jsEvent?.clientX ?? 200 };
    openEditAt(point, selected.event);
  };

  const openCreateFromButton = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    openCreateAt({ top: rect.bottom + 8, left: rect.left });
  };

  const openEditFromList = (e, event) => {
    const rect = e.currentTarget.getBoundingClientRect();
    openEditAt({ top: rect.top, left: rect.right + 12 }, {
      id: event.id,
      title: event.title,
      allDay: event.allDay,
      startStr: event.start,
      endStr: event.end,
      extendedProps: { category: event.category },
    });
  };

  // Drag / resize persistence — this is what was missing before: editable
  // was already true, but nothing ever wrote the new time back to the DB.
  const persistEventChange = async (changeInfo) => {
    const { event, revert } = changeInfo;
    try {
      const response = await fetch(`/api/calendar/${event.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: event.title,
          start: event.startStr,
          end: event.endStr || null,
          allDay: event.allDay,
          // Always resend category — the backend defaults missing category
          // to "general", so omitting it here would silently wipe it.
          category: event.extendedProps?.category || "general",
        }),
      });
      if (!response.ok) throw new Error("Update failed");
      setCurrentEvents((prev) =>
        prev.map((e) =>
          e.id === event.id
            ? { ...e, start: event.startStr, end: event.endStr, allDay: event.allDay }
            : e
        )
      );
    } catch (error) {
      console.error("Error updating event:", error);
      revert();
      setLoadError("Couldn't save that change — the event was moved back.");
    }
  };

  // ---- Save (create or edit) -------------------------------------------
  const handleSave = async () => {
    if (!draft.title.trim()) {
      setSaveError("Give the event a title.");
      return;
    }
    setSaving(true);
    setSaveError(null);

    const payload = {
      id: draft.id || generateId(),
      title: draft.title.trim(),
      category: draft.category,
      allDay: draft.allDay,
      start: draft.allDay ? draft.start : new Date(draft.start).toISOString(),
      end: draft.end ? (draft.allDay ? draft.end : new Date(draft.end).toISOString()) : null,
    };

    try {
      if (mode === "create") {
        const response = await fetch("/api/calendar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!response.ok) throw new Error("Couldn't save the event.");
        const saved = await response.json();
        setCurrentEvents((prev) => [...prev, saved?.id ? saved : payload]);
      } else {
        const response = await fetch(`/api/calendar/${payload.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!response.ok) throw new Error("Couldn't save the event.");
        setCurrentEvents((prev) =>
          prev.map((e) => (e.id === payload.id ? { ...e, ...payload } : e))
        );
      }
      closePopover();
    } catch (error) {
      console.error("Error saving event:", error);
      setSaveError(error.message || "Couldn't save the event.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(`/api/calendar/${draft.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Couldn't delete the event.");
      setCurrentEvents((prev) => prev.filter((e) => e.id !== draft.id));
      closePopover();
    } catch (error) {
      console.error("Error deleting event:", error);
      setSaveError(error.message || "Couldn't delete the event.");
    } finally {
      setSaving(false);
    }
  };

  // ---- Sidebar list: sorted, colored ------------------------------------
  const upcoming = useMemo(
    () =>
      [...currentEvents]
        .filter((e) => e.start)
        .sort((a, b) => new Date(a.start) - new Date(b.start)),
    [currentEvents]
  );

  const eventDidMount = (info) => {
    const cat = categoryOf(info.event.extendedProps?.category);
    info.el.style.backgroundColor = isDark ? `${cat.color}33` : `${cat.color}22`;
    info.el.style.borderColor = cat.color;
    info.el.style.color = colors.grey[100];
    const dot = info.el.querySelector(".fc-daygrid-event-dot");
    if (dot) dot.style.borderColor = cat.color;
  };

  return (
    <Box m="20px">
      <Box display="flex" alignItems="center" justifyContent="space-between" mb="16px">
        <Box>
          <Typography variant="h3" fontWeight="600">
            Calendar
          </Typography>
          <Typography variant="body2" color={colors.grey[300]}>
            Click a date to add something, drag an event to reschedule it.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddRoundedIcon />}
          onClick={openCreateFromButton}
          sx={{
            borderRadius: "999px",
            textTransform: "none",
            fontWeight: 600,
            backgroundColor: colors.greenAccent[500],
            color: colors.grey[900],
            "&:hover": { backgroundColor: colors.greenAccent[600] },
          }}
        >
          New event
        </Button>
      </Box>

      {loadError && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: "10px" }} onClose={() => setLoadError(null)}>
          {loadError}
        </Alert>
      )}

      <Box display="flex" flexDirection={{ xs: "column", md: "row" }} gap="15px">
        {/* SIDEBAR */}
        <Box
          flex={{ xs: "1 1 auto", md: "1 1 26%" }}
          backgroundColor={colors.primary[400]}
          p="16px"
          borderRadius="14px"
          sx={{ boxShadow: isDark ? "0 1px 0 rgba(255,255,255,0.04)" : "0 1px 3px rgba(0,0,0,0.06)" }}
        >
          <Typography variant="h5" fontWeight="600" mb="10px">
            Events
          </Typography>

          {loading ? (
            <Typography variant="body2" color={colors.grey[300]}>
              Loading…
            </Typography>
          ) : upcoming.length === 0 ? (
            <Box textAlign="center" py="24px">
              <Typography variant="body2" color={colors.grey[300]}>
                No events yet. Click a date, or use "New event" to add one.
              </Typography>
            </Box>
          ) : (
            <Box display="flex" flexDirection="column" gap="6px">
              {upcoming.map((event) => {
                const cat = categoryOf(event.category);
                return (
                  <Box
                    key={event.id}
                    onClick={(e) => openEditFromList(e, event)}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      p: "9px 10px",
                      borderRadius: "10px",
                      cursor: "pointer",
                      backgroundColor: "transparent",
                      transition: "background-color 120ms ease",
                      "&:hover": {
                        backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                      },
                    }}
                  >
                    <Box
                      sx={{
                        width: 9,
                        height: 9,
                        borderRadius: "50%",
                        backgroundColor: cat.color,
                        flexShrink: 0,
                      }}
                    />
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={600} noWrap>
                        {event.title}
                      </Typography>
                      <Typography variant="caption" color={colors.grey[300]}>
                        {new Date(event.start).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          ...(event.allDay ? {} : { hour: "numeric", minute: "2-digit" }),
                        })}
                      </Typography>
                    </Box>
                  </Box>
                );
              })}
            </Box>
          )}
        </Box>

        {/* CALENDAR */}
        <Box flex={{ xs: "1 1 auto", md: "1 1 74%" }} className="hd-calendar">
          <FullCalendar
            height="75vh"
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
            headerToolbar={{
              left: "prev,next today",
              center: "title",
              right: "dayGridMonth,timeGridWeek,timeGridDay,listMonth",
            }}
            initialView="dayGridMonth"
            editable={true}
            selectable={true}
            selectMirror={true}
            dayMaxEvents={true}
            select={handleSelect}
            eventClick={handleEventClick}
            eventDrop={persistEventChange}
            eventResize={persistEventChange}
            eventDidMount={eventDidMount}
            events={currentEvents}
          />
        </Box>
      </Box>

      {/* EVENT EDITOR POPOVER — replaces window.prompt()/confirm() with an
          inline, Apple-Calendar-style card anchored where you clicked. */}
      <Popover
        open={popoverOpen}
        onClose={closePopover}
        anchorReference="anchorPosition"
        anchorPosition={anchorPos || { top: 0, left: 0 }}
        anchorOrigin={{ vertical: "top", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        PaperProps={{
          sx: {
            borderRadius: "16px",
            width: 320,
            p: "16px",
            backgroundColor: colors.primary[400],
            boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
          },
        }}
      >
        <Box display="flex" alignItems="center" justifyContent="space-between" mb="8px">
          <Typography variant="subtitle1" fontWeight={700}>
            {mode === "create" ? "New event" : "Edit event"}
          </Typography>
          <IconButton size="small" onClick={closePopover}>
            <CloseRoundedIcon fontSize="small" />
          </IconButton>
        </Box>

        <TextField
          autoFocus
          fullWidth
          placeholder="Title"
          value={draft.title}
          onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
          size="small"
          sx={{ mb: "10px" }}
        />

        {/* Category swatches */}
        <Box display="flex" gap="8px" mb="12px">
          {CATEGORIES.map((cat) => (
            <Box
              key={cat.key}
              onClick={() => setDraft((d) => ({ ...d, category: cat.key }))}
              title={cat.label}
              sx={{
                width: 22,
                height: 22,
                borderRadius: "50%",
                backgroundColor: cat.color,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: draft.category === cat.key ? "2px solid white" : "2px solid transparent",
                boxShadow: draft.category === cat.key ? `0 0 0 2px ${cat.color}` : "none",
              }}
            >
              {draft.category === cat.key && (
                <CheckRoundedIcon sx={{ fontSize: 14, color: "#fff" }} />
              )}
            </Box>
          ))}
        </Box>

        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={draft.allDay}
              onChange={(e) => {
                const allDay = e.target.checked;
                setDraft((d) => ({
                  ...d,
                  allDay,
                  start: toInputValue(
                    d.start.length === 10 ? `${d.start}T09:00` : d.start,
                    allDay
                  ),
                  end: d.end
                    ? toInputValue(d.end.length === 10 ? `${d.end}T10:00` : d.end, allDay)
                    : "",
                }));
              }}
            />
          }
          label={<Typography variant="body2">All day</Typography>}
          sx={{ mb: "8px" }}
        />

        <TextField
          fullWidth
          size="small"
          type={draft.allDay ? "date" : "datetime-local"}
          label="Starts"
          InputLabelProps={{ shrink: true }}
          value={draft.start}
          onChange={(e) => setDraft((d) => ({ ...d, start: e.target.value }))}
          sx={{ mb: "10px" }}
        />
        <TextField
          fullWidth
          size="small"
          type={draft.allDay ? "date" : "datetime-local"}
          label="Ends (optional)"
          InputLabelProps={{ shrink: true }}
          value={draft.end}
          onChange={(e) => setDraft((d) => ({ ...d, end: e.target.value }))}
          sx={{ mb: "12px" }}
        />

        {saveError && (
          <Alert severity="error" sx={{ mb: "10px", borderRadius: "8px" }}>
            {saveError}
          </Alert>
        )}

        <Divider sx={{ mb: "12px", opacity: 0.2 }} />

        <Box display="flex" alignItems="center" justifyContent="space-between">
          {mode === "edit" ? (
            <Button
              size="small"
              onClick={handleDelete}
              disabled={saving}
              color={confirmingDelete ? "error" : "inherit"}
              startIcon={<DeleteOutlineRoundedIcon fontSize="small" />}
              sx={{ textTransform: "none", fontWeight: 600 }}
            >
              {confirmingDelete ? "Confirm delete" : "Delete"}
            </Button>
          ) : (
            <span />
          )}
          <Button
            variant="contained"
            size="small"
            disabled={saving}
            onClick={handleSave}
            sx={{
              textTransform: "none",
              fontWeight: 700,
              borderRadius: "999px",
              px: "18px",
              backgroundColor: colors.greenAccent[500],
              color: colors.grey[900],
              "&:hover": { backgroundColor: colors.greenAccent[600] },
            }}
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        </Box>
      </Popover>

      {/* Scoped visual polish for FullCalendar's own DOM (it isn't MUI, so
          it needs plain CSS rather than the theme/sx system). */}
      <style>{`
        .hd-calendar .fc {
          --fc-border-color: ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"};
          --fc-today-bg-color: ${isDark ? "rgba(76,206,172,0.08)" : "rgba(76,206,172,0.12)"};
          --fc-page-bg-color: transparent;
        }
        .hd-calendar .fc-toolbar-title {
          font-weight: 700;
          font-size: 20px;
        }
        .hd-calendar .fc-button {
          text-transform: capitalize;
          border-radius: 999px !important;
          border: none !important;
          background: ${isDark ? colors.primary[400] : "#eceff3"} !important;
          color: ${colors.grey[100]} !important;
          box-shadow: none !important;
          padding: 6px 14px !important;
        }
        .hd-calendar .fc-button-active,
        .hd-calendar .fc-button:hover {
          background: ${colors.greenAccent[500]} !important;
          color: ${colors.grey[900]} !important;
        }
        .hd-calendar .fc-daygrid-day-number,
        .hd-calendar .fc-col-header-cell-cushion {
          color: ${colors.grey[200]};
          text-decoration: none;
        }
        .hd-calendar .fc-event {
          border-radius: 8px;
          border-width: 1px;
          padding: 1px 6px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: transform 100ms ease, box-shadow 100ms ease;
        }
        .hd-calendar .fc-event:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 10px rgba(0,0,0,0.18);
        }
        .hd-calendar .fc-daygrid-day.fc-day-today {
          border-radius: 8px;
        }
      `}</style>
    </Box>
  );
};

export default Calendar;