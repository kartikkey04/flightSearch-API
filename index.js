require("dotenv").config();
const express = require("express");
const Amadeus = require("amadeus");

const app = express();
const PORT = process.env.PORT || 8000;
app.use(express.json());

// Initialize Amadeus FIRST
const amadeus = new Amadeus({
  clientId: process.env.AMADEUS_API_KEY,
  clientSecret: process.env.AMADEUS_API_SECRET,
});

async function getLocationCode(input) {
  try {
    // Check for valid airport code first (3 letters)
    if (input.length === 3) {
      const airportResponse = await amadeus.referenceData.locations.get({
        keyword: input,
        subType: "AIRPORT",
        view: "LIGHT"
      });

      // Find exact IATA code match
      const exactMatch = airportResponse.data.find(
        loc => loc.iataCode === input.toUpperCase()
      );
      
      if (exactMatch) return exactMatch.iataCode;
    }

    // If not found, search as city/airport name
    const locationResponse = await amadeus.referenceData.locations.get({
      keyword: input,
      subType: "AIRPORT,CITY",
      view: "LIGHT"
    });

    // Priority: Airport > City
    const bestMatch = locationResponse.data.find(loc => 
      loc.subType === "AIRPORT" || loc.subType === "CITY"
    );

    return bestMatch?.iataCode || null;

  } catch (error) {
    console.error(`Conversion error for ${input}:`, error);
    return null;
  }
}

app.get("/search-flights", async (req, res) => {
  let { origin, destination, date, adults = 1 } = req.query;

  try {
    // Convert both origin and destination
    [origin, destination] = await Promise.all([
      getLocationCode(origin),
      getLocationCode(destination)
    ]);

    console.log(`Final codes - Origin: ${origin}, Destination: ${destination}`);

    if (!origin || !destination || !date) {
      return res.status(400).json({
        error: "Invalid parameters",
        details: `Could not resolve: ${!origin ? 'Origin' : ''} ${!destination ? 'Destination' : ''}`
      });
    }

    const response = await amadeus.shopping.flightOffersSearch.get({
      originLocationCode: origin,
      destinationLocationCode: destination,
      departureDate: date,
      adults,
      currencyCode: "USD",
      max: 5
    });

    const formattedFlights = response.data.map(flight => ({
      id: flight.id,
      price: `${flight.price.currency} ${flight.price.grandTotal}`,
      itineraries: flight.itineraries.map(itinerary => ({
        duration: itinerary.duration,
        segments: itinerary.segments.map(segment => ({
          departure: `${segment.departure.iataCode} (${segment.departure.at})`,
          arrival: `${segment.arrival.iataCode} (${segment.arrival.at})`,
          airline: segment.carrierCode,
          duration: segment.duration
        }))
      }))
    }));

    res.json({ flights: formattedFlights });

  } catch (error) {
    console.error("Search error:", error);
    res.status(500).json({
      error: "Flight search failed",
      details: error.response?.data || error.message
    });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));