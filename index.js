require("dotenv").config();
const express = require("express");
const cors = require("cors");
const Amadeus = require("amadeus");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Initialize Amadeus API
const amadeus = new Amadeus({
  clientId: process.env.AMADEUS_API_KEY,
  clientSecret: process.env.AMADEUS_API_SECRET,
});

// Flight Search API
app.get("/search-flights", async (req, res) => {
  const { origin, destination, date, adults = 1 } = req.query;

  if (!origin || !destination || !date) {
    return res.status(400).json({ error: "Missing required parameters" });
  }

  try {
    const response = await amadeus.shopping.flightOffersSearch.get({
      originLocationCode: origin,
      destinationLocationCode: destination,
      departureDate: date,
      adults,
      currencyCode: "USD",
      max: 2, // Limit results
    });

    res.json({ flights: response.data });
  } catch (error) {
    console.error("Error fetching flights:", error.response?.data || error);
    res.status(500).json({ error: "Failed to fetch flights" });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
