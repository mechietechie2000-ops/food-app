import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  AppBar,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
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
  TextField,
  Toolbar,
  Typography,
  useTheme,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import RestaurantMenuOutlinedIcon from '@mui/icons-material/RestaurantMenuOutlined';
import { tokens } from '../theme';
import { useAuth } from '../context/useAuth';
import { api } from '../services/api';
import PushNotificationSettings from './PushNotificationSettings';

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MEALS = ['Kids Tiffin', 'Lunch', 'Dinner'];
const MEAL_SLOTS = [
  { label: 'Kids Tiffin', value: 'kids_tiffin' },
  { label: 'Adult Tiffin', value: 'adult_tiffin' },
  { label: 'Lunch', value: 'weekend_lunch' },
  { label: 'Dinner', value: 'dinner' },
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

function DayCard({ day, meals, colors, onConfirm }) {
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
        </Box>
        {mealLabels.map((meal, index) => (
          <Box key={meal}>
            {index > 0 && <Divider sx={{ borderColor: colors.primary[500] }} />}
            <Box sx={{ py: 1.25 }}>
              <Typography variant="subtitle2" fontWeight={700} color={colors.greenAccent[500]}>
                {meal}
              </Typography>
              {meals[meal].length > 0 ? meals[meal].map((entry) => (
                <Box key={entry.id} sx={{ mt: 0.75 }}>
                  <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
                    {entry.name}
                    {entry.status !== 'planned' && ` · ${entry.status.replaceAll('_', ' ')}`}
                  </Typography>
                  {entry.status === 'planned' && (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                      {[
                        ['yes', 'Cooked'],
                        ['no', 'Skipped'],
                        ['other', 'Other'],
                      ].map(([response, label]) => (
                        <Button
                          key={response}
                          size="small"
                          color="inherit"
                          onClick={() => onConfirm(entry.id, response)}
                          sx={{ minWidth: 0, px: 0.75, textTransform: 'none' }}
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
            </Box>
          </Box>
        ))}
      </CardContent>
    </Card>
  );
}

export default function RecipePlannerPage() {
  const { user, logout } = useAuth();
  const theme = useTheme();
  const colors = tokens(theme.palette.mode);
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
  const photoInputRef = useRef(null);

  useEffect(() => () => {
    if (receiptPhoto?.url) URL.revokeObjectURL(receiptPhoto.url);
  }, [receiptPhoto]);

  const fetchDashboard = useCallback(async () => {
    const { data } = await api.get(`/food?weekStart=${encodeURIComponent(weekStart)}`);
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
      const { data } = await api.post(`/food/plan/${planId}/confirm`, { response });
      await refreshDashboard();
      if (data.missingInventory?.length) {
        setPageError(`Meal marked cooked, but no available lot was found for: ${data.missingInventory.join(', ')}.`);
      }
    } catch (error) {
      setPageError(error.message || 'Could not save the meal confirmation.');
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
          name: entry.recipe_name,
          status: entry.status,
        });
      });
    return meals;
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar position="sticky">
        <Toolbar sx={{ justifyContent: 'space-between', gap: 1 }}>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>Food App</Typography>
          <IconButton
            aria-label="Add recipe or receipt"
            aria-controls={addMenuAnchor ? 'add-menu' : undefined}
            aria-haspopup="menu"
            aria-expanded={Boolean(addMenuAnchor)}
            onClick={(event) => setAddMenuAnchor(event.currentTarget)}
            sx={{ bgcolor: 'secondary.main', color: '#102018', '&:hover': { bgcolor: '#3da58a' } }}
          >
            <AddIcon />
          </IconButton>
          <Button color="inherit" onClick={logout}>Sign out</Button>
        </Toolbar>
      </AppBar>

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
          setGroceryDialogOpen(true);
        }}>
          Add fresh vegetables to grocery list
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

      <Box sx={{ maxWidth: 1200, mx: 'auto', p: { xs: 2, sm: 3 } }}>
        <Typography variant="h4" gutterBottom>Weekly meal plan</Typography>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          Signed in as {user?.email}. Meals and fresh-produce lots are saved in the household database.
        </Typography>
        {pageError && <Alert severity="error" onClose={() => setPageError('')} sx={{ mb: 2 }}>{pageError}</Alert>}
        {loading && <CircularProgress size={24} sx={{ mb: 2 }} />}

        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>Fresh vegetables on hand</Typography>
          {dashboard?.inventory.length ? (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {dashboard.inventory.map((lot) => (
                <Typography
                  key={lot.id}
                  variant="body2"
                  sx={{ px: 1.25, py: 0.75, borderRadius: 1, bgcolor: 'action.hover' }}
                >
                  {lot.item_name} · bought {lot.purchase_date}{lot.store ? ` at ${lot.store}` : ''}
                </Typography>
              ))}
            </Box>
          ) : (
            <Typography color="text.secondary">No fresh vegetables are currently marked available.</Typography>
          )}
          {!!dashboard?.groceryStage.length && (
            <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, mt: 1.5 }}>
              <Typography variant="body2">
                Grocery list: {dashboard.groceryStage.map((item) => item.item_name).join(', ')}
              </Typography>
              <Button size="small" variant="outlined" onClick={openPurchaseDialog}>
                Confirm purchases
              </Button>
            </Box>
          )}
        </Box>

        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>Approved recipes that fit current inventory</Typography>
          {recommendations.length ? recommendations.map((recipe) => (
            <Box
              key={recipe.id}
              sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 0.75 }}
            >
              <Typography variant="body2">
                <strong>{recipe.name}</strong>
                {' · uses '}
                {recipe.requiredFresh.map((item) => `${item.name} (${item.freshness.toLowerCase()})`).join(', ')}
                {recipe.optionalAvailable.length > 0 && ` · optional: ${recipe.optionalAvailable.join(', ')}`}
              </Typography>
              <Button size="small" onClick={() => openRecipeDialog(recipe.id)}>Plan</Button>
            </Box>
          )) : (
            <Typography color="text.secondary">
              No approved recipes currently match available fresh vegetables.
            </Typography>
          )}
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Button variant="outlined" onClick={() => setGroceryDialogOpen(true)}>
            Add vegetables to grocery list
          </Button>
          <Button variant="outlined" onClick={openRecipeDialog} disabled={!recommendations.length}>
            Add recipe to plan
          </Button>
        </Box>
        <Grid container spacing={2}>
          {WEEKDAYS.map((day, index) => (
            <Grid key={day} size={{ xs: 12, sm: 6, lg: 4 }}>
              <DayCard
                day={day}
                meals={cardMeals(offsetDate(weekStart, index))}
                colors={colors}
                onConfirm={confirmMeal}
              />
            </Grid>
          ))}
        </Grid>

        <Box sx={{ mt: 4 }}>
          <PushNotificationSettings />
        </Box>
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
    </Box>
  );
}
