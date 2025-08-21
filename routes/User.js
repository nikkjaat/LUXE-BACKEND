const express = require("express");
const router = express.Router();

const {
  userLogin,
  userSignup,
  getUserDetails,
} = require("../controllers/User");
const isAuth = require("../middleware/isAuth");

router.post("/login", userLogin);
router.post("/signup", userSignup);
router.get("/getuserdetails", isAuth, getUserDetails);

module.exports = router;
