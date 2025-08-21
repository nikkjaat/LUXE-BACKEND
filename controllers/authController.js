const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../models/User.js");
const { sendEmail } = require("../Utils/sendMail.js");

// Generate JWT Token
const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET_KEY, {
    expiresIn: process.env.JWT_EXPIRE,
  });
};

// Send token response
const sendTokenResponse = (user, statusCode, res) => {
  const token = signToken(user._id);

  const options = {
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  };

  res.status(statusCode).cookie("token", token, options).json({
    success: true,
    token,
    user,
  });
};

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res, next) => {
  try {
    const { name, email, password, role, vendorInfo } = req.body;

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      // If existing user is a customer and now applying as vendor
      if (existingUser.role === "customer" && role === "vendor" && vendorInfo) {
        existingUser.vendorInfo = {
          shopName: vendorInfo.shopName,
          businessType: vendorInfo.businessType,
          status: "pending",
        };
        await existingUser.save();

        return res.status(200).json({
          success: true,
          message: "Vendor application submitted, awaiting approval.",
          user: existingUser,
        });
      }

      // If they already exist as vendor or role mismatch
      return res.status(400).json({
        success: false,
        message: "User already exists with this email",
      });
    }

    // Create new user if not exists
    const userData = {
      name,
      email,
      password,
      role: "customer",
    };

    if (role === "vendor" && vendorInfo) {
      userData.vendorInfo = {
        shopName: vendorInfo.shopName,
        businessType: vendorInfo.businessType,
        status: "pending",
      };
    }

    const user = await User.create(userData);

    const verificationToken = crypto.randomBytes(20).toString("hex");
    // await sendVerificationEmail(user.email, verificationToken);

    sendTokenResponse(user, 201, res);
  } catch (error) {
    next(error);
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res, next) => {
  console.log(req.body)
  try {
    const { email, password, role } = req.body;

    // Check for user
    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      return res.status(409).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    if (user.role !== role) {
      return res.status(401).json({
        success: false,
        message: "Role mismatch",
      });
    }

    // Check if password matches
    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    sendTokenResponse(user, 200, res);
  } catch (error) {
    next(error);
  }
};

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Public
const logout = async (req, res, next) => {
  try {
    res.cookie("token", "none", {
      expires: new Date(Date.now() + 10 * 1000),
      httpOnly: true,
    });

    res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
const updateProfile = async (req, res, next) => {
  try {
    const fieldsToUpdate = {
      name: req.body.name,
      phone: req.body.phone,
      address: req.body.address,
      dateOfBirth: req.body.dateOfBirth,
    };

    // Remove undefined fields
    Object.keys(fieldsToUpdate).forEach(
      (key) => fieldsToUpdate[key] === undefined && delete fieldsToUpdate[key]
    );

    const user = await User.findByIdAndUpdate(req.user.id, fieldsToUpdate, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Change password
// @route   PUT /api/auth/change-password
// @access  Private
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user.id).select("+password");

    // Check current password
    const isMatch = await user.comparePassword(currentPassword);

    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    user.password = newPassword;
    await user.save();

    sendTokenResponse(user, 200, res);
  } catch (error) {
    next(error);
  }
};

// @desc    Forgot password
// @route   POST /api/auth/forgot-password
// @access  Public
const forgotPassword = async (req, res, next) => {
  try {
    const user = await User.findOne({ email: req.body.email });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found with this email",
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(20).toString("hex");

    // Hash token and set to resetPasswordToken field
    const resetPasswordToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    // Set expire
    const resetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Save to user (you'll need to add these fields to User model)
    // user.resetPasswordToken = resetPasswordToken;
    // user.resetPasswordExpire = resetPasswordExpire;
    // await user.save();

    // Create reset url
    const resetUrl = `${req.protocol}://${req.get(
      "host"
    )}/api/auth/reset-password/${resetToken}`;

    const message = `You are receiving this email because you (or someone else) has requested the reset of a password. Please make a PUT request to: \n\n ${resetUrl}`;

    try {
      // await sendEmail({
      //   email: user.email,
      //   subject: 'Password reset token',
      //   message
      // });

      res.status(200).json({
        success: true,
        message: "Email sent",
      });
    } catch (err) {
      console.log(err);
      // user.resetPasswordToken = undefined;
      // user.resetPasswordExpire = undefined;
      // await user.save();

      return res.status(500).json({
        success: false,
        message: "Email could not be sent",
      });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Reset password
// @route   PUT /api/auth/reset-password/:resettoken
// @access  Public
const resetPassword = async (req, res, next) => {
  try {
    // Get hashed token
    const resetPasswordToken = crypto
      .createHash("sha256")
      .update(req.params.token)
      .digest("hex");

    // Find user by token (you'll need to implement this)
    // const user = await User.findOne({
    //   resetPasswordToken,
    //   resetPasswordExpire: { $gt: Date.now() }
    // });

    // if (!user) {
    //   return res.status(400).json({
    //     success: false,
    //     message: 'Invalid token'
    //   });
    // }

    // Set new password
    // user.password = req.body.password;
    // user.resetPasswordToken = undefined;
    // user.resetPasswordExpire = undefined;
    // await user.save();

    // sendTokenResponse(user, 200, res);

    res.status(200).json({
      success: true,
      message: "Password reset functionality to be implemented",
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Verify email
// @route   GET /api/auth/verify-email/:token
// @access  Public
const verifyEmail = async (req, res, next) => {
  try {
    // Implement email verification logic
    res.status(200).json({
      success: true,
      message: "Email verification functionality to be implemented",
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  logout,
  getMe,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword,
  verifyEmail,
};
