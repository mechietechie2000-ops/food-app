-- Idempotent representative seed data for food_app_schema_final.sql.
-- Staple ingredients are always available and never get inventory lots.

PRAGMA foreign_keys = ON;

BEGIN TRANSACTION;

INSERT OR IGNORE INTO item
    (name, category, inventory_type, is_veg, default_shelf_life_days, always_available)
VALUES
    ('Onion', 'staple', 'STAPLE', 1, 30, 1),
    ('Tomato', 'staple', 'STAPLE', 1, 7, 1),
    ('Potato', 'staple', 'STAPLE', 1, 30, 1),
    ('Garlic', 'staple', 'STAPLE', 1, 30, 1),
    ('Ginger', 'staple', 'STAPLE', 1, 21, 1),
    ('Green Chili', 'staple', 'STAPLE', 1, 7, 1),
    ('Cilantro', 'staple', 'STAPLE', 1, 5, 1),
    ('Rice', 'staple', 'STAPLE', 1, 365, 1),
    ('Toor Dal', 'dal', 'STAPLE', 1, 365, 1),
    ('Moong Dal', 'dal', 'STAPLE', 1, 365, 1),
    ('Masoor Dal', 'dal', 'STAPLE', 1, 365, 1),
    ('Rajma', 'dal', 'STAPLE', 1, 365, 1),
    ('Chana Masala', 'dal', 'STAPLE', 1, 365, 1),
    ('Black Beans', 'dal', 'STAPLE', 1, 365, 1),
    ('Wheat Flour', 'staple', 'STAPLE', 1, 90, 1),
    ('Oil', 'staple', 'STAPLE', 1, 365, 1),
    ('Salt', 'spice', 'STAPLE', 1, 365, 1),
    ('Turmeric', 'spice', 'STAPLE', 1, 365, 1),
    ('Cumin', 'spice', 'STAPLE', 1, 365, 1),
    ('Garam Masala', 'spice', 'STAPLE', 1, 365, 1),
    ('Bhindi', 'green_veggie', 'FRESH', 1, 5, 0),
    ('Lauki', 'green_veggie', 'FRESH', 1, 7, 0),
    ('Baingan', 'green_veggie', 'FRESH', 1, 6, 0),
    ('Cauliflower', 'green_veggie', 'FRESH', 1, 7, 0),
    ('Carrot', 'green_veggie', 'FRESH', 1, 10, 0),
    ('Green Beans', 'green_veggie', 'FRESH', 1, 5, 0),
    ('Cabbage', 'green_veggie', 'FRESH', 1, 10, 0),
    ('Bell Pepper', 'green_veggie', 'FRESH', 1, 7, 0),
    ('Spinach', 'green_veggie', 'FRESH', 1, 4, 0),
    ('Methi', 'green_veggie', 'FRESH', 1, 4, 0),
    ('Peas', 'green_veggie', 'FRESH', 1, 5, 0);

INSERT OR IGNORE INTO recipe
    (name, description, instructions, cuisine, meal_type, is_veg,
     suitable_for_kids_tiffin, suitable_for_adult_tiffin,
     suitable_for_adult_dinner, approved, cooldown_days)
VALUES
    ('Bhindi Masala', 'Okra cooked with onion, tomato and Indian spices.',
     'Wash and dry bhindi. Slice and saute with oil and spices. Add onion and tomato and cook until tender.',
     'Indian', 'sabzi', 1, 0, 0, 1, 1, 21),
    ('Aloo Gobi', 'Potato and cauliflower cooked with Indian spices.',
     'Saute potato and cauliflower with onion, tomato and spices until tender.',
     'Indian', 'sabzi', 1, 1, 0, 1, 1, 21),
    ('Baingan Bharta', 'Roasted eggplant cooked with onion, tomato and spices.',
     'Roast eggplant, remove the skin, mash and cook with onion, tomato and spices.',
     'Indian', 'sabzi', 1, 0, 0, 1, 1, 21),
    ('Lauki Dal', 'Bottle gourd cooked with dal.',
     'Cook dal and lauki together, then temper with cumin, garlic and spices.',
     'Indian', 'dal', 1, 1, 0, 1, 1, 21),
    ('Gajar Matar', 'Carrot and peas cooked with Indian spices.',
     'Cook carrot and peas with onion, tomato and spices until tender.',
     'Indian', 'sabzi', 1, 1, 0, 1, 1, 21),
    ('Palak Dal', 'Spinach cooked with dal.',
     'Cook dal and spinach together and finish with a cumin-garlic tempering.',
     'Indian', 'dal', 1, 1, 0, 1, 1, 21),
    ('Mixed Vegetable', 'A flexible vegetable curry using the fresh vegetables on hand.',
     'Cook the required carrot with any available optional vegetables, onion, tomato and spices until tender.',
     'Indian', 'sabzi', 1, 1, 0, 1, 1, 21),
    ('Moong Dal', 'Family dal served alongside a vegetable dish.',
     NULL, 'Indian', 'dal_side', 1, 0, 0, 1, 1, 21),
    ('Toor Dal', 'Family dal served alongside a vegetable dish.',
     NULL, 'Indian', 'dal_side', 1, 0, 0, 1, 1, 21),
    ('Masoor Dal', 'Family dal served alongside a vegetable dish.',
     NULL, 'Indian', 'dal_side', 1, 0, 0, 1, 1, 21),
    ('Rajma', 'Family dal served alongside a vegetable dish.',
     NULL, 'Indian', 'dal_side', 1, 0, 0, 1, 1, 21),
    ('Chana Masala', 'Family dal served alongside a vegetable dish.',
     NULL, 'Indian', 'dal_side', 1, 0, 0, 1, 1, 21),
    ('Black Beans', 'Family dal served alongside a vegetable dish.',
     NULL, 'Indian', 'dal_side', 1, 0, 0, 1, 1, 21);

INSERT OR IGNORE INTO recipe_item (recipe_id, item_id, role)
SELECT r.id, i.id, x.role
FROM (
    SELECT 'Bhindi Masala' AS recipe, 'Bhindi' AS item, 'REQUIRED' AS role
    UNION ALL SELECT 'Bhindi Masala', 'Onion', 'OPTIONAL'
    UNION ALL SELECT 'Bhindi Masala', 'Tomato', 'OPTIONAL'
    UNION ALL SELECT 'Bhindi Masala', 'Garlic', 'OPTIONAL'
    UNION ALL SELECT 'Aloo Gobi', 'Potato', 'REQUIRED'
    UNION ALL SELECT 'Aloo Gobi', 'Cauliflower', 'REQUIRED'
    UNION ALL SELECT 'Aloo Gobi', 'Onion', 'OPTIONAL'
    UNION ALL SELECT 'Aloo Gobi', 'Tomato', 'OPTIONAL'
    UNION ALL SELECT 'Baingan Bharta', 'Baingan', 'REQUIRED'
    UNION ALL SELECT 'Baingan Bharta', 'Onion', 'OPTIONAL'
    UNION ALL SELECT 'Baingan Bharta', 'Tomato', 'OPTIONAL'
    UNION ALL SELECT 'Lauki Dal', 'Lauki', 'REQUIRED'
    UNION ALL SELECT 'Lauki Dal', 'Toor Dal', 'REQUIRED'
    UNION ALL SELECT 'Lauki Dal', 'Garlic', 'OPTIONAL'
    UNION ALL SELECT 'Gajar Matar', 'Carrot', 'REQUIRED'
    UNION ALL SELECT 'Gajar Matar', 'Peas', 'OPTIONAL'
    UNION ALL SELECT 'Gajar Matar', 'Onion', 'OPTIONAL'
    UNION ALL SELECT 'Palak Dal', 'Spinach', 'REQUIRED'
    UNION ALL SELECT 'Palak Dal', 'Moong Dal', 'REQUIRED'
    UNION ALL SELECT 'Palak Dal', 'Garlic', 'OPTIONAL'
    UNION ALL SELECT 'Mixed Vegetable', 'Carrot', 'REQUIRED'
    UNION ALL SELECT 'Mixed Vegetable', 'Green Beans', 'OPTIONAL'
    UNION ALL SELECT 'Mixed Vegetable', 'Cauliflower', 'OPTIONAL'
    UNION ALL SELECT 'Mixed Vegetable', 'Peas', 'OPTIONAL'
    UNION ALL SELECT 'Mixed Vegetable', 'Potato', 'OPTIONAL'
    UNION ALL SELECT 'Moong Dal', 'Moong Dal', 'REQUIRED'
    UNION ALL SELECT 'Toor Dal', 'Toor Dal', 'REQUIRED'
    UNION ALL SELECT 'Masoor Dal', 'Masoor Dal', 'REQUIRED'
    UNION ALL SELECT 'Rajma', 'Rajma', 'REQUIRED'
    UNION ALL SELECT 'Chana Masala', 'Chana Masala', 'REQUIRED'
    UNION ALL SELECT 'Black Beans', 'Black Beans', 'REQUIRED'
) AS x
JOIN recipe r ON r.name = x.recipe
JOIN item i ON i.name = x.item;

-- Purchase lots stay distinct, including the two Bhindi purchases.
INSERT INTO inventory (item_id, purchase_date, expiry_date, store, status)
SELECT i.id, '2026-09-22', '2026-09-27', 'Costco', 'AVAILABLE'
FROM item i
WHERE i.name = 'Bhindi'
  AND NOT EXISTS (
      SELECT 1 FROM inventory inv
      WHERE inv.item_id = i.id AND inv.purchase_date = '2026-09-22' AND inv.store = 'Costco'
  );

INSERT INTO inventory (item_id, purchase_date, expiry_date, store, status)
SELECT i.id, '2026-09-26', '2026-10-01', 'Indian Grocery Store', 'AVAILABLE'
FROM item i
WHERE i.name = 'Bhindi'
  AND NOT EXISTS (
      SELECT 1 FROM inventory inv
      WHERE inv.item_id = i.id AND inv.purchase_date = '2026-09-26' AND inv.store = 'Indian Grocery Store'
  );

INSERT INTO inventory (item_id, purchase_date, expiry_date, store, status)
SELECT i.id, '2026-09-25', '2026-10-02', 'Indian Grocery Store', 'AVAILABLE'
FROM item i
WHERE i.name = 'Lauki'
  AND NOT EXISTS (
      SELECT 1 FROM inventory inv
      WHERE inv.item_id = i.id AND inv.purchase_date = '2026-09-25' AND inv.store = 'Indian Grocery Store'
  );

INSERT INTO inventory (item_id, purchase_date, expiry_date, store, status)
SELECT i.id, '2026-09-24', '2026-09-30', 'Indian Grocery Store', 'AVAILABLE'
FROM item i
WHERE i.name = 'Baingan'
  AND NOT EXISTS (
      SELECT 1 FROM inventory inv
      WHERE inv.item_id = i.id AND inv.purchase_date = '2026-09-24' AND inv.store = 'Indian Grocery Store'
  );

INSERT INTO inventory (item_id, purchase_date, expiry_date, store, status)
SELECT i.id, '2026-09-22', '2026-09-29', 'Costco', 'AVAILABLE'
FROM item i
WHERE i.name = 'Cauliflower'
  AND NOT EXISTS (
      SELECT 1 FROM inventory inv
      WHERE inv.item_id = i.id AND inv.purchase_date = '2026-09-22' AND inv.store = 'Costco'
  );

INSERT INTO inventory (item_id, purchase_date, expiry_date, store, status)
SELECT i.id, '2026-09-22', '2026-10-02', 'Costco', 'AVAILABLE'
FROM item i
WHERE i.name = 'Carrot'
  AND NOT EXISTS (
      SELECT 1 FROM inventory inv
      WHERE inv.item_id = i.id AND inv.purchase_date = '2026-09-22' AND inv.store = 'Costco'
  );

INSERT INTO inventory (item_id, purchase_date, expiry_date, store, status)
SELECT i.id, '2026-09-26', '2026-09-30', 'Indian Grocery Store', 'AVAILABLE'
FROM item i
WHERE i.name = 'Spinach'
  AND NOT EXISTS (
      SELECT 1 FROM inventory inv
      WHERE inv.item_id = i.id AND inv.purchase_date = '2026-09-26' AND inv.store = 'Indian Grocery Store'
  );

INSERT OR IGNORE INTO festival (name, description)
VALUES ('Diwali', 'Festival of Lights'),
       ('Holi', 'Festival of Colors'),
       ('Janmashtami', 'Festival associated with the birth of Krishna');

-- Keep the sample calendar demonstration clear of a misleading current festival.
INSERT INTO calendar_date (calendar_date, festival_id, lunar_date, dietary_restriction, notes)
SELECT '2026-10-20', f.id, 'Sample lunar date', 'none', 'Sample calendar record'
FROM festival f
WHERE f.name = 'Diwali'
  AND NOT EXISTS (
      SELECT 1 FROM calendar_date cd
      WHERE cd.calendar_date = '2026-10-20' AND cd.festival_id = f.id
  );

INSERT INTO weekly_meal_plan (recipe_id, meal_date, meal_slot, status)
SELECT r.id, '2026-09-21', 'dinner', 'planned'
FROM recipe r
WHERE r.name = 'Bhindi Masala'
  AND NOT EXISTS (
      SELECT 1 FROM weekly_meal_plan p
      WHERE p.meal_date = '2026-09-21'
        AND p.meal_slot = 'dinner'
  );

INSERT INTO weekly_meal_plan (recipe_id, meal_date, meal_slot, status)
SELECT r.id, '2026-09-22', 'dinner', 'planned'
FROM recipe r
WHERE r.name = 'Lauki Dal'
  AND NOT EXISTS (
      SELECT 1 FROM weekly_meal_plan p
      WHERE p.meal_date = '2026-09-22'
        AND p.meal_slot = 'dinner'
  );

INSERT INTO weekly_meal_plan (recipe_id, meal_date, meal_slot, status)
SELECT r.id, '2026-09-23', 'dinner', 'planned'
FROM recipe r
WHERE r.name = 'Baingan Bharta'
  AND NOT EXISTS (
      SELECT 1 FROM weekly_meal_plan p
      WHERE p.meal_date = '2026-09-23'
        AND p.meal_slot = 'dinner'
  );

INSERT INTO weekly_meal_plan (recipe_id, meal_date, meal_slot, status)
SELECT r.id, '2026-09-25', 'kids_tiffin', 'planned'
FROM recipe r
WHERE r.name = 'Gajar Matar'
  AND NOT EXISTS (
      SELECT 1 FROM weekly_meal_plan p
      WHERE p.meal_date = '2026-09-25'
        AND p.meal_slot = 'kids_tiffin'
  );

INSERT INTO weekly_meal_plan (recipe_id, meal_date, meal_slot, status)
SELECT r.id, '2026-09-26', 'weekend_lunch', 'planned'
FROM recipe r
WHERE r.name = 'Mixed Vegetable'
  AND NOT EXISTS (
      SELECT 1 FROM weekly_meal_plan p
      WHERE p.meal_date = '2026-09-26'
        AND p.meal_slot = 'weekend_lunch'
  );

-- Default weekday tiffin pattern from the spec's open decision list
-- (Mon/Tue adult, Wed/Fri kids, Thu and weekends none). Standing rows only;
-- change a row's tiffin_type to edit the pattern (use 'none' to turn a day
-- off; a deleted row is re-seeded on restart). INSERT OR IGNORE never
-- overwrites a row you have edited.
INSERT OR IGNORE INTO tiffin_schedule (day_of_week, effective_date, tiffin_type)
VALUES ('monday', NULL, 'adult_tiffin'),
       ('tuesday', NULL, 'adult_tiffin'),
       ('wednesday', NULL, 'kids_tiffin'),
       ('friday', NULL, 'kids_tiffin');

COMMIT;
