import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Grid,
  IconButton,
  Menu,
  MenuItem,
  Snackbar,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import RestaurantMenuOutlinedIcon from '@mui/icons-material/RestaurantMenuOutlined';
import { useLocation } from 'react-router-dom';
import { tokens } from '../theme';
import { api } from '../services/api';
import BottomNav, { BOTTOM_NAV_HEIGHT } from '../scenes/global/BottomNav';
import PlannerSettingsPage from './PlannerSettingsPage';
import PlannerTopbar from './PlannerTopbar';
import InventoryPage from './InventoryPage';
import CatchUpDialog from './CatchUpDialog';
import AttentionCard from './AttentionCard';

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MEALS = ['Kids Tiffin', 'Lunch', 'Dinner'];
const MEAL_SLOTS = [
  { label: 'Kids Tiffin', value: 'kids_tiffin' },
  { label: 'Adult Tiffin', value: 'adult_tiffin' },
  { label: 'Lunch', value: 'weekend_lunch' },
  { label: 'Dinner', value: 'dinner' },
  { label: 'Sides', value: 'sides' }, 
  { label: 'Guest Special', value: 'guest_special' },
];

function localDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getMonday(date) {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const daysSinceMonday = (monday.getDay() + 6) % 7;
  monday.setDate(monday.getDate() - daysSinceMonday);
  return localDate(monday);
}

function offsetDate(date, offset) {
  const result = new Date(`${date}T00:00:00`);
  result.setDate(result.getDate() + offset);
  return localDate(result);
}

function mealLabel(slot) {
  return MEAL_SLOTS.find((meal) => meal.value === slot)?.label || slot;
}

function planStatusLabel(status) {
  if (status === 'confirmed_cooked') return 'Cooked';
  if (status === 'confirmed_skipped') return 'Skipped';
  if (status === 'other') return 'Other';
  return status.replaceAll('_', ' ');
}

function statusColor(status) {
  if (status === 'confirmed_cooked') return 'success';
  if (status === 'confirmed_skipped') return 'error';
  return 'info';
}

function DayCard({ day, meals, dalSuggestion, pairedVegetable, colors, onConfirm, onPlanDal }) {
  const mealLabels = meals['Adult Tiffin'] ? [...MEALS.slice(0, 1), 'Adult Tiffin', ...MEALS.slice(1)] : MEALS;
  return (
    <Card
      elevation={0}
      sx={{
        height: '100%',
        overflow: 'hidden',
        borderRadius: '16px',
        bgcolor: colors.primary[400],
        color: colors.grey[100],
      }}
    >
      <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
        <Box sx={{ borderBottom: `3px solid ${colors.primary[500]}`, pb: 1.25, mb: 0.5 }}>
          <Typography variant="h5" fontWeight={600} color={colors.grey[100]}>
            {day}
          </Typography>
          {/* <Typography variant="overline" color={colors.grey[500]}>
            Menu
          </Typography> */}
        </Box>
        {mealLabels.map((meal, index) => (
          <Box key={meal}>
            {index > 0 && <Divider sx={{ borderColor: colors.primary[500] }} />}
            <Box sx={{ py: 1.25 }}>
              <Typography variant="h5" fontWeight={700} color={colors.greenAccent[500]}>
                {meal}
              </Typography>
              {meals[meal].length > 0 ? meals[meal].map((entry) => (
                <Box key={entry.id} sx={{ mt: 0.75 }}>
                  <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
                    {entry.name}
                  </Typography>
                  {entry.status !== 'planned' ? (
                    <Chip
                      size="small"
                      color={statusColor(entry.status)}
                      label={planStatusLabel(entry.status)}
                      sx={{ mt: 0.5, fontWeight: 700 }}
                    />
                  ) : (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                      {(['Kids Tiffin', 'Lunch', 'Dinner'].includes(meal)
                        ? [['no', 'Skipped']]
                        : [['yes', 'Cooked'], ['no', 'Skipped'], ['other', 'Other']]
                      ).map(([response, label]) => (
                        <Button
                          key={response}
                          size="small"
                          variant={response === 'yes' ? 'contained' : 'outlined'}
                          color={response === 'yes' ? 'success' : response === 'no' ? 'error' : 'info'}
                          onClick={() => onConfirm(entry.id, response)}
                          sx={{
                            minWidth: 0,
                            px: 1,
                            fontWeight: 700,
                            textTransform: 'none',
                            ...(response === 'no' ? { borderWidth: 1.5 } : {}),
                          }}
                        >
                          {label}
                        </Button>
                      ))}
                    </Box>
                  )}
                </Box>
              )) : (
                <Typography variant="body2" color={colors.grey[600]} sx={{ mt: 0.5, fontStyle: 'italic' }}>
                  No recipe planned
                </Typography>
              )}
              {meal === 'Dinner' && dalSuggestion && (
                <Box sx={{ mt: 1, p: 1, borderRadius: 2, bgcolor: 'action.hover' }}>
                  <Typography variant="body2">
                    Dal side suggestion: <strong>{dalSuggestion.name}</strong>
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block">
                    Serve with {pairedVegetable || 'a vegetable dish'}.
                  </Typography>
                  <Button
                    size="small"
                    onClick={() => onPlanDal(dalSuggestion.recipeId, dalSuggestion.mealDate)}
                    sx={{ mt: 0.5, px: 0, textTransform: 'none' }}
                  >
                    Add dal side to plan
                  </Button>
                </Box>
              )}
            </Box>
          </Box>
        ))}
      </CardContent>
    </Card>
  );
}

export default function RecipePlannerPage() {
  const location = useLocation();
  const theme = useTheme();
  const colors = tokens(theme.palette.mode);
  const view = location.pathname === '/settings' ? 'settings' : location.pathname === '/inventory' ? 'inventory' : 'home';
  const weekStart = useMemo(() => getMonday(new Date()), []);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pageError, setPageError] = useState('');
  const [addMenuAnchor, setAddMenuAnchor] = useState(null);
  const [recipeDialogOpen, setRecipeDialogOpen] = useState(false);
  const [recipeId, setRecipeId] = useState('');
  const [recipeDate, setRecipeDate] = useState(weekStart);
  const [recipeMeal, setRecipeMeal] = useState('dinner');
  const [groceryDialogOpen, setGroceryDialogOpen] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState([]);
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);
  const [selectedStageIds, setSelectedStageIds] = useState([]);
  const [purchaseDate, setPurchaseDate] = useState(localDate(new Date()));
  const [store, setStore] = useState('');
  const [receiptPhoto, setReceiptPhoto] = useState(null);
  const [notice, setNotice] = useState('');
  // 'auto' opens the catch-up prompt on app open; 'closed' after Later/Save.
  const [catchUpMode, setCatchUpMode] = useState('auto');
  const photoInputRef = useRef(null);

  useEffect(() => () => {
    if (receiptPhoto?.url) URL.revokeObjectURL(receiptPhoto.url);
  }, [receiptPhoto]);

  const fetchDashboard = useCallback(async () => {
    const today = localDate(new Date());
    const { data } = await api.get(
      `/food?weekStart=${encodeURIComponent(weekStart)}&today=${encodeURIComponent(today)}`,
    );
    return data;
  }, [weekStart]);

  const refreshDashboard = useCallback(async () => {
    setLoading(true);
    try {
      setDashboard(await fetchDashboard());
      setPageError('');
    } catch (error) {
      setPageError(error.message || 'Could not load the household food data.');
    } finally {
      setLoading(false);
    }
  }, [fetchDashboard]);

  useEffect(() => {
    let isCurrentRequest = true;
    fetchDashboard()
      .then((data) => {
        if (isCurrentRequest) {
          setDashboard(data);
          setPageError('');
        }
      })
      .catch((error) => {
        if (isCurrentRequest) setPageError(error.message || 'Could not load the household food data.');
      })
      .finally(() => {
        if (isCurrentRequest) setLoading(false);
      });
    return () => {
      isCurrentRequest = false;
    };
  }, [fetchDashboard]);

  const closeAddMenu = () => setAddMenuAnchor(null);
  const pendingPurchaseCount = dashboard?.groceryStage.length ?? 0;
  const unconfirmedMeals = dashboard?.unconfirmed || [];
  const catchUpOpen = view === 'home'
    && unconfirmedMeals.length > 0
    && (catchUpMode === 'open' || catchUpMode === 'auto');

  // Mirror "needs attention" on the installed app's home-screen icon where the
  // browser supports it (a no-op elsewhere).
  const attentionCount = pendingPurchaseCount + unconfirmedMeals.length;
  useEffect(() => {
    if (!dashboard || !('setAppBadge' in navigator)) return;
    const update = attentionCount > 0 ? navigator.setAppBadge(attentionCount) : navigator.clearAppBadge();
    update?.catch(() => {});
  }, [dashboard, attentionCount]);
  const recommendations = dashboard?.recommendations || [];
  const selectedRecipes = recommendations.filter((recipe) => {
    if (recipeMeal === 'kids_tiffin') return recipe.suitableForKidsTiffin;
    if (recipeMeal === 'adult_tiffin') return recipe.suitableForAdultTiffin;
    if (recipeMeal === 'dinner') return recipe.suitableForAdultDinner;
    return true;
  });

  const openRecipeDialog = (suggestedRecipeId = '') => {
    setRecipeId(suggestedRecipeId ? String(suggestedRecipeId) : '');
    setRecipeDate(weekStart);
    setRecipeMeal('dinner');
    setRecipeDialogOpen(true);
  };

  const addRecipe = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await api.post('/food/plan', {
        recipeId: Number(recipeId),
        mealDate: recipeDate,
        mealSlot: recipeMeal,
      });
      setRecipeDialogOpen(false);
      await refreshDashboard();
    } catch (error) {
      setPageError(error.message || 'Could not add this recipe to the plan.');
    } finally {
      setSaving(false);
    }
  };

  const stageGroceries = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await api.post('/food/groceries/stage', { itemIds: selectedItemIds });
      setGroceryDialogOpen(false);
      setSelectedItemIds([]);
      await refreshDashboard();
    } catch (error) {
      setPageError(error.message || 'Could not add these vegetables to the grocery list.');
    } finally {
      setSaving(false);
    }
  };

  const openPurchaseDialog = () => {
    setSelectedStageIds((dashboard?.groceryStage || []).map((item) => item.id));
    setPurchaseDate(localDate(new Date()));
    setPurchaseDialogOpen(true);
  };

  const confirmPurchases = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await api.post('/food/groceries/confirm', { stageIds: selectedStageIds, purchaseDate, store });
      setPurchaseDialogOpen(false);
      setStore('');
      await refreshDashboard();
    } catch (error) {
      setPageError(error.message || 'Could not confirm these purchases.');
    } finally {
      setSaving(false);
    }
  };

  const confirmMeal = async (planId, response) => {
    setSaving(true);
    try {
      await api.post(`/food/plan/${planId}/confirm`, { response });
      await refreshDashboard();
    } catch (error) {
      setPageError(error.message || 'Could not save the meal confirmation.');
    } finally {
      setSaving(false);
    }
  };

  const submitCatchUp = async (responses) => {
    setSaving(true);
    try {
      await api.post('/food/catchup', { responses });
      setCatchUpMode('closed');
      await refreshDashboard();
    } catch (error) {
      setPageError(error.message || 'Could not save the catch-up answers.');
    } finally {
      setSaving(false);
    }
  };

  const generatePlan = async () => {
    const { data } = await api.post('/food/plan/generate', { weekStart, today: localDate(new Date()) });
    await refreshDashboard();
    return data;
  };

  // The Confirm icon only has work to do while groceries are waiting.
  const handleConfirmClick = () => {
    if (pendingPurchaseCount === 0) {
      setNotice('Nothing is waiting to be confirmed. Add vegetables to the grocery list first.');
      return;
    }
    openPurchaseDialog();
  };

  const planDalSide = async (suggestedRecipeId, mealDate) => {
    setSaving(true);
    try {
      await api.post('/food/plan', {
        recipeId: suggestedRecipeId,
        mealDate,
        mealSlot: 'dinner',
      });
      await refreshDashboard();
    } catch (error) {
      setPageError(error.message || 'Could not add the dal side to the plan.');
    } finally {
      setSaving(false);
    }
  };

  const chooseReceiptPhoto = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setReceiptPhoto({ name: file.name, url: URL.createObjectURL(file) });
    event.target.value = '';
  };

  const cardMeals = (date) => {
    const meals = Object.fromEntries(MEALS.map((meal) => [meal, []]));
    (dashboard?.plan || [])
      .filter((entry) => entry.meal_date === date)
      .forEach((entry) => {
        const label = mealLabel(entry.meal_slot);
        if (!meals[label]) meals[label] = [];
        meals[label].push({
          id: entry.id,
          name: entry.tiffin_kid_slot ? `${entry.recipe_name} (${entry.tiffin_kid_slot})` : entry.recipe_name,
          status: entry.status,
        });
      });
    return meals;
  };

  const dalSuggestionFor = (date) => {
    if (dashboard?.plan.some((entry) => (
      entry.meal_date === date && entry.meal_type === 'dal_side' && entry.meal_slot === 'dinner'
    ))) {
      return null;
    }
    return dashboard?.dalSuggestions.find((suggestion) => suggestion.mealDate === date) || null;
  };

  const pairedVegetableFor = (date) => {
    const plannedVegetable = dashboard?.plan.find((entry) => (
      entry.meal_date === date
      && entry.meal_slot === 'dinner'
      && entry.meal_type !== 'dal_side'
    ));
    if (plannedVegetable) return plannedVegetable.recipe_name;
    return recommendations.find((recipe) => recipe.suitableForAdultDinner)?.name || '';
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <PlannerTopbar />

      <Menu id="add-menu" anchorEl={addMenuAnchor} open={Boolean(addMenuAnchor)} onClose={closeAddMenu}>
        <MenuItem onClick={() => {
          closeAddMenu();
          openRecipeDialog();
        }}>
          <RestaurantMenuOutlinedIcon fontSize="small" sx={{ mr: 1.5 }} />
          Add approved recipe to plan
        </MenuItem>
        <MenuItem onClick={() => {
          closeAddMenu();
          photoInputRef.current?.click();
        }}>
          <ReceiptLongOutlinedIcon fontSize="small" sx={{ mr: 1.5 }} />
          Preview receipt photo
        </MenuItem>
      </Menu>
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={chooseReceiptPhoto}
      />

      <Box sx={{ maxWidth: 1200, mx: 'auto', px: { xs: 2, sm: 3 }, pt: 9, pb: 12 }}>
        {pageError && <Alert severity="error" onClose={() => setPageError('')} sx={{ mb: 2 }}>{pageError}</Alert>}
        {loading && <CircularProgress size={24} sx={{ mb: 2 }} />}
        {view === 'settings' && <PlannerSettingsPage onGeneratePlan={generatePlan} />}
        {view === 'inventory' && <InventoryPage />}
        {view === 'home' && (
          <AttentionCard
            unconfirmed={unconfirmedMeals}
            lookbackDays={dashboard?.catchupLookbackDays}
            pendingPurchaseCount={pendingPurchaseCount}
            onReview={() => setCatchUpMode('open')}
            onConfirmPurchases={openPurchaseDialog}
          />
        )}
        {view === 'home' && (
          <Grid container spacing={2}>
            {WEEKDAYS.map((day, index) => (
              <Grid key={day} size={{ xs: 12, sm: 6, lg: 4 }}>
                <DayCard
                  day={day}
                  meals={cardMeals(offsetDate(weekStart, index))}
                  dalSuggestion={dalSuggestionFor(offsetDate(weekStart, index))}
                  pairedVegetable={pairedVegetableFor(offsetDate(weekStart, index))}
                  colors={colors}
                  onConfirm={confirmMeal}
                  onPlanDal={planDalSide}
                />
              </Grid>
            ))}
          </Grid>
        )}
      </Box>

      <Dialog open={recipeDialogOpen} onClose={() => setRecipeDialogOpen(false)} fullWidth maxWidth="xs">
        <Box component="form" onSubmit={addRecipe}>
          <DialogTitle>Add approved recipe to the meal plan</DialogTitle>
          <DialogContent sx={{ display: 'grid', gap: 2, pt: '8px !important' }}>
            <TextField
              type="date"
              label="Date"
              value={recipeDate}
              onChange={(event) => setRecipeDate(event.target.value)}
              InputLabelProps={{ shrink: true }}
              inputProps={{ min: weekStart, max: offsetDate(weekStart, 6) }}
            />
            <TextField
              select
              label="Meal"
              value={recipeMeal}
              onChange={(event) => setRecipeMeal(event.target.value)}
            >
              {MEAL_SLOTS.map((meal) => <MenuItem key={meal.value} value={meal.value}>{meal.label}</MenuItem>)}
            </TextField>
            <TextField
              select
              required
              label="Approved recipe"
              value={recipeId}
              onChange={(event) => setRecipeId(event.target.value)}
            >
              {selectedRecipes.map((recipe) => (
                <MenuItem key={recipe.id} value={String(recipe.id)}>{recipe.name}</MenuItem>
              ))}
            </TextField>
            {!selectedRecipes.length && (
              <Typography variant="body2" color="text.secondary">
                No matching approved recipes are currently available for this meal.
              </Typography>
            )}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setRecipeDialogOpen(false)}>Cancel</Button>
            <Button
              type="submit"
              variant="contained"
              disabled={!recipeId || !selectedRecipes.some((recipe) => String(recipe.id) === recipeId) || saving}
            >
              Add recipe
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <Dialog open={groceryDialogOpen} onClose={() => setGroceryDialogOpen(false)} fullWidth maxWidth="xs">
        <Box component="form" onSubmit={stageGroceries}>
          <DialogTitle>Add fresh vegetables to the grocery list</DialogTitle>
          <DialogContent sx={{ display: 'grid', pt: '8px !important' }}>
            {(dashboard?.items || []).map((item) => (
              <FormControlLabel
                key={item.id}
                control={(
                  <Checkbox
                    checked={selectedItemIds.includes(item.id)}
                    onChange={(event) => setSelectedItemIds((current) => (
                      event.target.checked
                        ? [...current, item.id]
                        : current.filter((id) => id !== item.id)
                    ))}
                  />
                )}
                label={item.name}
              />
            ))}
            <Typography variant="caption" color="text.secondary">
              Only tracked fresh vegetables are listed; pantry staples stay out of inventory.
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setGroceryDialogOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={!selectedItemIds.length || saving}>
              Add selected
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <Dialog open={purchaseDialogOpen} onClose={() => setPurchaseDialogOpen(false)} fullWidth maxWidth="xs">
        <Box component="form" onSubmit={confirmPurchases}>
          <DialogTitle>Confirm purchased vegetables</DialogTitle>
          <DialogContent sx={{ display: 'grid', gap: 1, pt: '8px !important' }}>
            {dashboard?.groceryStage.map((item) => (
              <FormControlLabel
                key={item.id}
                control={(
                  <Checkbox
                    checked={selectedStageIds.includes(item.id)}
                    onChange={(event) => setSelectedStageIds((current) => (
                      event.target.checked
                        ? [...current, item.id]
                        : current.filter((id) => id !== item.id)
                    ))}
                  />
                )}
                label={item.item_name}
              />
            ))}
            <TextField
              type="date"
              label="Purchase date"
              value={purchaseDate}
              onChange={(event) => setPurchaseDate(event.target.value)}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Store (optional)"
              value={store}
              onChange={(event) => setStore(event.target.value)}
              inputProps={{ maxLength: 120 }}
            />
            <Typography variant="caption" color="text.secondary">
              Each confirmed vegetable becomes a separate available purchase lot.
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setPurchaseDialogOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={!selectedStageIds.length || saving}>
              Confirm selected
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <Dialog open={Boolean(receiptPhoto)} onClose={() => setReceiptPhoto(null)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          Receipt photo preview
          <IconButton aria-label="Close receipt photo" onClick={() => setReceiptPhoto(null)}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {receiptPhoto && (
            <>
              <Box
                component="img"
                src={receiptPhoto.url}
                alt={receiptPhoto.name}
                sx={{ display: 'block', maxWidth: '100%', maxHeight: '60vh', mx: 'auto', objectFit: 'contain' }}
              />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                {receiptPhoto.name}. This is a local preview only; receipt parsing is not implemented.
              </Typography>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReceiptPhoto(null)}>Close</Button>
        </DialogActions>
      </Dialog>
      {catchUpOpen && (
        <CatchUpDialog
          meals={unconfirmedMeals}
          saving={saving}
          onClose={() => setCatchUpMode('closed')}
          onSubmit={submitCatchUp}
        />
      )}
      <Snackbar
        open={Boolean(notice)}
        autoHideDuration={4000}
        onClose={() => setNotice('')}
        message={notice}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        sx={{ mb: `calc(${BOTTOM_NAV_HEIGHT}px + env(safe-area-inset-bottom))` }}
      />
      <BottomNav
        onAddClick={(event) => setAddMenuAnchor(event.currentTarget)}
        onGroceriesClick={() => setGroceryDialogOpen(true)}
        onConfirmClick={handleConfirmClick}
        pendingPurchaseCount={pendingPurchaseCount}
        unconfirmedMealCount={unconfirmedMeals.length}
      />
    </Box>
  );
}
