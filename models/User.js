const mongoose = require('mongoose');

// Define the User schema
const userSchema = new mongoose.Schema({
    username: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true } // Store hashed passwords
});

// Create the User model
const User = mongoose.model('User', userSchema);

module.exports = User;