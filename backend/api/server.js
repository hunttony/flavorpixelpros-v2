const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const validator = require('validator');
require('dotenv').config();

// CORS wrapper for the entire Express app
const allowCors = (fn) => async (req, res) => {
  console.log(`Processing ${req.method} request for ${req.path}`);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Origin, X-Requested-With, Accept'
  );
  res.setHeader('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') {
    console.log('Handling OPTIONS preflight request');
    res.status(200).end();
    return;
  }
  return await fn(req, res);
};

// Initialize Express app
const app = express();
const port = process.env.PORT || 8080;

// Apply CORS middleware as fallback
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Origin', 'X-Requested-With', 'Accept'],
  credentials: true
}));
app.use(express.json());

// MongoDB connection
const mongoURI = process.env.MONGO_URI;
mongoose.connect(mongoURI, {})
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error:', err));

// Define Mongoose schema for contact form
const contactSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    trim: true,
    validate: {
      validator: (value) => validator.isEmail(value),
      message: 'Please enter a valid email address',
    },
  },
  message: {
    type: String,
    required: true,
    trim: true,
    validate: {
      validator: (value) => value.length <= 1000,
      message: 'Message cannot exceed 1000 characters',
    },
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Create Mongoose model
const Contact = mongoose.model('Contact', contactSchema);

// Root endpoint to display welcome message
app.get('/', (req, res) => {
  res.status(200).send(`
    <html>
      <head>
        <title>Contact Form Server</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
          h1 { color: #333; }
          p { color: #666; }
        </style>
      </head>
      <body>
        <h1>Welcome to the Contact Form Server</h1>
        <p>The server is running properly. Use the contact form to send messages.</p>
        <p>Check server status at <a href="/health">/health</a></p>
      </body>
    </html>
  `);
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    message: 'Server is running properly',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// POST /contact endpoint to save form data
app.post('/contact', async (req, res) => {
  console.log('Received POST request for /contact:', req.body);
  let { name, email, message } = req.body;

  // Sanitize inputs
  name = validator.escape(name).trim();
  email = validator.normalizeEmail(email.trim());
  message = validator.escape(message).trim();

  // Basic validation
  if (!name || !email || !message) {
    console.log('Validation failed: Missing fields');
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    // Create new contact document
    const newContact = new Contact({
      name,
      email,
      message,
    });

    // Save to MongoDB
    await newContact.save();
    console.log('Saved form data:', { name, email, message });

    // Respond with success
    res.status(200).json({ message: 'Message received and saved successfully' });
  } catch (error) {
    console.error('Error saving to MongoDB:', error);
    res.status(500).json({ error: 'Failed to save message. Please try again.' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Wrap the entire app with allowCors
module.exports = allowCors(app);