const express = require("express");
const router = express.Router();
const db = require("../db/connection");

router.get("/data", async (req, res) => {
  try {
    res.json(await db.all("SELECT * FROM meal"));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/getKidsMenu", async (req, res) => {
  try {
    res.json(
      await db.all(
        "SELECT MEAL_TIME, MEAL_TYPE, MEAL_NAME, DAY_OF_WEEK FROM meal ORDER BY MEAL_TIME DESC"
      )
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
