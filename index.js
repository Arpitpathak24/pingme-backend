require('dotenv').config();
const express = require('express');
const app = express();
const path = require('path');
const nodemailer = require('nodemailer');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const mongoose = require('mongoose');
const User = require('./models/User');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const Vehicle = require('./models/vehicle');
const cors = require('cors');

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('Connected to MongoDB Atlas'))
    .catch((err) => console.error('MongoDB Connection Error:', err));

app.use(express.urlencoded({ extended: true }));
app.use(express.json()); // To handle JSON bodies

// Session setup
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    store: MongoStore.create({
        mongoUrl: process.env.MONGO_URI, // Use your MongoDB URI here
        collectionName: 'sessions', // Optional, default is 'sessions'
        ttl: 14 * 24 * 60 * 60 // Session expiration time (2 weeks)
    })
}));

// CORS
app.use(cors({
    origin: 'https://pingme-frontend.vercel.app',
    credentials: true
}));

// Static files (like images, downloads, etc.)
app.use(express.static(path.join(__dirname, 'public')));

// Auth middleware
function isAuthenticated(req, res, next) {
    if (req.session.isLoggedIn) return next();
    res.status(401).json({ message: 'Unauthorized' });
}

// ✅ API home route
app.get('/', (req, res) => {
    res.send('PingMe Backend is Live 🚀');
});

// ================== AUTH ROUTES ==================

// Signup
app.post('/signup', async (req, res) => {
    const { username, email, password } = req.body;
    try {
        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(400).json({ message: 'User already exists' });

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ username, email, password: hashedPassword });
        await newUser.save();

        res.status(201).json({ message: 'Signup successful' });
    } catch (error) {
        console.error('Signup error:', error); // Add more specific error logging
        res.status(500).json({ message: 'Signup failed', error: error.message }); // Include error details in the response
    }
});


// Login
app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ message: 'User not found' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: 'Invalid password' });

        req.session.isLoggedIn = true;
        req.session.user = user;
        res.status(200).json({ message: 'Login successful', user });
    } catch (error) {
        console.error('Login error:', error.message); // Enhanced logging
        res.status(500).json({ message: 'Login failed', error: error.message });
    }
});

// Logout
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) return res.status(500).json({ message: 'Logout failed', error: err.message });
        res.status(200).json({ message: 'Logged out successfully' });
    });
});

// Forgot Password
app.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    const resetToken = Math.random().toString(36).substring(2, 15);

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.GMAIL_USER, // Now using environment variable
            pass: process.env.GMAIL_PASS  // Using environment variable for password
        }
    });

    const mailOptions = {
        from: process.env.GMAIL_USER,
        to: email,
        subject: 'Password Reset Request',
        html: `<h1>Password Reset</h1><p>Click the link below to reset your password:</p><a href="https://pingme-frontend.vercel.app/reset-password?token=${resetToken}">Reset Password</a>`
    };

    try {
        await transporter.sendMail(mailOptions);
        res.status(200).json({ message: 'Reset link sent' });
    } catch (error) {
        console.error('Email error:', error.message);
        res.status(500).json({ message: 'Failed to send email', error: error.message });
    }
});

// Reset Password
app.post('/reset-password', async (req, res) => {
    const { token, newPassword } = req.body;
    console.log(`Token: ${token}, New Password: ${newPassword}`);
    // You can store/verify tokens in DB here
    res.status(200).json({ message: 'Password updated (not implemented)' });
});

// ================== VEHICLE & PAYMENT ==================

// Uploads
const upload = multer({ dest: 'uploads/' });

app.post('/vehicle-details', isAuthenticated, upload.single('documents'), async (req, res) => {
    const { vehicleNumber, vehicleType, brandModel, registrationYear } = req.body;
    try {
        const newVehicle = new Vehicle({
            vehicleNumber,
            vehicleType,
            brandModel,
            registrationYear,
            documentPath: req.file.path,
            userId: req.session.user._id
        });
        await newVehicle.save();
        res.status(201).json({ message: 'Vehicle saved' });
    } catch (error) {
        console.error('Vehicle save error:', error.message);
        res.status(500).json({ message: 'Failed to save vehicle', error: error.message });
    }
});

// Dummy Payment
app.post('/process-payment', isAuthenticated, async (req, res) => {
    try {
        await new Promise(resolve => setTimeout(resolve, 2000));
        const isSuccess = Math.random() > 0.2;
        if (isSuccess) return res.status(200).json({ message: 'Payment successful' });
        res.status(400).json({ message: 'Payment failed' });
    } catch (error) {
        console.error('Payment error:', error.message);
        res.status(500).json({ message: 'Payment failed', error: error.message });
    }
});

// Download Sticker
app.get('/download-sticker', isAuthenticated, (req, res) => {
    const filePath = path.join(__dirname, 'stickers', 'sticker.png');
    res.download(filePath, 'sticker.png', (err) => {
        if (err) {
            console.error('Sticker download error:', err.message);
            res.status(500).json({ message: 'Download failed', error: err.message });
        }
    });
});

// ================== MISC ROUTES ==================
app.get('/check-session', (req, res) => {
    if (req.session.isLoggedIn) {
        res.status(200).json({ loggedIn: true, user: req.session.user });
    } else {
        res.status(200).json({ loggedIn: false });
    }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`PingMe backend live on port ${PORT}`));
