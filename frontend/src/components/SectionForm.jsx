import { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  MenuItem,
  TextField,
  useTheme,
} from '@mui/material';
import { tokens } from '../theme';
import sectionFields from '../config/sectionFields';

// Fetch source registry for "asyncSelect" fields — keyed by field.source.
// Mirrors the fetch pattern already used in scenes/digiLocker/digiLocker.jsx
// for the same /api/family-members endpoint.
const ASYNC_OPTION_SOURCES = {
  familyMembers: () =>
    fetch('/api/family-members', { credentials: 'include' })
      .then((res) =>
        res.ok ? res.json() : Promise.reject(new Error('Failed to load family members'))
      )
      .then((rows) =>
        (rows || []).map((m) => ({
          value: String(m.id),
          label: [m.first_name, m.last_name].filter(Boolean).join(' '),
        }))
      ),
};

// A field can depend on other field(s) being set to a particular value —
// used to show/hide category-specific inputs (e.g. only show "License Plate"
// when category === "insurance" && subcategory === "auto"). `dependsOn` can
// be a single condition or an array of conditions (all must match).
// Condition shape: { field: "category", value: "insurance" } or
// { field: "category", in: ["insurance", "subscription"] }.
const isFieldVisible = (field, values) => {
  if (!field.dependsOn) return true;
  const conditions = Array.isArray(field.dependsOn) ? field.dependsOn : [field.dependsOn];
  return conditions.every((cond) => {
    const current = values[cond.field];
    if (cond.in) return cond.in.includes(current);
    return current === cond.value;
  });
};

// `options` on a select field can be a static array or a function of the
// current form values (e.g. subcategory options that depend on category).
const resolveOptions = (field, values) =>
  typeof field.options === 'function' ? field.options(values) || [] : field.options || [];

/**
 * One reusable form for every Home Dashboard section. Which inputs render,
 * which are required, and where the data ends up are all driven by
 * config/sectionFields.js — this component has no per-section logic.
 *
 * Two config options beyond the basics support category-driven sections
 * like Renewals: `dependsOn` (conditionally show a field) and `packInto`
 * (group a set of fields into one nested JSON object on submit, e.g. all
 * category-specific fields collapse into `attributes`).
 *
 * By default the fields rendered are `sectionFields[sectionKey].fields`
 * (the quick-add set). Pass `fieldsOverride` to render a different list
 * against the same section — e.g. SectionDetailView.jsx passes
 * `[...config.fields, ...config.detailFields]` so a "View all" page can
 * edit every column without a separate hand-built form.
 */
const SectionForm = ({ sectionKey, initialValues, onSubmit, onCancel, fieldsOverride }) => {
  const theme = useTheme();
  const colors = tokens(theme.palette.mode);

  // Every field's focused label/border used to fall back to
  // theme.palette.primary.main, which is a near-black navy — almost the
  // same color as the form's own background, so labels/outlines basically
  // disappeared the moment you focused a field. Force a bright accent for
  // the focused state, and explicit light text/label colors so nothing
  // blends into the dark form background at any time.
  const fieldSx = {
    '& .MuiInputBase-input': {
      color: colors.grey[100],
      // Mobile Safari/Chrome auto-zoom the whole page when a focused input's
      // font-size is under 16px — that's what was throwing the layout off
      // the moment you tapped a field. 16px on small screens disables that
      // browser zoom; desktop keeps the smaller size the rest of the app uses.
      fontSize: { xs: '16px', sm: '0.875rem' },
    },
    '& .MuiInputLabel-root': { color: colors.grey[300] },
    '& .MuiInputLabel-root.Mui-focused': { color: colors.blueAccent[300] },
    '& .MuiOutlinedInput-root': {
      '& fieldset': { borderColor: colors.grey[600] },
      '&:hover fieldset': { borderColor: colors.grey[400] },
      '&.Mui-focused fieldset': { borderColor: colors.blueAccent[300] },
    },
    '& .MuiSvgIcon-root': { color: colors.grey[300] },
  };

  // Shared styling for every <TextField select> dropdown menu so it matches
  // the form's own palette (rounded corners, same dark background instead
  // of MUI's default paper) and anchors directly under the field instead of
  // drifting to the left edge of the screen.
  const selectMenuProps = {
    PaperProps: {
      sx: {
        bgcolor: colors.primary[400],
        backgroundImage: 'none',
        borderRadius: '12px',
        mt: '4px',
        border: `1px solid ${colors.grey[700]}`,
      },
    },
    anchorOrigin: { vertical: 'bottom', horizontal: 'left' },
    transformOrigin: { vertical: 'top', horizontal: 'left' },
  };

  const config = sectionFields[sectionKey];
  const fields = fieldsOverride || (config && config.fields) || [];
  const isEditing = Boolean(initialValues);
  const [values, setValues] = useState(initialValues || {});
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [asyncOptions, setAsyncOptions] = useState({});
  const [submitError, setSubmitError] = useState(null);

  // Re-seed local form state whenever the record being edited changes (e.g.
  // switching from "add" to editing a specific row, or between rows).
  useEffect(() => {
    if (!initialValues || !config) {
      setValues(initialValues || {});
      return;
    }
    const seeded = { ...initialValues };
    for (const field of fields) {
      if (
        (field.type === 'select' || field.type === 'asyncSelect') &&
        seeded[field.name] !== undefined &&
        seeded[field.name] !== null
      ) {
        // Raw DB values (e.g. family_member_id) come back as numbers; option
        // values are strings, so an un-coerced value won't match and the
        // select will render blank even though the record has a value.
        seeded[field.name] = String(seeded[field.name]);
      }
    }
    setValues(seeded);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialValues, sectionKey]);

  useEffect(() => {
    if (!fields.length) return;
    fields
      .filter((field) => field.type === 'asyncSelect' && field.source)
      .forEach((field) => {
        const load = ASYNC_OPTION_SOURCES[field.source];
        if (!load) return;
        load()
          .then((opts) => setAsyncOptions((prev) => ({ ...prev, [field.name]: opts })))
          .catch(() => setAsyncOptions((prev) => ({ ...prev, [field.name]: [] })));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionKey, fieldsOverride]);

  if (!config && !fieldsOverride) return null;

  const handleChange = (name) => (e) => {
    setValues((prev) => ({ ...prev, [name]: e.target.value }));
  };

  const handleCheckboxChange = (name) => (e) => {
    setValues((prev) => ({ ...prev, [name]: e.target.checked ? 1 : 0 }));
  };

  const validate = () => {
    const nextErrors = {};
    for (const field of fields) {
      if (!isFieldVisible(field, values)) continue;
      if (field.required && !values[field.name]) {
        nextErrors[field.name] = `${field.label} is required`;
      }
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  // Fields with `packInto: "attributes"` collapse into a single nested
  // object under that key (only currently-visible ones), everything else
  // is sent flat. Hidden fields (e.g. attribute inputs for a category the
  // user didn't pick) are dropped entirely rather than sent as stale values.
  const buildPayload = () => {
    const payload = {};
    for (const field of fields) {
      if (!isFieldVisible(field, values) || field.readOnly) continue;
      const value = values[field.name];
      if (value === undefined || value === '') continue;
      if (field.packInto) {
        payload[field.packInto] = { ...(payload[field.packInto] || {}), [field.name]: value };
      } else {
        payload[field.name] = value;
      }
    }
    return payload;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await onSubmit(sectionKey, buildPayload());
      setValues({});
    } catch (err) {
      setSubmitError(err.message || 'Something went wrong saving this — please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit} display="flex" flexDirection="column" gap="16px">
      {fields.map((field) => {
        if (!isFieldVisible(field, values)) return null;

        const common = {
          key: field.name,
          label: field.label,
          value: values[field.name] ?? '',
          onChange: handleChange(field.name),
          error: Boolean(errors[field.name]),
          helperText: errors[field.name],
          fullWidth: true,
          disabled: Boolean(field.readOnly),
          sx: fieldSx,
        };

        if (field.type === 'select') {
          return (
            <TextField {...common} select SelectProps={{ MenuProps: selectMenuProps }}>
              {resolveOptions(field, values).map((opt) => {
                const optValue = typeof opt === 'object' ? opt.value : opt;
                const optLabel = typeof opt === 'object' ? opt.label : opt;
                return (
                  <MenuItem key={optValue} value={optValue}>
                    {optLabel}
                  </MenuItem>
                );
              })}
            </TextField>
          );
        }

        if (field.type === 'asyncSelect') {
          const opts = asyncOptions[field.name] || [];
          return (
            <TextField
              {...common}
              select
              disabled={opts.length === 0}
              SelectProps={{ MenuProps: selectMenuProps }}
            >
              {opts.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </TextField>
          );
        }

        if (field.type === 'checkbox') {
          return (
            <FormControlLabel
              key={field.name}
              control={
                <Checkbox
                  checked={Boolean(values[field.name])}
                  onChange={handleCheckboxChange(field.name)}
                />
              }
              label={field.label}
            />
          );
        }

        if (field.type === 'textarea') {
          return <TextField {...common} multiline minRows={3} />;
        }

        if (field.type === 'date') {
          return <TextField {...common} type="date" InputLabelProps={{ shrink: true }} />;
        }

        if (field.type === 'time') {
          return <TextField {...common} type="time" InputLabelProps={{ shrink: true }} />;
        }

        if (field.type === 'number') {
          return <TextField {...common} type="number" />;
        }

        return <TextField {...common} type="text" />;
      })}

      {submitError && <Box sx={{ color: 'error.main', fontSize: '0.85rem' }}>{submitError}</Box>}

      <Box display="flex" gap="10px" justifyContent="flex-end">
        {onCancel && (
          <Button
            onClick={onCancel}
            disabled={submitting}
            variant="outlined"
            sx={{
              color: colors.grey[100],
              borderColor: colors.grey[500],
              '&:hover': {
                borderColor: colors.grey[300],
                backgroundColor: colors.primary[500],
              },
            }}
          >
            Cancel
          </Button>
        )}
        <Button type="submit" variant="contained" disabled={submitting}>
          {submitting ? 'Saving...' : isEditing ? 'Update' : 'Save'}
        </Button>
      </Box>
    </Box>
  );
};

export default SectionForm;
