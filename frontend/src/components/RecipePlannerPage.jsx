import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  AppBar,
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
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
import PushNotificationSettings from './PushNotificationSettings';

const WEEKDAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];
const MEALS = ['Kids Tiffin', 'Lunch', 'Dinner'];
const STORAGE_KEY = 'food-app-weekly-recipes';

function createEmptyPlan() {
  return Object.fromEntries(WEEKDAYS.map((day) => [
    day,
    Object.fromEntries(MEALS.map((meal) => [meal, []])),
  ]));
}

function readSavedPlan(storageKey) {
  const emptyPlan = createEmptyPlan();
  try {
    const savedPlan = JSON.parse(localStorage.getItem(storageKey) || '{}');
    if (!savedPlan || typeof savedPlan !== 'object' || Array.isArray(savedPlan)) {
      return emptyPlan;
    }

    return Object.fromEntries(WEEKDAYS.map((day) => [
      day,
      Object.fromEntries(MEALS.map((meal) => {
        const entries = savedPlan[day]?.[meal];
        return [
          meal,
          Array.isArray(entries) ? entries.filter((entry) => typeof entry === 'string') : [],
        ];
      })),
    ]));
  } catch (error) {
    console.error('Could not load the saved weekly recipe plan:', error);
    return emptyPlan;
  }
}

function DayCard({ day, meals, colors }) {
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
        {MEALS.map((meal, index) => (
          <Box key={meal}>
            {index > 0 && <Divider sx={{ borderColor: colors.primary[500] }} />}
            <Box sx={{ py: 1.25 }}>
              <Typography variant="subtitle2" fontWeight={700} color={colors.greenAccent[500]}>
                {meal}
              </Typography>
              {meals[meal].length > 0 ? meals[meal].map((recipe, recipeIndex) => (
                <Typography
                  key={`${recipe}-${recipeIndex}`}
                  variant="body2"
                  sx={{ mt: 0.5, overflowWrap: 'anywhere' }}
                >
                  {recipe}
                </Typography>
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
  const storageKey = `${STORAGE_KEY}:${user?.id ?? 'default'}`;
  const [plan, setPlan] = useState(() => readSavedPlan(storageKey));
  const [storageError, setStorageError] = useState('');
  const [addMenuAnchor, setAddMenuAnchor] = useState(null);
  const [recipeDialogOpen, setRecipeDialogOpen] = useState(false);
  const [recipeName, setRecipeName] = useState('');
  const [recipeDay, setRecipeDay] = useState(WEEKDAYS[0]);
  const [recipeMeal, setRecipeMeal] = useState(MEALS[0]);
  const [receiptPhoto, setReceiptPhoto] = useState(null);
  const photoInputRef = useRef(null);

  useEffect(() => () => {
    if (receiptPhoto?.url) {
      URL.revokeObjectURL(receiptPhoto.url);
    }
  }, [receiptPhoto]);

  const closeAddMenu = () => setAddMenuAnchor(null);

  const addRecipe = (event) => {
    event.preventDefault();
    const name = recipeName.trim();
    if (!name) return;

    const updatedPlan = {
      ...plan,
      [recipeDay]: {
        ...plan[recipeDay],
        [recipeMeal]: [...plan[recipeDay][recipeMeal], name],
      },
    };
    setPlan(updatedPlan);
    try {
      localStorage.setItem(storageKey, JSON.stringify(updatedPlan));
      setStorageError('');
    } catch (error) {
      console.error('Could not save the weekly recipe plan:', error);
      setStorageError('The recipe was added for this session, but could not be saved on this device.');
    }
    setRecipeName('');
    setRecipeDialogOpen(false);
  };

  const chooseReceiptPhoto = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setReceiptPhoto({ name: file.name, url: URL.createObjectURL(file) });
    event.target.value = '';
  };

  const closeReceiptPreview = () => setReceiptPhoto(null);

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

      <Menu
        id="add-menu"
        anchorEl={addMenuAnchor}
        open={Boolean(addMenuAnchor)}
        onClose={closeAddMenu}
      >
        <MenuItem onClick={() => {
          closeAddMenu();
          setRecipeDialogOpen(true);
        }}>
          <RestaurantMenuOutlinedIcon fontSize="small" sx={{ mr: 1.5 }} />
          Add new recipe
        </MenuItem>
        <MenuItem onClick={() => {
          closeAddMenu();
          photoInputRef.current?.click();
        }}>
          <ReceiptLongOutlinedIcon fontSize="small" sx={{ mr: 1.5 }} />
          Add receipt photo
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
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          Plan recipes by day and meal. Signed in as {user?.email}. Your recipe plan is saved on this device.
        </Typography>
        {storageError && <Alert severity="warning" sx={{ mb: 2 }}>{storageError}</Alert>}
        <Grid container spacing={2}>
          {WEEKDAYS.map((day) => (
            <Grid key={day} size={{ xs: 12, sm: 6, lg: 4 }}>
              <DayCard day={day} meals={plan[day]} colors={colors} />
            </Grid>
          ))}
        </Grid>

        <Box sx={{ mt: 4 }}>
          <PushNotificationSettings />
        </Box>
      </Box>

      <Dialog
        open={recipeDialogOpen}
        onClose={() => setRecipeDialogOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <Box component="form" onSubmit={addRecipe}>
          <DialogTitle>Add recipe to the meal plan</DialogTitle>
          <DialogContent sx={{ display: 'grid', gap: 2, pt: '8px !important' }}>
            <TextField
              select
              label="Day"
              value={recipeDay}
              onChange={(event) => setRecipeDay(event.target.value)}
            >
              {WEEKDAYS.map((day) => <MenuItem key={day} value={day}>{day}</MenuItem>)}
            </TextField>
            <TextField
              select
              label="Meal"
              value={recipeMeal}
              onChange={(event) => setRecipeMeal(event.target.value)}
            >
              {MEALS.map((meal) => <MenuItem key={meal} value={meal}>{meal}</MenuItem>)}
            </TextField>
            <TextField
              autoFocus
              required
              label="Recipe name"
              value={recipeName}
              onChange={(event) => setRecipeName(event.target.value)}
              inputProps={{ maxLength: 120 }}
            />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setRecipeDialogOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={!recipeName.trim()}>Add recipe</Button>
          </DialogActions>
        </Box>
      </Dialog>

      <Dialog open={Boolean(receiptPhoto)} onClose={closeReceiptPreview} fullWidth maxWidth="sm">
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          Receipt photo
          <IconButton aria-label="Close receipt photo" onClick={closeReceiptPreview}>
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
                {receiptPhoto.name}. This is a local preview; receipt upload and recognition are not connected yet.
              </Typography>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeReceiptPreview}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
