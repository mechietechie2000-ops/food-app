Calendar

Populate calendar once a year
indian calendar
US calendar
oncall
School calendar

Browse Calendar -> find good opportunity for vacation(sneak 4 days window ), apply leaves for festival. if oncall, then flag it

How do I navigate to lunch/dinner plan?

I will go and lookup in the freeze-> look at leftover -> anything left
    yes -> enough for X people (check days to find how many people are going to eat today)?
    no -> check what app has?
        green veggie or lintel ?

Add 2 things in recipe / inventory? veggy_type and mealcount

veggy_type (dry/wet) in recipe "table", that will decide the rule about green vegetables on consecutive days or not
if type=dry; then need one lintel, next day could be another green wet curry
if type=wet; no supplemental meal needed. Curry lasts 3 meals.

mealcount - May not be use now, but in future to decide how much would be sufficient for X people from leftover lookup 

if today is Weekday and (no vacation or no holiday - find out from calendar)
    if day in (Tues, Fri (days configurable))
        skip kids meal, they will eat in school
    else
        call kids_menu() -> lunch for kids
            this will lookup kids_menu set for school tiffin, follow rules for veg/non-veg
            this has a list of 10 items.

    if day in (monday, x) and not an oncall week (lookup oncall calendar)
        X will bring tiffin to office
           call office_meal() (this will have a list of 4 items)
            check inventory, get qualified recipe, present all (max4)

if today is Weekend including friday and (no vacation or no holiday or no festival)
    call weekend special for veg - look up dishes marked for weekend specials
    call weekend special for nonveg - look up dishes marked for weekend specials


On the bottom nav, 
    move the + from topbar to bottom 
    add a hamburger icon -> that takes to an new page -> that will have 
    push notification
    sign out
    theme change light, dark, system
    and other features as we move forward

Topbar (floating) should have "Food Planner" title only italics or some catchy font little bigger size, 
    when the page scroll down the title should disappear.


so the landing pages will only have the Day's UI card with Menu printed on them
the skipped/cooked /other should look like buttons with different styling

make a UI card for show inventory, navigated from hamburger

Automatic weekly generation and scheduled push/catch-up workflows were not added.