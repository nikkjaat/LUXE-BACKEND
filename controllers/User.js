const express = require("express");
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

exports.userLogin = async (req, res, next) => {
  try {
    // Find user by email
    const user = await User.findOne({ email: req.body.email }).select(
      "+password"
    );
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if password matches
    const isPasswordValid = await user.comparePassword(req.body.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid password" });
    }

    if (user.role !== req.body.role) {
      return res.status(403).json({ message: "Unauthorized role" });
    }

    // Generate JWT token with secret key from env file
    const token = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET_KEY,
      { expiresIn: process.env.JWT_EXPIRE }
    );

    // send token with response
    res.status(200).json({
      message: "User logged in successfully",
      token,
      user,
    });
  } catch (error) {
    console.error("❌ Login error:", error.message);
    return res
      .status(500)
      .json({ message: "User login failed", error: error.message });
  }
};

exports.userSignup = async (req, res, next) => {
  try {
    const user = await User.create({
      name: req.body.name,
      email: req.body.email,
      password: req.body.password,
      role: req.body.role || "customer", // Default to 'customer' if not provided
      avatar:
        req.body.avatar ||
        "https://images.pexels.com/photos/2379004/pexels-photo-2379004.jpeg?auto=compress&cs=tinysrgb&w=150", // Default avatar URL
    });

    res.status(200).json({
      message: "User created successfully",
      user,
    });
  } catch (error) {
    res.status(400).json("Error creating user:", error);
  }
};

// exports.userSignup = async (req, res, next) => {
//   try {
//     // Check if user already exists
//     const existingUser = await User.findOne({ email: req.body.email });
//     if (existingUser) {
//       return res.status(400).json({ message: "User already exists" });
//     }

//     // Hash the password before saving
//     const hashedPassword = await bcrypt.hash(req.body.password, 10);

//     const user = await User.create({
//       name: req.body.name,
//       email: req.body.email,
//       password: hashedPassword,
//       role: req.body.role || "customer",
//       avatar:
//         "https://images.pexels.com/photos/2379004/pexels-photo-2379004.jpeg?auto=compress&cs=tinysrgb&w=150",
//     });

//     // console.log("✅ User created:", user);

//     res.status(201).json({
//       message: "User created successfully",
//       user,
//     });
//   } catch (error) {
//     console.error("❌ Signup error:", error.message);
//     res
//       .status(500)
//       .json({ message: "User signup failed", error: error.message });
//   }
// };

exports.getUserDetails = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId);
    res.status(200).json({ success: true, user });
  } catch (error) {}
};
