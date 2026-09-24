const express = require("express");

const {
  retrieveJwt,
  decodeJwt,
  serviceToken,
  getServiceBinding,
} = require("@sap-cloud-sdk/connectivity");

const app = express();

app.get("/destinations", async (req, res) => {
  try {
    const jwt = retrieveJwt(req);

    if (!jwt) {
      return res.status(401).json({
        error: "No JWT received",
      });
    }

    const userJwt = decodeJwt(jwt);

    // Get Destination Service token in CONSUMER tenant context
    const token = await serviceToken("destination", {
      jwt,
    });

    const destinationJwt = decodeJwt(token);

    console.log("User tenant:", userJwt.zid);
    console.log("Destination token tenant:", destinationJwt.zid);

    // Get bound Destination Service
    const binding = getServiceBinding("destination");

    console.log("Destination binding:", binding.name);

    const baseUrl =
      binding.credentials.uri ||
      binding.credentials.url;

    const response = await fetch(
      `${baseUrl}/destination-configuration/v1/subaccountDestinations`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const body = await response.text();

    if (!response.ok) {
      throw new Error(
        `Destination Service returned ${response.status}: ${body}`
      );
    }

    const destinations = JSON.parse(body);

    res.json({
      userTenant: userJwt.zid,
      destinationTokenTenant: destinationJwt.zid,
      destinations,
    });
  } catch (error) {
    console.error("ERROR:", error);

    res.status(500).json({
      error: error.message,
    });
  }
});

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Destination reader running on ${port}`);
});