Calendar

Populate calendar once a year
indian calendar
US calendar
oncall
School calendar

Browse Calendar -> find good opportunity for vacation(sneak 4 days window ), apply leaves for festival. if oncall, then flag it

How do I navigate to lunch/dinner plan?

I will go and lookup in the freeze-> look at leftover -> anything left
yes -> enough for X(check days to find how many people are going to eat today) people ?
no -> check what app has?
green veggie or lintel ?

Add 2 things in recipe / inventory? veggy_type and count

veggy_type (dry/wet) in recipe "table", that will decide the rule
if type=dry; then need one lintel
if type=wet; no supplemental meal needed. Curry lasts 3 meal.

Weekday and (no vacation or no holiday) find out from calendar.
if day in (Tues, Fri);
skip kids meal, they will eat in school

    else
        call kids_menu() -> lunch for kids
            this will lookup kids_menu set for school tiffin, follow rules for veg/non-veg
            this has a list of 10 items.

    if day in (monday, x) and not an oncall week (lookup oncall calendar)
        sandy will take tiffin
           call office_meal() (this will have a list of 4 items)
            check inventory, get qualified recipe, present all (max4)

Weekend including friday and (no vacation or no holiday or no festival)
call weekend special for veg
call weekend special for nonveg
