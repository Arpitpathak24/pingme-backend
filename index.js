require('dotenv').config();
const express = require('express');
const app = express();
const path = require('path');
const nodemailer = require('nodemailer');
const session = require('express-session');
const mongoose = require('mongoose');
const User = require('./models/User');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const Vehicle = require('./models/vehicle');


// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('Connected to MongoDB Atlas');
}).catch((err) => {
    console.error('Error connecting to MongoDB Atlas:', err);
});

// Middleware to parse form data
app.use(express.urlencoded({ extended: true }));

// Configure session middleware
app.use(session({
    secret: process.env.SESSION_SECRET, // Use the secret key from .env
    resave: false,
    saveUninitialized: true
}));

// Middleware to pass user info to all templates
app.use((req, res, next) => {
    res.locals.user = req.session.user || null; // Pass user info or null if not logged in
    next();
});

// Middleware to check if the user is logged in
function isAuthenticated(req, res, next) {
    if (req.session.isLoggedIn) {
        next(); // User is authenticated, proceed to the next middleware/route
    } else {
        res.redirect('/login'); // Redirect to login page if not authenticated
    }
}

// Set EJS as the template engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../frontend'));

// Route to render the home page
app.get('/', (req, res) => {
    const user = req.session.isLoggedIn ? req.session.user : null; // Check if the user is logged in
    res.render('home', { user }); // Pass user info (or null) to the template
});

// Route to render the sign-up page
app.get('/signup', (req, res) => {
    res.render('signup');
});

// Route to handle sign-up form submission
app.post('/signup', async (req, res) => {
    const { username, email, password } = req.body;

    try {
        // Check if the user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).send('User already exists. Please log in.');
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Save the user to the database
        const newUser = new User({ username, email, password: hashedPassword });
        await newUser.save();

        console.log(`New user signed up: ${username}, ${email}`);
        res.redirect('/login'); // Redirect to login page after sign-up
    } catch (error) {
        console.error('Error during sign-up:', error);
        res.status(500).send('Error signing up. Please try again.');
    }
});

// Route to render the login page
app.get('/login', (req, res) => {
    res.render('login');
});

// Route to handle login form submission
app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        // Find the user by email
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).send('User not found. Please sign up.');
        }

        // Compare the provided password with the hashed password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(400).send('Invalid password. Please try again.');
        }

        // Set session after successful login
        req.session.isLoggedIn = true;
        req.session.user = user; // Store user info in the session
        console.log(`User logged in: ${email}`);
        res.redirect('/'); // Redirect to the home page
    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).send('Error logging in. Please try again.');
    }
});

// Route to render the forgot password page
app.get('/forgot-password', (req, res) => {
    res.render('forgot-password');
});

// Route to handle forgot password form submission
app.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    console.log(`Password reset requested for: ${email}`);

    // Generate a mock reset token (in production, use a secure token)
    const resetToken = Math.random().toString(36).substring(2, 15);

    // Create a transporter for sending emails
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: 'arpitpathak2408@gmail.com', // Replace with your email
            pass: 'ypyn jcxm hxfh qysm'         // Replace with the generated App Password
        }
    });

    // Email content
    const mailOptions = {
        from: 'your-email@gmail.com', // Sender address
        to: email, // Recipient address
        subject: 'Password Reset Request',
        html: `
            <h1>Password Reset</h1>
            <p>Click the link below to reset your password:</p>
            <a href="http://localhost:3000/reset-password?token=${resetToken}">Reset Password</a>
        `
    };

    try {
        // Send the email
        await transporter.sendMail(mailOptions);
        console.log(`Password reset email sent to ${email}`);
        res.send('A password reset link has been sent to your email.');
    } catch (error) {
        console.error('Error sending email:', error);
        res.status(500).send('Error sending password reset email.');
    }
});

// Route to render the reset password page
app.get('/reset-password', (req, res) => {
    const { token } = req.query; // Get the token from the query string
    res.render('reset-password', { token });
});

// Route to handle reset password form submission
app.post('/reset-password', (req, res) => {
    const { token, newPassword } = req.body;
    console.log(`Password reset for token: ${token}, new password: ${newPassword}`);
    // Add logic to validate the token and update the password in the database

    // Redirect to the login page after successful password reset
    res.redirect('/login');
});

// Configure multer for file uploads
const upload = multer({ dest: 'uploads/' }); // Files will be saved in the 'uploads' folder

// Route to render the vehicle details page (protected)
app.get('/vehicle-details', isAuthenticated, (req, res) => {
    res.render('vehicle-details', { user: req.session.user });
});

// Route to handle vehicle details form submission
app.post('/vehicle-details', isAuthenticated, upload.single('documents'), async (req, res) => {
    const { vehicleNumber, vehicleType, brandModel, registrationYear } = req.body;
    const documentFile = req.file; // Uploaded file information

    try {
        // Save the vehicle details to the database
        const newVehicle = new Vehicle({
            vehicleNumber,
            vehicleType,
            brandModel,
            registrationYear,
            documentPath: documentFile.path, // Save the file path
            userId: req.session.user._id // Associate the vehicle with the logged-in user
        });

        await newVehicle.save(); // Save the document to the database
        console.log('Vehicle details saved successfully:', newVehicle);

        // Redirect to the payment page after successful submission
        res.redirect('/payment');
    } catch (error) {
        console.error('Error saving vehicle details:', error);
        res.status(500).send('An error occurred while saving vehicle details. Please try again.');
    }
});

// Route to render the payment page (protected)
app.get('/payment', isAuthenticated, (req, res) => {
    res.render('payment', { user: req.session.user });
});

// Route to handle payment processing (dummy payment method)
app.post('/process-payment', isAuthenticated, async (req, res) => {
    try {
        // Simulate payment processing
        console.log('Processing dummy payment for user:', req.session.user);

        // Simulate a delay to mimic real payment processing
        await new Promise((resolve) => setTimeout(resolve, 2000));

        const isPaymentSuccessful = Math.random() > 0.2; // 80% chance of success
        if (isPaymentSuccessful) {
            console.log('Payment successful (dummy)');
            res.redirect('/payment-success');
        } else {
            console.log('Payment failed (dummy)');
            res.status(500).send('Payment failed. Please try again.');
        }
    } catch (error) {
        console.error('Error processing payment:', error);
        res.status(500).send('Payment failed. Please try again.');
    }
});

// Route to render the "Download Sticker" page
app.get('/payment-success', isAuthenticated, (req, res) => {
    res.render('payment-success', { user: req.session.user });
});

// Route to serve the sticker file
app.get('/download-sticker', isAuthenticated, (req, res) => {
    const filePath = path.join(__dirname, 'stickers', 'sticker.png'); // Path to the sticker file
    res.download(filePath, 'sticker.png', (err) => {
        if (err) {
            console.error('Error downloading the sticker:', err);
            res.status(500).send('Error downloading the sticker.');
        }
    });
});

// Route to render the About Us page
app.get('/about', (req, res) => {
    res.render('about');
});

// Route to render the Products page
app.get('/products', (req, res) => {
    res.render('products');
});

// Route to render the Contact Us page
app.get('/contact', (req, res) => {
    res.render('contact');
});

// Route to handle logout
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Error destroying session:', err);
        }
        res.redirect('/'); // Redirect to the home page
    });
});

// Start the server
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});