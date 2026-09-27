-- Sample data for Food App first-cut SQLite schema
-- Assumes the tables from food-app-first-cut-schema.sql already exist.
-- IDs are intentionally omitted where possible so SQLite can assign them.

PRAGMA foreign_keys = ON;

BEGIN TRANSACTION;

-- ============================================================
-- 1. INGREDIENT
-- ============================================================

INSERT INTO ingredient
    (name, category, inventory_type, always_available)
VALUES
    ('Onion',           'Vegetable', 'STAPLE', 1),
    ('Tomato',          'Vegetable', 'STAPLE', 1),
    ('Potato',          'Vegetable', 'STAPLE', 1),
    ('Garlic',          'Aromatic', 'STAPLE', 1),
    ('Ginger',          'Aromatic', 'STAPLE', 1),
    ('Green Chili',     'Aromatic', 'STAPLE', 1),
    ('Cilantro',        'Herb',     'STAPLE', 1),
    ('Rice',            'Grain',    'STAPLE', 1),
    ('Toor Dal',        'Dal',      'STAPLE', 1),
    ('Moong Dal',       'Dal',      'STAPLE', 1),
    ('Wheat Flour',     'Flour',    'STAPLE', 1),
    ('Oil',             'Cooking',  'STAPLE', 1),
    ('Salt',            'Spice',    'STAPLE', 1),
    ('Turmeric',        'Spice',    'STAPLE', 1),
    ('Cumin',            'Spice',    'STAPLE', 1),
    ('Garam Masala',    'Spice',    'STAPLE', 1),

    ('Bhindi',          'Vegetable', 'FRESH', 0),
    ('Lauki',           'Vegetable', 'FRESH', 0),
    ('Baingan',         'Vegetable', 'FRESH', 0),
    ('Cauliflower',     'Vegetable', 'FRESH', 0),
    ('Carrot',          'Vegetable', 'FRESH', 0),
    ('Green Beans',     'Vegetable', 'FRESH', 0),
    ('Cabbage',         'Vegetable', 'FRESH', 0),
    ('Bell Pepper',     'Vegetable', 'FRESH', 0),
    ('Spinach',         'Leafy Green', 'FRESH', 0),
    ('Methi',           'Leafy Green', 'FRESH', 0);

-- ============================================================
-- 2. RECIPES
-- ============================================================

INSERT INTO recipe
    (name, description, instructions, cuisine, meal_type, approved, cooldown_days)
VALUES
(
    'Bhindi Masala',
    'Okra cooked with onion, tomato and Indian spices.',
    'Wash and dry bhindi. Slice. Saute with oil and spices. Add onion and tomato and cook until done.',
    'Indian',
    'Dinner',
    1,
    21
),
(
    'Aloo Gobi',
    'Potato and cauliflower cooked with Indian spices.',
    'Saute potato and cauliflower with onion, tomato and spices until tender.',
    'Indian',
    'Dinner',
    1,
    21
),
(
    'Baingan Bharta',
    'Roasted eggplant cooked with onion, tomato and spices.',
    'Roast eggplant, remove skin, mash and cook with onion, tomato and spices.',
    'Indian',
    'Dinner',
    1,
    21
),
(
    'Lauki Dal',
    'Bottle gourd cooked with dal.',
    'Cook dal and lauki together, then temper with cumin, garlic and spices.',
    'Indian',
    'Dinner',
    1,
    21
),
(
    'Gajar Matar',
    'Carrot and peas cooked with Indian spices.',
    'Cook carrot and peas with onion, tomato and spices until tender.',
    'Indian',
    'Dinner',
    1,
    21
),
(
    'Palak Dal',
    'Spinach cooked with dal.',
    'Cook dal and spinach together and finish with a cumin-garlic tempering.',
    'Indian',
    'Dinner',
    1,
    21
),
(
    'Poori',
    'Deep-fried Indian wheat bread.',
    'Prepare wheat flour dough and deep fry small rolled portions.',
    'Indian',
    'Festival',
    1,
    21
),
(
    'Aloo Sabzi',
    'Potato curry commonly served with poori.',
    'Cook potatoes with onion, tomato and spices.',
    'Indian',
    'Festival',
    1,
    21
),
(
    'Sooji Halwa',
    'Semolina dessert.',
    'Roast semolina and cook with water, sugar and ghee.',
    'Indian',
    'Festival',
    1,
    21
);

-- ============================================================
-- 3. RECIPE INGREDIENTS
-- ============================================================
-- IDs correspond to insertion order above.

-- Bhindi Masala: Bhindi required; onion/tomato/etc. are staples.
INSERT INTO recipe_ingredient (recipe_id, ingredient_id, role)
SELECT r.id, i.id, x.role
FROM recipe r
JOIN (
    SELECT 'Bhindi' AS name, 'REQUIRED' AS role
    UNION ALL SELECT 'Onion', 'REQUIRED'
    UNION ALL SELECT 'Tomato', 'REQUIRED'
    UNION ALL SELECT 'Garlic', 'OPTIONAL'
    UNION ALL SELECT 'Green Chili', 'OPTIONAL'
) x
JOIN ingredient i ON i.name = x.name
WHERE r.name = 'Bhindi Masala';

-- Aloo Gobi
INSERT INTO recipe_ingredient (recipe_id, ingredient_id, role)
SELECT r.id, i.id, x.role
FROM recipe r
JOIN (
    SELECT 'Potato' AS name, 'REQUIRED' AS role
    UNION ALL SELECT 'Cauliflower', 'REQUIRED'
    UNION ALL SELECT 'Onion', 'REQUIRED'
    UNION ALL SELECT 'Tomato', 'REQUIRED'
) x
JOIN ingredient i ON i.name = x.name
WHERE r.name = 'Aloo Gobi';

-- Baingan Bharta
INSERT INTO recipe_ingredient (recipe_id, ingredient_id, role)
SELECT r.id, i.id, x.role
FROM recipe r
JOIN (
    SELECT 'Baingan' AS name, 'REQUIRED' AS role
    UNION ALL SELECT 'Onion', 'REQUIRED'
    UNION ALL SELECT 'Tomato', 'REQUIRED'
    UNION ALL SELECT 'Garlic', 'OPTIONAL'
    UNION ALL SELECT 'Green Chili', 'OPTIONAL'
) x
JOIN ingredient i ON i.name = x.name
WHERE r.name = 'Baingan Bharta';

-- Lauki Dal
INSERT INTO recipe_ingredient (recipe_id, ingredient_id, role)
SELECT r.id, i.id, x.role
FROM recipe r
JOIN (
    SELECT 'Lauki' AS name, 'REQUIRED' AS role
    UNION ALL SELECT 'Toor Dal', 'REQUIRED'
    UNION ALL SELECT 'Onion', 'OPTIONAL'
    UNION ALL SELECT 'Garlic', 'OPTIONAL'
) x
JOIN ingredient i ON i.name = x.name
WHERE r.name = 'Lauki Dal';

-- Gajar Matar
INSERT INTO recipe_ingredient (recipe_id, ingredient_id, role)
SELECT r.id, i.id, x.role
FROM recipe r
JOIN (
    SELECT 'Carrot' AS name, 'REQUIRED' AS role
    UNION ALL SELECT 'Green Beans', 'OPTIONAL'
    UNION ALL SELECT 'Onion', 'REQUIRED'
    UNION ALL SELECT 'Tomato', 'OPTIONAL'
) x
JOIN ingredient i ON i.name = x.name
WHERE r.name = 'Gajar Matar';

-- Palak Dal
INSERT INTO recipe_ingredient (recipe_id, ingredient_id, role)
SELECT r.id, i.id, x.role
FROM recipe r
JOIN (
    SELECT 'Spinach' AS name, 'REQUIRED' AS role
    UNION ALL SELECT 'Moong Dal', 'REQUIRED'
    UNION ALL SELECT 'Garlic', 'OPTIONAL'
) x
JOIN ingredient i ON i.name = x.name
WHERE r.name = 'Palak Dal';

-- Poori
INSERT INTO recipe_ingredient (recipe_id, ingredient_id, role)
SELECT r.id, i.id, 'REQUIRED'
FROM recipe r
JOIN ingredient i ON i.name = 'Wheat Flour'
WHERE r.name = 'Poori';

-- Aloo Sabzi
INSERT INTO recipe_ingredient (recipe_id, ingredient_id, role)
SELECT r.id, i.id, x.role
FROM recipe r
JOIN (
    SELECT 'Potato' AS name, 'REQUIRED' AS role
    UNION ALL SELECT 'Onion', 'OPTIONAL'
    UNION ALL SELECT 'Tomato', 'OPTIONAL'
) x
JOIN ingredient i ON i.name = x.name
WHERE r.name = 'Aloo Sabzi';

-- Sooji Halwa
INSERT INTO recipe_ingredient (recipe_id, ingredient_id, role)
SELECT r.id, i.id, 'REQUIRED'
FROM recipe r
JOIN ingredient i ON i.name = 'Wheat Flour'
WHERE r.name = 'Sooji Halwa';

-- ============================================================
-- 4. INVENTORY
-- ============================================================
-- Fresh purchases are separate lots. Older lots can be consumed first.

INSERT INTO inventory
    (ingredient_id, purchase_date, store, status)
SELECT id, '2026-09-22', 'Costco', 'AVAILABLE'
FROM ingredient WHERE name = 'Cauliflower';

INSERT INTO inventory
    (ingredient_id, purchase_date, store, status)
SELECT id, '2026-09-22', 'Costco', 'AVAILABLE'
FROM ingredient WHERE name = 'Carrot';

INSERT INTO inventory
    (ingredient_id, purchase_date, store, status)
SELECT id, '2026-09-23', 'Indian Grocery Store', 'AVAILABLE'
FROM ingredient WHERE name = 'Bhindi';

INSERT INTO inventory
    (ingredient_id, purchase_date, store, status)
SELECT id, '2026-09-24', 'Indian Grocery Store', 'AVAILABLE'
FROM ingredient WHERE name = 'Baingan';

INSERT INTO inventory
    (ingredient_id, purchase_date, store, status)
SELECT id, '2026-09-25', 'Indian Grocery Store', 'AVAILABLE'
FROM ingredient WHERE name = 'Lauki';

-- Second Bhindi purchase demonstrates separate inventory lots.
INSERT INTO inventory
    (ingredient_id, purchase_date, store, status)
SELECT id, '2026-09-26', 'Indian Grocery Store', 'AVAILABLE'
FROM ingredient WHERE name = 'Bhindi';

-- ============================================================
-- 5. MEAL
-- ============================================================
-- These are examples of suggestions/plans, not necessarily
-- proof that the food was cooked.

INSERT INTO meal (recipe_id, meal_date, meal_type, status)
SELECT id, '2026-09-27', 'Dinner', 'SUGGESTED'
FROM recipe WHERE name = 'Bhindi Masala';

INSERT INTO meal (recipe_id, meal_date, meal_type, status)
SELECT id, '2026-09-28', 'Dinner', 'PLANNED'
FROM recipe WHERE name = 'Aloo Gobi';

-- ============================================================
-- 6. MEAL HISTORY
-- ============================================================
-- Only actual cooked meals belong here.

INSERT INTO meal_history
    (recipe_id, cooked_date, meal_type, source)
SELECT id, '2026-09-10', 'Dinner', 'USER'
FROM recipe WHERE name = 'Baingan Bharta';

INSERT INTO meal_history
    (recipe_id, cooked_date, meal_type, source)
SELECT id, '2026-09-15', 'Dinner', 'CONFIRMATION'
FROM recipe WHERE name = 'Aloo Gobi';

-- ============================================================
-- 7. FESTIVAL
-- ============================================================

INSERT INTO festival (name, description)
VALUES
    ('Diwali', 'Festival of Lights'),
    ('Holi', 'Festival of Colors'),
    ('Janmashtami', 'Festival associated with the birth of Krishna'),
    ('Navratri', 'Nine-night Hindu festival'),
    ('Raksha Bandhan', 'Festival celebrating the sibling bond'),
    ('Makar Sankranti', 'Harvest festival associated with the Sun');

-- ============================================================
-- 8. FESTIVAL_RECIPE
-- ============================================================
-- Family preference = 1 means this is one of the family's
-- usual recipes for the festival.

INSERT INTO festival_recipe
    (festival_id, recipe_id, family_preference)
SELECT f.id, r.id, 1
FROM festival f, recipe r
WHERE f.name = 'Diwali' AND r.name = 'Poori';

INSERT INTO festival_recipe
    (festival_id, recipe_id, family_preference)
SELECT f.id, r.id, 1
FROM festival f, recipe r
WHERE f.name = 'Diwali' AND r.name = 'Aloo Sabzi';

INSERT INTO festival_recipe
    (festival_id, recipe_id, family_preference)
SELECT f.id, r.id, 1
FROM festival f, recipe r
WHERE f.name = 'Diwali' AND r.name = 'Sooji Halwa';

INSERT INTO festival_recipe
    (festival_id, recipe_id, family_preference)
SELECT f.id, r.id, 0
FROM festival f, recipe r
WHERE f.name = 'Holi' AND r.name = 'Poori';

INSERT INTO festival_recipe
    (festival_id, recipe_id, family_preference)
SELECT f.id, r.id, 0
FROM festival f, recipe r
WHERE f.name = 'Holi' AND r.name = 'Aloo Sabzi';

-- ============================================================
-- 9. INDIAN_CALENDAR
-- ============================================================
-- Sample dates only. These are demonstration records for testing.
-- Production dates should be populated from the selected Indian
-- calendar source after we decide which source to use.

INSERT INTO indian_calendar
    (calendar_date, festival_id, festival_name, lunar_date, notes)
SELECT
    '2026-10-20',
    id,
    name,
    'Kartika Shukla Pratipada',
    'Sample calendar record'
FROM festival
WHERE name = 'Diwali';

INSERT INTO indian_calendar
    (calendar_date, festival_id, festival_name, lunar_date, notes)
SELECT
    '2027-03-22',
    id,
    name,
    NULL,
    'Sample calendar record'
FROM festival
WHERE name = 'Holi';

INSERT INTO indian_calendar
    (calendar_date, festival_id, festival_name, lunar_date, notes)
SELECT
    '2027-08-25',
    id,
    name,
    NULL,
    'Sample calendar record'
FROM festival
WHERE name = 'Janmashtami';

COMMIT;
