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

-- ---------------------------------------------------------------------------
-- Indian recipes (vegetarian and non-vegetarian). Non-veg proteins, paneer and a few
-- pantry staples are always available (no inventory lots). Recipes with no fresh
-- required vegetable are not inventory-driven: the automatic planner skips them,
-- but they can be planned by hand (dinner, lunch, guest special).
-- ---------------------------------------------------------------------------
INSERT OR IGNORE INTO item
    (name, category, inventory_type, is_veg, default_shelf_life_days, always_available)
VALUES
    ('Karela', 'green_veggie', 'FRESH', 1, 5, 0),
    ('Kaddu', 'green_veggie', 'FRESH', 1, 14, 0),
    ('Mushroom', 'green_veggie', 'FRESH', 1, 5, 0),
    ('Beetroot', 'green_veggie', 'FRESH', 1, 14, 0),
    ('Broccoli', 'green_veggie', 'FRESH', 1, 5, 0),
    ('Tinda', 'green_veggie', 'FRESH', 1, 6, 0),
    ('Chicken', 'protein', 'STAPLE', 0, 3, 1),
    ('Mutton', 'protein', 'STAPLE', 0, 3, 1),
    ('Fish', 'protein', 'STAPLE', 0, 2, 1),
    ('Prawns', 'protein', 'STAPLE', 0, 2, 1),
    ('Eggs', 'protein', 'STAPLE', 0, 21, 1),
    ('Paneer', 'protein', 'STAPLE', 1, 7, 1),
    ('Soya Chunks', 'protein', 'STAPLE', 1, 365, 1),
    ('Curd', 'staple', 'STAPLE', 1, 7, 1),
    ('Cream', 'staple', 'STAPLE', 1, 7, 1),
    ('Besan', 'staple', 'STAPLE', 1, 180, 1),
    ('Basmati Rice', 'staple', 'STAPLE', 1, 365, 1),
    ('Coconut', 'staple', 'STAPLE', 1, 30, 1),
    ('Kasuri Methi', 'spice', 'STAPLE', 1, 365, 1),
    ('Red Chili Powder', 'spice', 'STAPLE', 1, 365, 1),
    ('Coriander Powder', 'spice', 'STAPLE', 1, 365, 1),
    ('Mustard Seeds', 'spice', 'STAPLE', 1, 365, 1),
    ('Urad Dal', 'dal', 'STAPLE', 1, 365, 1),
    ('Kabuli Chana', 'dal', 'STAPLE', 1, 365, 1);

INSERT OR IGNORE INTO recipe
    (name, description, instructions, cuisine, meal_type, is_veg, is_frozen_friendly,
     requires_soak_marination, soak_time_hours, suitable_for_kids_tiffin,
     suitable_for_adult_tiffin, suitable_for_adult_dinner, approved, cooldown_days)
VALUES
    ('Dal Tadka', 'Yellow dal finished with a garlic-cumin tempering.', 'Pressure cook toor dal, then temper with cumin, garlic, onion and tomato.', 'Indian', 'dal', 1, 0, 0, 0, 0, 0, 1, 1, 21),
    ('Dal Makhani', 'Slow-cooked black dal and rajma in a creamy tomato gravy.', 'Soak urad dal and rajma overnight, pressure cook, then simmer with tomato, ginger, garlic and cream.', 'Indian', 'dal', 1, 1, 1, 8, 0, 0, 1, 1, 21),
    ('Chole (Punjabi)', 'Chickpeas in a tangy onion-tomato masala.', 'Soak chickpeas overnight, pressure cook, then simmer with onion, tomato and chole spices.', 'Indian', 'dal', 1, 1, 1, 8, 0, 0, 1, 1, 21),
    ('Punjabi Kadhi', 'Yogurt and besan curry, gently spiced.', 'Whisk curd with besan, simmer with turmeric and temper with cumin and red chili.', 'Indian', 'dal', 1, 0, 0, 0, 1, 0, 1, 1, 21),
    ('Palak Paneer', 'Paneer cubes in a smooth spinach gravy.', 'Blanch and blend spinach, cook with onion, garlic and ginger, then add paneer.', 'Indian', 'sabzi', 1, 1, 0, 0, 1, 0, 1, 1, 21),
    ('Matar Paneer', 'Peas and paneer in a tomato-onion gravy.', 'Cook onion-tomato masala, add peas and paneer and simmer until tender.', 'Indian', 'sabzi', 1, 0, 0, 0, 1, 0, 1, 1, 21),
    ('Paneer Butter Masala', 'Paneer in a mildly sweet-tart tomato and cream gravy.', 'Simmer blended tomato with butter and spices, then add paneer and cream.', 'Indian', 'sabzi', 1, 0, 0, 0, 1, 0, 1, 1, 21),
    ('Kadai Paneer', 'Paneer and bell pepper tossed in a coarse kadai masala.', 'Saute bell pepper and onion, add ground kadai spices, tomato and paneer.', 'Indian', 'sabzi', 1, 0, 0, 0, 0, 0, 1, 1, 21),
    ('Aloo Methi', 'Potato with fresh fenugreek leaves.', 'Saute potato with cumin, add chopped methi and cook until dry.', 'Indian', 'sabzi', 1, 0, 0, 0, 1, 0, 1, 1, 21),
    ('Aloo Matar', 'Potato and peas in a light tomato gravy.', 'Cook potato and peas with onion, tomato and spices until tender.', 'Indian', 'sabzi', 1, 0, 0, 0, 1, 0, 1, 1, 21),
    ('Aloo Baingan', 'Potato and eggplant stir-fried with spices.', 'Saute potato and baingan with cumin, turmeric and coriander until soft.', 'Indian', 'sabzi', 1, 0, 0, 0, 0, 0, 1, 1, 21),
    ('Bhindi Do Pyaza', 'Okra cooked with onion in two stages.', 'Fry bhindi until crisp, then toss with sauteed onion and spices.', 'Indian', 'sabzi', 1, 0, 0, 0, 0, 0, 1, 1, 21),
    ('Lauki Kofta', 'Bottle gourd dumplings in a light gravy.', 'Grate lauki, bind with besan, fry into koftas and simmer in tomato gravy.', 'Indian', 'sabzi', 1, 0, 0, 0, 1, 0, 1, 1, 21),
    ('Karela Masala', 'Bitter gourd with onion and spices.', 'Slice and salt karela, squeeze, then saute with onion and spices.', 'Indian', 'sabzi', 1, 0, 0, 0, 0, 0, 1, 1, 21),
    ('Kaddu Sabzi', 'Pumpkin cooked with fenugreek seeds and mild spices.', 'Temper with fenugreek seeds, add pumpkin cubes and cook covered until soft.', 'Indian', 'sabzi', 1, 0, 0, 0, 1, 0, 1, 1, 21),
    ('Tinda Masala', 'Round gourd in a simple onion-tomato masala.', 'Peel and quarter tinda, cook with onion, tomato and spices until tender.', 'Indian', 'sabzi', 1, 0, 0, 0, 1, 0, 1, 1, 21),
    ('Beetroot Poriyal', 'Grated beetroot stir-fried with mustard and coconut.', 'Temper mustard seeds, add grated beetroot and cook, then finish with coconut.', 'Indian', 'sabzi', 1, 0, 0, 0, 1, 0, 1, 1, 21),
    ('Mushroom Matar', 'Mushrooms and peas in a spiced onion-tomato gravy.', 'Saute mushrooms, then cook with peas and onion-tomato masala.', 'Indian', 'sabzi', 1, 0, 0, 0, 0, 0, 1, 1, 21),
    ('Broccoli Aloo', 'Broccoli florets with potato, dry-style.', 'Saute potato until half done, add broccoli and spices and cook until tender-crisp.', 'Indian', 'sabzi', 1, 0, 0, 0, 1, 0, 1, 1, 21),
    ('Gobi Matar', 'Cauliflower and peas cooked dry with cumin.', 'Saute cauliflower and peas with cumin, turmeric and coriander.', 'Indian', 'sabzi', 1, 0, 0, 0, 1, 0, 1, 1, 21),
    ('Patta Gobi Sabzi', 'Shredded cabbage with mustard and turmeric.', 'Temper mustard, add shredded cabbage and cook until just tender.', 'Indian', 'sabzi', 1, 0, 0, 0, 1, 0, 1, 1, 21),
    ('Green Beans Poriyal', 'Green beans with coconut and mustard.', 'Temper mustard, add chopped beans and cook, then finish with coconut.', 'Indian', 'sabzi', 1, 0, 0, 0, 1, 0, 1, 1, 21),
    ('Methi Malai Matar', 'Peas and fenugreek in a mild cream gravy.', 'Saute methi, add cashew-onion paste, peas and a splash of cream.', 'Indian', 'sabzi', 1, 0, 0, 0, 0, 0, 1, 1, 21),
    ('Vegetable Pulao', 'Basmati rice cooked with carrot and whole spices.', 'Saute whole spices and vegetables, add soaked rice and water, and cook until fluffy.', 'Indian', 'rice', 1, 0, 0, 0, 1, 0, 1, 1, 21),
    ('Jeera Rice', 'Basmati rice tempered with cumin.', 'Temper cumin in oil, add soaked basmati and water, and cook until fluffy.', 'Indian', 'rice', 1, 0, 0, 0, 1, 0, 1, 1, 21),
    ('Vegetable Biryani', 'Layered basmati rice with cauliflower and peas.', 'Par-cook rice, layer with spiced cauliflower and peas, and steam.', 'Indian', 'rice', 1, 0, 0, 0, 0, 0, 1, 1, 21),
    ('Butter Chicken', 'Tandoori-style chicken in a creamy tomato gravy.', 'Marinate chicken in curd and spices, cook, then simmer in tomato-butter gravy with cream.', 'Indian', 'curry', 0, 1, 1, 4, 0, 0, 1, 1, 21),
    ('Chicken Curry', 'Everyday onion-tomato chicken curry.', 'Brown onion, add ginger-garlic, tomato and spices, then simmer chicken until tender.', 'Indian', 'curry', 0, 1, 0, 0, 0, 0, 1, 1, 21),
    ('Chicken Tikka Masala', 'Grilled chicken tikka in a spiced tomato gravy.', 'Marinate chicken in curd and spices, grill, then simmer in masala gravy.', 'Indian', 'curry', 0, 0, 1, 4, 0, 0, 1, 1, 21),
    ('Kadai Chicken', 'Chicken with bell pepper in a coarse kadai masala.', 'Saute bell pepper and onion, add kadai spices, tomato and chicken, and cook until done.', 'Indian', 'curry', 0, 0, 0, 0, 0, 0, 1, 1, 21),
    ('Palak Chicken', 'Chicken cooked in a spinach gravy.', 'Blend blanched spinach, cook with onion-garlic masala, then add chicken and simmer.', 'Indian', 'curry', 0, 0, 0, 0, 0, 0, 1, 1, 21),
    ('Methi Chicken', 'Chicken with fresh fenugreek leaves.', 'Cook onion-tomato masala, add chicken and chopped methi and simmer.', 'Indian', 'curry', 0, 0, 0, 0, 0, 0, 1, 1, 21),
    ('Chicken Biryani', 'Layered basmati rice with marinated chicken.', 'Marinate chicken in curd and spices, par-cook rice, layer both and steam on low heat.', 'Indian', 'rice', 0, 0, 1, 4, 0, 0, 1, 1, 21),
    ('Tandoori Chicken', 'Chicken marinated in curd and spices, roasted until charred.', 'Marinate chicken for six hours, then roast or grill until cooked through.', 'Indian', 'curry', 0, 0, 1, 6, 0, 0, 1, 1, 21),
    ('Chicken Korma', 'Chicken in a mild cashew and yogurt gravy.', 'Cook chicken with fried onion, curd and ground nuts on low heat.', 'Indian', 'curry', 0, 0, 0, 0, 0, 0, 1, 1, 21),
    ('Chicken Do Pyaza', 'Chicken with onions added at two stages.', 'Cook chicken in onion masala, then add quartered onion near the end.', 'Indian', 'curry', 0, 0, 0, 0, 0, 0, 1, 1, 21),
    ('Chicken Keema', 'Minced chicken cooked dry with spices.', 'Cook onion, ginger and garlic, add minced chicken and spices and cook until dry.', 'Indian', 'curry', 0, 1, 0, 0, 0, 0, 1, 1, 21),
    ('Keema Matar', 'Minced mutton with peas.', 'Cook mutton mince with onion-tomato masala, add peas and finish dry.', 'Indian', 'curry', 0, 1, 0, 0, 0, 0, 1, 1, 21),
    ('Mutton Rogan Josh', 'Kashmiri-style mutton in a red chili and yogurt gravy.', 'Marinate mutton, then cook slowly with whole spices and gravy until tender.', 'Indian', 'curry', 0, 1, 1, 4, 0, 0, 1, 1, 21),
    ('Mutton Curry', 'Slow-cooked mutton in an onion gravy.', 'Brown onion, add ginger-garlic and spices, then pressure cook mutton until tender.', 'Indian', 'curry', 0, 1, 0, 0, 0, 0, 1, 1, 21),
    ('Saag Gosht', 'Mutton cooked with spinach.', 'Cook mutton with onion masala, then add blended spinach and simmer.', 'Indian', 'curry', 0, 0, 0, 0, 0, 0, 1, 1, 21),
    ('Egg Curry', 'Boiled eggs in an onion-tomato gravy.', 'Make onion-tomato masala, add halved boiled eggs and simmer briefly.', 'Indian', 'curry', 0, 0, 0, 0, 1, 0, 1, 1, 21),
    ('Egg Bhurji', 'Scrambled eggs with onion, tomato and green chili.', 'Saute onion, tomato and chili, then add beaten eggs and scramble.', 'Indian', 'curry', 0, 0, 0, 0, 1, 0, 1, 1, 21),
    ('Fish Curry', 'Fish in a tangy tomato and onion gravy.', 'Make masala with onion and tomato, add fish and simmer gently for a few minutes.', 'Indian', 'curry', 0, 0, 0, 0, 0, 0, 1, 1, 21),
    ('Goan Fish Curry', 'Fish in a coconut and red chili gravy.', 'Grind coconut with chilies, simmer with tamarind and add fish near the end.', 'Indian', 'curry', 0, 0, 0, 0, 0, 0, 1, 1, 21),
    ('Prawn Masala', 'Prawns in a thick onion-tomato masala.', 'Cook masala until oil separates, add prawns and cook for a few minutes.', 'Indian', 'curry', 0, 0, 0, 0, 0, 0, 1, 1, 21);

INSERT OR IGNORE INTO recipe_item (recipe_id, item_id, role)
SELECT r.id, i.id, x.role
FROM (
    SELECT 'Dal Tadka' AS recipe, 'Toor Dal' AS item, 'REQUIRED' AS role
    UNION ALL SELECT 'Dal Tadka', 'Onion', 'OPTIONAL'
    UNION ALL SELECT 'Dal Tadka', 'Tomato', 'OPTIONAL'
    UNION ALL SELECT 'Dal Tadka', 'Garlic', 'OPTIONAL'
    UNION ALL SELECT 'Dal Tadka', 'Cumin', 'OPTIONAL'
    UNION ALL SELECT 'Dal Makhani', 'Urad Dal', 'REQUIRED'
    UNION ALL SELECT 'Dal Makhani', 'Rajma', 'REQUIRED'
    UNION ALL SELECT 'Dal Makhani', 'Cream', 'OPTIONAL'
    UNION ALL SELECT 'Dal Makhani', 'Tomato', 'OPTIONAL'
    UNION ALL SELECT 'Dal Makhani', 'Ginger', 'OPTIONAL'
    UNION ALL SELECT 'Dal Makhani', 'Garlic', 'OPTIONAL'
    UNION ALL SELECT 'Chole (Punjabi)', 'Kabuli Chana', 'REQUIRED'
    UNION ALL SELECT 'Chole (Punjabi)', 'Onion', 'OPTIONAL'
    UNION ALL SELECT 'Chole (Punjabi)', 'Tomato', 'OPTIONAL'
    UNION ALL SELECT 'Chole (Punjabi)', 'Ginger', 'OPTIONAL'
    UNION ALL SELECT 'Chole (Punjabi)', 'Garam Masala', 'OPTIONAL'
    UNION ALL SELECT 'Punjabi Kadhi', 'Curd', 'REQUIRED'
    UNION ALL SELECT 'Punjabi Kadhi', 'Besan', 'REQUIRED'
    UNION ALL SELECT 'Punjabi Kadhi', 'Cumin', 'OPTIONAL'
    UNION ALL SELECT 'Punjabi Kadhi', 'Turmeric', 'OPTIONAL'
    UNION ALL SELECT 'Punjabi Kadhi', 'Onion', 'OPTIONAL'
    UNION ALL SELECT 'Palak Paneer', 'Spinach', 'REQUIRED'
    UNION ALL SELECT 'Palak Paneer', 'Paneer', 'REQUIRED'
    UNION ALL SELECT 'Palak Paneer', 'Onion', 'OPTIONAL'
    UNION ALL SELECT 'Palak Paneer', 'Garlic', 'OPTIONAL'
    UNION ALL SELECT 'Palak Paneer', 'Ginger', 'OPTIONAL'
    UNION ALL SELECT 'Palak Paneer', 'Cream', 'OPTIONAL'
    UNION ALL SELECT 'Matar Paneer', 'Peas', 'REQUIRED'
    UNION ALL SELECT 'Matar Paneer', 'Paneer', 'REQUIRED'
    UNION ALL SELECT 'Matar Paneer', 'Onion', 'OPTIONAL'
    UNION ALL SELECT 'Matar Paneer', 'Tomato', 'OPTIONAL'
    UNION ALL SELECT 'Matar Paneer', 'Garam Masala', 'OPTIONAL'
    UNION ALL SELECT 'Paneer Butter Masala', 'Paneer', 'REQUIRED'
    UNION ALL SELECT 'Paneer Butter Masala', 'Tomato', 'OPTIONAL'
    UNION ALL SELECT 'Paneer Butter Masala', 'Cream', 'OPTIONAL'
    UNION ALL SELECT 'Paneer Butter Masala', 'Kasuri Methi', 'OPTIONAL'
    UNION ALL SELECT 'Kadai Paneer', 'Bell Pepper', 'REQUIRED'
    UNION ALL SELECT 'Kadai Paneer', 'Paneer', 'REQUIRED'
    UNION ALL SELECT 'Kadai Paneer', 'Onion', 'OPTIONAL'
    UNION ALL SELECT 'Kadai Paneer', 'Tomato', 'OPTIONAL'
    UNION ALL SELECT 'Kadai Paneer', 'Coriander Powder', 'OPTIONAL'
    UNION ALL SELECT 'Aloo Methi', 'Methi', 'REQUIRED'
    UNION ALL SELECT 'Aloo Methi', 'Potato', 'REQUIRED'
    UNION ALL SELECT 'Aloo Methi', 'Garlic', 'OPTIONAL'
    UNION ALL SELECT 'Aloo Methi', 'Green Chili', 'OPTIONAL'
    UNION ALL SELECT 'Aloo Matar', 'Peas', 'REQUIRED'
    UNION ALL SELECT 'Aloo Matar', 'Potato', 'REQUIRED'
    UNION ALL SELECT 'Aloo Matar', 'Onion', 'OPTIONAL'
    UNION ALL SELECT 'Aloo Matar', 'Tomato', 'OPTIONAL'
    UNION ALL SELECT 'Aloo Matar', 'Cumin', 'OPTIONAL'
    UNION ALL SELECT 'Aloo Baingan', 'Baingan', 'REQUIRED'
    UNION ALL SELECT 'Aloo Baingan', 'Potato', 'REQUIRED'
    UNION ALL SELECT 'Aloo Baingan', 'Onion', 'OPTIONAL'
    UNION ALL SELECT 'Aloo Baingan', 'Tomato', 'OPTIONAL'
    UNION ALL SELECT 'Bhindi Do Pyaza', 'Bhindi', 'REQUIRED'
    UNION ALL SELECT 'Bhindi Do Pyaza', 'Onion', 'REQUIRED'
    UNION ALL SELECT 'Bhindi Do Pyaza', 'Tomato', 'OPTIONAL'
    UNION ALL SELECT 'Bhindi Do Pyaza', 'Coriander Powder', 'OPTIONAL'
    UNION ALL SELECT 'Lauki Kofta', 'Lauki', 'REQUIRED'
    UNION ALL SELECT 'Lauki Kofta', 'Besan', 'REQUIRED'
    UNION ALL SELECT 'Lauki Kofta', 'Onion', 'OPTIONAL'
    UNION ALL SELECT 'Lauki Kofta', 'Tomato', 'OPTIONAL'
    UNION ALL SELECT 'Lauki Kofta', 'Garam Masala', 'OPTIONAL'
    UNION ALL SELECT 'Karela Masala', 'Karela', 'REQUIRED'
    UNION ALL SELECT 'Karela Masala', 'Onion', 'OPTIONAL'
    UNION ALL SELECT 'Karela Masala', 'Turmeric', 'OPTIONAL'
    UNION ALL SELECT 'Karela Masala', 'Coriander Powder', 'OPTIONAL'
    UNION ALL SELECT 'Kaddu Sabzi', 'Kaddu', 'REQUIRED'
    UNION ALL SELECT 'Kaddu Sabzi', 'Turmeric', 'OPTIONAL'
    UNION ALL SELECT 'Kaddu Sabzi', 'Red Chili Powder', 'OPTIONAL'
    UNION ALL SELECT 'Kaddu Sabzi', 'Cumin', 'OPTIONAL'
    UNION ALL SELECT 'Tinda Masala', 'Tinda', 'REQUIRED'
    UNION ALL SELECT 'Tinda Masala', 'Onion', 'OPTIONAL'
    UNION ALL SELECT 'Tinda Masala', 'Tomato', 'OPTIONAL'
    UNION ALL SELECT 'Tinda Masala', 'Coriander Powder', 'OPTIONAL'
    UNION ALL SELECT 'Beetroot Poriyal', 'Beetroot', 'REQUIRED'
    UNION ALL SELECT 'Beetroot Poriyal', 'Coconut', 'OPTIONAL'
    UNION ALL SELECT 'Beetroot Poriyal', 'Mustard Seeds', 'OPTIONAL'
    UNION ALL SELECT 'Mushroom Matar', 'Mushroom', 'REQUIRED'
    UNION ALL SELECT 'Mushroom Matar', 'Peas', 'OPTIONAL'
    UNION ALL SELECT 'Mushroom Matar', 'Onion', 'OPTIONAL'
    UNION ALL SELECT 'Mushroom Matar', 'Tomato', 'OPTIONAL'
    UNION ALL SELECT 'Broccoli Aloo', 'Broccoli', 'REQUIRED'
    UNION ALL SELECT 'Broccoli Aloo', 'Potato', 'REQUIRED'
    UNION ALL SELECT 'Broccoli Aloo', 'Garlic', 'OPTIONAL'
    UNION ALL SELECT 'Broccoli Aloo', 'Cumin', 'OPTIONAL'
    UNION ALL SELECT 'Gobi Matar', 'Cauliflower', 'REQUIRED'
    UNION ALL SELECT 'Gobi Matar', 'Peas', 'OPTIONAL'
    UNION ALL SELECT 'Gobi Matar', 'Ginger', 'OPTIONAL'
    UNION ALL SELECT 'Gobi Matar', 'Cumin', 'OPTIONAL'
    UNION ALL SELECT 'Patta Gobi Sabzi', 'Cabbage', 'REQUIRED'
    UNION ALL SELECT 'Patta Gobi Sabzi', 'Mustard Seeds', 'OPTIONAL'
    UNION ALL SELECT 'Patta Gobi Sabzi', 'Turmeric', 'OPTIONAL'
    UNION ALL SELECT 'Patta Gobi Sabzi', 'Green Chili', 'OPTIONAL'
    UNION ALL SELECT 'Green Beans Poriyal', 'Green Beans', 'REQUIRED'
    UNION ALL SELECT 'Green Beans Poriyal', 'Coconut', 'OPTIONAL'
    UNION ALL SELECT 'Green Beans Poriyal', 'Mustard Seeds', 'OPTIONAL'
    UNION ALL SELECT 'Methi Malai Matar', 'Methi', 'REQUIRED'
    UNION ALL SELECT 'Methi Malai Matar', 'Peas', 'REQUIRED'
    UNION ALL SELECT 'Methi Malai Matar', 'Cream', 'OPTIONAL'
    UNION ALL SELECT 'Methi Malai Matar', 'Onion', 'OPTIONAL'
    UNION ALL SELECT 'Vegetable Pulao', 'Basmati Rice', 'REQUIRED'
    UNION ALL SELECT 'Vegetable Pulao', 'Carrot', 'REQUIRED'
    UNION ALL SELECT 'Vegetable Pulao', 'Peas', 'OPTIONAL'
    UNION ALL SELECT 'Vegetable Pulao', 'Green Beans', 'OPTIONAL'
    UNION ALL SELECT 'Vegetable Pulao', 'Cumin', 'OPTIONAL'
    UNION ALL SELECT 'Jeera Rice', 'Basmati Rice', 'REQUIRED'
    UNION ALL SELECT 'Jeera Rice', 'Cumin', 'OPTIONAL'
    UNION ALL SELECT 'Vegetable Biryani', 'Basmati Rice', 'REQUIRED'
    UNION ALL SELECT 'Vegetable Biryani', 'Cauliflower', 'REQUIRED'
    UNION ALL SELECT 'Vegetable Biryani', 'Peas', 'OPTIONAL'
    UNION ALL SELECT 'Vegetable Biryani', 'Curd', 'OPTIONAL'
    UNION ALL SELECT 'Vegetable Biryani', 'Garam Masala', 'OPTIONAL'
    UNION ALL SELECT 'Butter Chicken', 'Chicken', 'REQUIRED'
    UNION ALL SELECT 'Butter Chicken', 'Curd', 'OPTIONAL'
    UNION ALL SELECT 'Butter Chicken', 'Cream', 'OPTIONAL'
    UNION ALL SELECT 'Butter Chicken', 'Kasuri Methi', 'OPTIONAL'
    UNION ALL SELECT 'Butter Chicken', 'Tomato', 'OPTIONAL'
    UNION ALL SELECT 'Chicken Curry', 'Chicken', 'REQUIRED'
    UNION ALL SELECT 'Chicken Curry', 'Onion', 'OPTIONAL'
    UNION ALL SELECT 'Chicken Curry', 'Tomato', 'OPTIONAL'
    UNION ALL SELECT 'Chicken Curry', 'Ginger', 'OPTIONAL'
    UNION ALL SELECT 'Chicken Curry', 'Garlic', 'OPTIONAL'
    UNION ALL SELECT 'Chicken Curry', 'Garam Masala', 'OPTIONAL'
    UNION ALL SELECT 'Chicken Tikka Masala', 'Chicken', 'REQUIRED'
    UNION ALL SELECT 'Chicken Tikka Masala', 'Curd', 'OPTIONAL'
    UNION ALL SELECT 'Chicken Tikka Masala', 'Tomato', 'OPTIONAL'
    UNION ALL SELECT 'Chicken Tikka Masala', 'Cream', 'OPTIONAL'
    UNION ALL SELECT 'Chicken Tikka Masala', 'Kasuri Methi', 'OPTIONAL'
    UNION ALL SELECT 'Kadai Chicken', 'Chicken', 'REQUIRED'
    UNION ALL SELECT 'Kadai Chicken', 'Bell Pepper', 'REQUIRED'
    UNION ALL SELECT 'Kadai Chicken', 'Onion', 'OPTIONAL'
    UNION ALL SELECT 'Kadai Chicken', 'Tomato', 'OPTIONAL'
    UNION ALL SELECT 'Kadai Chicken', 'Coriander Powder', 'OPTIONAL'
    UNION ALL SELECT 'Palak Chicken', 'Chicken', 'REQUIRED'
    UNION ALL SELECT 'Palak Chicken', 'Spinach', 'REQUIRED'
    UNION ALL SELECT 'Palak Chicken', 'Onion', 'OPTIONAL'
    UNION ALL SELECT 'Palak Chicken', 'Garlic', 'OPTIONAL'
    UNION ALL SELECT 'Palak Chicken', 'Ginger', 'OPTIONAL'
    UNION ALL SELECT 'Methi Chicken', 'Chicken', 'REQUIRED'
    UNION ALL SELECT 'Methi Chicken', 'Methi', 'REQUIRED'
    UNION ALL SELECT 'Methi Chicken', 'Onion', 'OPTIONAL'
    UNION ALL SELECT 'Methi Chicken', 'Tomato', 'OPTIONAL'
    UNION ALL SELECT 'Methi Chicken', 'Kasuri Methi', 'OPTIONAL'
    UNION ALL SELECT 'Chicken Biryani', 'Chicken', 'REQUIRED'
    UNION ALL SELECT 'Chicken Biryani', 'Basmati Rice', 'REQUIRED'
    UNION ALL SELECT 'Chicken Biryani', 'Curd', 'OPTIONAL'
    UNION ALL SELECT 'Chicken Biryani', 'Onion', 'OPTIONAL'
    UNION ALL SELECT 'Chicken Biryani', 'Garam Masala', 'OPTIONAL'
    UNION ALL SELECT 'Tandoori Chicken', 'Chicken', 'REQUIRED'
    UNION ALL SELECT 'Tandoori Chicken', 'Curd', 'OPTIONAL'
    UNION ALL SELECT 'Tandoori Chicken', 'Ginger', 'OPTIONAL'
    UNION ALL SELECT 'Tandoori Chicken', 'Garlic', 'OPTIONAL'
    UNION ALL SELECT 'Tandoori Chicken', 'Red Chili Powder', 'OPTIONAL'
    UNION ALL SELECT 'Chicken Korma', 'Chicken', 'REQUIRED'
    UNION ALL SELECT 'Chicken Korma', 'Curd', 'OPTIONAL'
    UNION ALL SELECT 'Chicken Korma', 'Onion', 'OPTIONAL'
    UNION ALL SELECT 'Chicken Korma', 'Cream', 'OPTIONAL'
    UNION ALL SELECT 'Chicken Do Pyaza', 'Chicken', 'REQUIRED'
    UNION ALL SELECT 'Chicken Do Pyaza', 'Onion', 'REQUIRED'
    UNION ALL SELECT 'Chicken Do Pyaza', 'Tomato', 'OPTIONAL'
    UNION ALL SELECT 'Chicken Do Pyaza', 'Garam Masala', 'OPTIONAL'
    UNION ALL SELECT 'Chicken Keema', 'Chicken', 'REQUIRED'
    UNION ALL SELECT 'Chicken Keema', 'Onion', 'OPTIONAL'
    UNION ALL SELECT 'Chicken Keema', 'Ginger', 'OPTIONAL'
    UNION ALL SELECT 'Chicken Keema', 'Garlic', 'OPTIONAL'
    UNION ALL SELECT 'Chicken Keema', 'Green Chili', 'OPTIONAL'
    UNION ALL SELECT 'Keema Matar', 'Mutton', 'REQUIRED'
    UNION ALL SELECT 'Keema Matar', 'Peas', 'REQUIRED'
    UNION ALL SELECT 'Keema Matar', 'Onion', 'OPTIONAL'
    UNION ALL SELECT 'Keema Matar', 'Tomato', 'OPTIONAL'
    UNION ALL SELECT 'Keema Matar', 'Ginger', 'OPTIONAL'
    UNION ALL SELECT 'Keema Matar', 'Garlic', 'OPTIONAL'
    UNION ALL SELECT 'Mutton Rogan Josh', 'Mutton', 'REQUIRED'
    UNION ALL SELECT 'Mutton Rogan Josh', 'Curd', 'OPTIONAL'
    UNION ALL SELECT 'Mutton Rogan Josh', 'Red Chili Powder', 'OPTIONAL'
    UNION ALL SELECT 'Mutton Rogan Josh', 'Ginger', 'OPTIONAL'
    UNION ALL SELECT 'Mutton Curry', 'Mutton', 'REQUIRED'
    UNION ALL SELECT 'Mutton Curry', 'Onion', 'OPTIONAL'
    UNION ALL SELECT 'Mutton Curry', 'Tomato', 'OPTIONAL'
    UNION ALL SELECT 'Mutton Curry', 'Ginger', 'OPTIONAL'
    UNION ALL SELECT 'Mutton Curry', 'Garlic', 'OPTIONAL'
    UNION ALL SELECT 'Mutton Curry', 'Garam Masala', 'OPTIONAL'
    UNION ALL SELECT 'Saag Gosht', 'Mutton', 'REQUIRED'
    UNION ALL SELECT 'Saag Gosht', 'Spinach', 'REQUIRED'
    UNION ALL SELECT 'Saag Gosht', 'Onion', 'OPTIONAL'
    UNION ALL SELECT 'Saag Gosht', 'Ginger', 'OPTIONAL'
    UNION ALL SELECT 'Saag Gosht', 'Garlic', 'OPTIONAL'
    UNION ALL SELECT 'Egg Curry', 'Eggs', 'REQUIRED'
    UNION ALL SELECT 'Egg Curry', 'Onion', 'OPTIONAL'
    UNION ALL SELECT 'Egg Curry', 'Tomato', 'OPTIONAL'
    UNION ALL SELECT 'Egg Curry', 'Garam Masala', 'OPTIONAL'
    UNION ALL SELECT 'Egg Bhurji', 'Eggs', 'REQUIRED'
    UNION ALL SELECT 'Egg Bhurji', 'Onion', 'OPTIONAL'
    UNION ALL SELECT 'Egg Bhurji', 'Tomato', 'OPTIONAL'
    UNION ALL SELECT 'Egg Bhurji', 'Green Chili', 'OPTIONAL'
    UNION ALL SELECT 'Egg Bhurji', 'Cilantro', 'OPTIONAL'
    UNION ALL SELECT 'Fish Curry', 'Fish', 'REQUIRED'
    UNION ALL SELECT 'Fish Curry', 'Onion', 'OPTIONAL'
    UNION ALL SELECT 'Fish Curry', 'Tomato', 'OPTIONAL'
    UNION ALL SELECT 'Fish Curry', 'Turmeric', 'OPTIONAL'
    UNION ALL SELECT 'Fish Curry', 'Red Chili Powder', 'OPTIONAL'
    UNION ALL SELECT 'Goan Fish Curry', 'Fish', 'REQUIRED'
    UNION ALL SELECT 'Goan Fish Curry', 'Coconut', 'REQUIRED'
    UNION ALL SELECT 'Goan Fish Curry', 'Red Chili Powder', 'OPTIONAL'
    UNION ALL SELECT 'Goan Fish Curry', 'Turmeric', 'OPTIONAL'
    UNION ALL SELECT 'Goan Fish Curry', 'Mustard Seeds', 'OPTIONAL'
    UNION ALL SELECT 'Prawn Masala', 'Prawns', 'REQUIRED'
    UNION ALL SELECT 'Prawn Masala', 'Onion', 'OPTIONAL'
    UNION ALL SELECT 'Prawn Masala', 'Tomato', 'OPTIONAL'
    UNION ALL SELECT 'Prawn Masala', 'Ginger', 'OPTIONAL'
    UNION ALL SELECT 'Prawn Masala', 'Garlic', 'OPTIONAL'
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
