import { useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { formatDay } from '../utils/formatDay';

const CHOICES = [
  { value: 'cooked', label: 'Cooked', color: 'success' },
  { value: 'skipped', label: 'Skipped', color: 'error' },
  { value: 'away', label: 'Away', color: 'info' },
];
const SLOT_LABELS = {
  kids_tiffin: 'Kids tiffin',
  adult_tiffin: 'Adult tiffin',
  weekend_lunch: 'Lunch',
  dinner: 'Dinner',
};

function mealName(meal) {
  const slot = SLOT_LABELS[meal.meal_slot] || meal.meal_slot;
  return meal.tiffin_kid_slot ? `${slot} (${meal.tiffin_kid_slot})` : slot;
}

// "You haven't confirmed the last N days - what happened?" (spec 6.4 step 3).
// Answers write to the same meal log as the push flow.
export default function CatchUpDialog({ meals, saving, onClose, onSubmit }) {
  const [choices, setChoices] = useState({});
  const days = [...new Set(meals.map((meal) => meal.meal_date))];
  const answeredCount = Object.keys(choices).length;

  const setChoice = (planId, choice) => setChoices((current) => {
    const next = { ...current };
    if (choice) next[planId] = choice;
    else delete next[planId];
    return next;
  });
  const setAll = (choice) => setChoices(Object.fromEntries(meals.map((meal) => [meal.id, choice])));

  const submit = () => onSubmit(
    Object.entries(choices).map(([planId, response]) => ({ planId: Number(planId), response })),
  );

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs" scroll="paper">
      <DialogTitle>
        You haven&apos;t confirmed the last {days.length} {days.length === 1 ? 'day' : 'days'} — what happened?
      </DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 1 }}>
          <Typography variant="caption" color="text.secondary">Set all:</Typography>
          {CHOICES.map((choice) => (
            <Button
              key={choice.value}
              size="small"
              color={choice.color}
              variant="outlined"
              onClick={() => setAll(choice.value)}
              sx={{ textTransform: 'none', minWidth: 0 }}
            >
              {choice.label}
            </Button>
          ))}
        </Box>
        {days.map((day) => (
          <Box key={day} sx={{ mt: 1.5 }}>
            <Typography variant="subtitle2" fontWeight={700}>{formatDay(day)}</Typography>
            <Divider sx={{ mb: 0.5 }} />
            {meals.filter((meal) => meal.meal_date === day).map((meal) => (
              <Box key={meal.id} sx={{ py: 0.75 }}>
                <Typography variant="body2">
                  {meal.recipe_name} <Typography component="span" variant="caption" color="text.secondary">· {mealName(meal)}</Typography>
                </Typography>
                <ToggleButtonGroup
                  exclusive
                  size="small"
                  value={choices[meal.id] ?? null}
                  onChange={(_event, next) => setChoice(meal.id, next)}
                  aria-label={`What happened to ${meal.recipe_name} on ${formatDay(day)}`}
                  sx={{ mt: 0.5 }}
                >
                  {CHOICES.map((choice) => (
                    <ToggleButton
                      key={choice.value}
                      value={choice.value}
                      color={choice.color}
                      sx={{ textTransform: 'none', px: 1.5, py: 0.25 }}
                    >
                      {choice.label}
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>
              </Box>
            ))}
          </Box>
        ))}
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
          Cooked uses up the ingredients. Skipped and Away leave inventory alone; Away also
          excludes that day when the planner avoids repeats.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button onClick={onClose}>Later</Button>
        <Button variant="contained" onClick={submit} disabled={saving || answeredCount === 0}>
          Save {answeredCount > 0 ? `(${answeredCount})` : ''}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
