1. Define the family's cooking rules
Ingredient categories

A. Always available
These don't need inventory tracking:
    Potato
    Onion
    Tomato
    Garlic
    Ginger
    Green chili
    Cilantro
    All dals
    Rice
    Wheat flour
    Common spices
    Oil
    Salt

B. Fresh vegetables
These ARE tracked:
Bhindi
Lauki
Baingan
Gobi
Beans
Carrot
Cabbage
etc.

Core rule
A fresh vegetable is considered available from the date it is purchased until the user marks a recipe containing that vegetable as cooked.

2. Receipt → fresh vegetable extraction
The primary input is now a receipt photo.

The model receives:
Receipt image
It needs to determine:
Store
Purchase date
Items
Then classify each item:
Receipt item
      ↓
Is it a tracked fresh vegetable?
      ↓
YES → inventory
NO  → ignore

Inventory becomes only:
    Bhindi
    Lauki
Everything else is ignored.

3. Handle quantities very simply

You said your family normally cooks the entire purchased portion.

Therefore don't track:
Bhindi: 1.3 lb

Track:
    Bhindi
    Purchase #123
    Available

If the receipt says:
Bhindi 2 lb
you can optionally preserve 2 lb as information, but it doesn't affect the inventory logic.

Important exception
If you buy the same vegetable twice:
    Sep 22 → Bhindi
    Sep 25 → Bhindi
don't combine them.

Keep:
Bhindi
 ├── Purchase Sep 22 → Available
 └── Purchase Sep 25 → Available
This allows the system to use the older purchase first.

4. Recipe database
This is the most important part. Don't ask the LLM to invent recipes. Create an approved recipe database.
Each recipe should contain:

But I'd actually make the recipe structure slightly richer:
{
  "id": "bhindi_masala",
  "name": "Bhindi Masala",

  "required": [
    "bhindi"
  ],

  "optional": [
    "potato"
  ],

  "always_available": [
    "onion",
    "tomato",
    "ginger",
    "garlic",
    "green_chili"
  ],

  "cuisine": "North Indian",

  "meal_type": "sabzi",

  "approved": true
}


5. Recipe matching algorithm

Now we get to the intelligence.
Suppose inventory is:

Available:
    Bhindi
    Lauki
    Baingan
    Cauliflower

The application retrieves approved recipes.
For every recipe:
Rule 1 — Required fresh vegetables

Rule 1 — Required fresh vegetables

If a recipe requires:
    bhindi
and bhindi exists:
    PASS
If it doesn't:
    REJECT

Rule 2 — Multiple required vegetables

Suppose:
Aloo Gobi

required:
    potato
    cauliflower
    Potato is always available.
    Cauliflower is available.

Therefore:
    MATCH

Rule 3 — Optional vegetables

Suppose:
Mixed Vegetable

required:
carrot

optional:
    beans
    peas
    cauliflower
    potato
    If you have:
    carrot
    beans
    cauliflower

the recipe still matches.
The AI can say:
You have carrot, beans and cauliflower available.

6. Freshness becomes a ranking factor
This is where your purchase dates become useful.

Suppose:
    Bhindi — purchased Sep 20
    Lauki — purchased Sep 21
    Baingan — purchased Sep 22

You don't necessarily need exact expiration dates.

Instead maintain a simple preferred-use window for each vegetable.
Example:
    Bhindi       3–5 days
    Lauki        5–7 days
    Baingan      4–6 days
    Cauliflower  5–7 days

Then calculate:
    days_since_purchase
and classify:
    Fresh
    Use Soon
    Old

This should influence which recipes are presented first, but shouldn't automatically delete anything.


7. User asks: "What should I cook?"
This is where the LLM becomes useful.
The backend sends something like:
{
  "available_fresh": [
    {
      "name": "bhindi",
      "purchased": "2026-09-20",
      "age_days": 2
    },
    {
      "name": "lauki",
      "purchased": "2026-09-21",
      "age_days": 1
    },
    {
      "name": "baingan",
      "purchased": "2026-09-22",
      "age_days": 0
    }
  ],

  "approved_recipes": [...]
}

Then ask the model to select from only those recipes.

The model can produce:
What would you like to cook?

        1. Bhindi Masala
        Uses: Bhindi
        Purchased: Sep 20
        Best to use soon

        2. Lauki Chana Dal
        Uses: Lauki
        Purchased: Sep 21

        3. Baingan Bharta
        Uses: Baingan
        Purchased: Sep 22


8. User selects the recipe

User:
    Bhindi Masala

The application does not ask the LLM what was consumed.
The recipe database already knows:
    Bhindi Masala
    → consumes bhindi

Therefore backend executes:
    Bhindi Sep 20
    → USED

Inventory becomes:
    Lauki
    Baingan

That's deterministic and reliable.


9. What happens when you buy vegetables again?

Take another receipt.
    Sep 25
    Bhindi
    Gobi
    Carrot

System adds:
    Bhindi Sep 25
    Gobi Sep 25
    Carrot Sep 25

Now you might have:
    Bhindi Sep 25
    Lauki Sep 21
    Baingan Sep 22
    Gobi Sep 25
    Carrot Sep 25

No complicated quantity calculations.

10. What if you don't cook the whole vegetable?
    This is never the case, if it is then don't consider in coding

11. What if the receipt doesn't identify the vegetable properly?
This is important.
Indian grocery receipts can contain things like:
    VEG 001
    PRODUCE
    LAUKI
    BHNDI

The AI should be allowed to return:
unknown_item
rather than guessing.

Then UI:
I couldn't identify these items:

PRODUCE 001
What is it?
Bhindi | Lauki | Other

Once you correct it, save the mapping:
PRODUCE 001 → Bhindi
for that particular store.

Over time the receipt processing gets better.