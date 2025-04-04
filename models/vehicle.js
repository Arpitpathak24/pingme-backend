const mongoose = require('mongoose');

// Define the Vehicle schema
const vehicleSchema = new mongoose.Schema({
    vehicleNumber: { type: String, required: true },
    vehicleType: { type: String, required: true },
    brandModel: { type: String, required: true },
    registrationYear: { type: Number, required: true },
    documentPath: { type: String, required: true }, // Path to the uploaded document
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true } // Reference to the user
});

// Create the Vehicle model
const Vehicle = mongoose.model('Vehicle', vehicleSchema);

module.exports = Vehicle;