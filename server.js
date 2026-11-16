// ------------------------------------------------------------
// ZoningAI server
// ------------------------------------------------------------

// Load required packages
require("dotenv").config();
const express = require("express");
const path = require("path");
const cheerio = require("cheerio");

// Create the Express application
const app = express();

// Allow the server to receive JSON
app.use(express.json());

// Serve the HTML, CSS and browser JavaScript files
app.use(express.static(path.join(__dirname, "public")));

// ------------------------------------------------------------
// Helper: query one Toronto ArcGIS zoning layer
// ------------------------------------------------------------

async function queryTorontoLayer(layerId, longitude, latitude) {
  const baseUrl =
    `https://gis.toronto.ca/arcgis/rest/services/` +
    `cot_geospatial11/MapServer/${layerId}/query`;

  const pointGeometry = {
    x: Number(longitude),
    y: Number(latitude),
    spatialReference: {
      wkid: 4326
    }
  };

  const params = new URLSearchParams({
    f: "json",
    where: "1=1",
    outFields: "*",
    returnGeometry: "false",
    geometry: JSON.stringify(pointGeometry),
    geometryType: "esriGeometryPoint",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects"
  });

  const response = await fetch(`${baseUrl}?${params.toString()}`);

  if (!response.ok) {
    throw new Error(
      `Toronto GIS request failed for layer ${layerId}.`
    );
  }

  const data = await response.json();

  if (data.error) {
    throw new Error(
      data.error.message || `ArcGIS error for layer ${layerId}.`
    );
  }

  if (!data.features || data.features.length === 0) {
    return null;
  }

  return data.features[0].attributes;
}

// ------------------------------------------------------------
// Helper: extract only the applicable site-specific exception
// ------------------------------------------------------------

function extractSpecificException(pageText, anchor) {
  if (!pageText || !anchor) {
    return null;
  }

  const cleanText = pageText
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  /*
   * Example anchor:
   * 900.3.10(613)
   *
   * The anchor may appear once in the table of contents and again
   * where the actual exception begins. We use the last occurrence.
   */
  let startIndex = cleanText.lastIndexOf(anchor);

  if (startIndex === -1) {
    return null;
  }

  const numberMatch = anchor.match(/\((\d+)\)/);

  if (!numberMatch) {
    return cleanText.slice(startIndex, startIndex + 5000).trim();
  }

  const currentNumber = Number(numberMatch[1]);

  /*
   * Search for the next exception heading, such as:
   * 900.3.10(614)
   *
   * Using a regular expression is safer than assuming formatting
   * will be exactly identical.
   */
  const textAfterStart = cleanText.slice(
    startIndex + anchor.length
  );

  const nextExceptionPattern =
    /900\.3\.10\(\d+\)/g;

  let nextMatch;
  let endIndex = cleanText.length;

  while (
    (nextMatch = nextExceptionPattern.exec(textAfterStart)) !== null
  ) {
    const matchedNumberText = nextMatch[0].match(/\((\d+)\)/);

    if (!matchedNumberText) {
      continue;
    }

    const matchedNumber = Number(matchedNumberText[1]);

    if (matchedNumber > currentNumber) {
      endIndex =
        startIndex +
        anchor.length +
        nextMatch.index;

      break;
    }
  }

  return cleanText
    .slice(startIndex, endIndex)
    .trim();
}

// ------------------------------------------------------------
// Helper: download an applicable Toronto zoning by-law page
// ------------------------------------------------------------

async function fetchTorontoBylawPage(relativeLink) {
  if (!relativeLink) {
    console.log(pageText.substring(0, 5000));
    return null;
  }

  // Example:
  // Chapter10_20.htm
  // Chapter900_3.htm#900.3.10(613)

  const [fileName, anchor] = relativeLink.split("#");

  const pageUrl =
    "https://www.toronto.ca/zoning/bylaw_amendments/" +
    `ZBL_NewProvision_${fileName}`;

  const response = await fetch(pageUrl, {
    headers: {
      "User-Agent": "ZoningAI learning application"
    }
  });

  if (!response.ok) {
    throw new Error(
      `Toronto by-law page could not be loaded. Status: ${response.status}`
    );
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  // Remove content that is not part of the by-law text
  $("script, style, nav, header, footer, noscript").remove();

  const pageText = $("body")
    .text()
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n/g, "\n\n")
    .trim();

  const applicableExceptionText =
  anchor
    ? extractSpecificException(pageText, anchor)
    : null;

return {
  url: anchor ? `${pageUrl}#${anchor}` : pageUrl,
  anchor: anchor || null,
  text: pageText,
  applicableExceptionText
};
}

function extractBylawSections(text) {
  if (!text) {
    return {};
  }

  const cleanText = text.replace(/\s+/g, " ").trim();

  function findSection(startTerms, endTerms) {
    let startIndex = -1;

    for (const term of startTerms) {
      const index = cleanText.toLowerCase().indexOf(term.toLowerCase());

      if (index !== -1 && (startIndex === -1 || index < startIndex)) {
        startIndex = index;
      }
    }

    if (startIndex === -1) {
      return null;
    }

    let endIndex = cleanText.length;

    for (const term of endTerms) {
      const index = cleanText
        .toLowerCase()
        .indexOf(term.toLowerCase(), startIndex + 1);

      if (index !== -1 && index < endIndex) {
        endIndex = index;
      }
    }

    return cleanText.slice(startIndex, endIndex).trim();
  }

  return {
    permittedUses: findSection(
      ["Permitted Uses"],
      ["Lot Requirements", "Principal Building Requirements"]
    ),

    lotRequirements: findSection(
      ["Lot Requirements"],
      ["Principal Building Requirements", "Yards"]
    ),

    buildingRequirements: findSection(
      ["Principal Building Requirements"],
      ["Yards", "Ancillary Buildings"]
    ),

    yardsAndSetbacks: findSection(
      ["Yards"],
      ["Ancillary Buildings", "Parking"]
    ),

    accessoryStructures: findSection(
      ["Ancillary Buildings", "Ancillary Buildings and Structures"],
      ["Parking", "Bicycle Parking"]
    ),

    parking: findSection(
      ["Parking"],
      ["Bicycle Parking", "Loading"]
    )
  };
}

// ------------------------------------------------------------
// Route 1: address to latitude and longitude
// ------------------------------------------------------------

app.post("/api/geocode", async (req, res) => {
  try {
    const address = req.body.address;

    if (!address || !address.trim()) {
      return res.status(400).json({
        success: false,
        message: "Please enter a property address."
      });
    }

    const geocodeUrl =
      "https://nominatim.openstreetmap.org/search" +
      "?format=json" +
      "&addressdetails=1" +
      "&limit=1" +
      "&countrycodes=ca" +
      "&q=" +
      encodeURIComponent(address);

    const response = await fetch(geocodeUrl, {
      headers: {
        "User-Agent": "ZoningAI learning application"
      }
    });

    if (!response.ok) {
      throw new Error("The geocoding service request failed.");
    }

    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Address not found."
      });
    }

    const matchedLocation = data[0];

    res.json({
      success: true,
      address: matchedLocation.display_name,
      latitude: matchedLocation.lat,
      longitude: matchedLocation.lon,
      addressDetails: matchedLocation.address || {}
    });
  } catch (error) {
    console.error("Geocoding error:", error);

    res.status(500).json({
      success: false,
      message: "The address lookup failed."
    });
  }
});

// ------------------------------------------------------------
// Route 2: latitude and longitude to Toronto zoning layers
// ------------------------------------------------------------

app.post("/api/zoning", async (req, res) => {
  try {
    const { latitude, longitude } = req.body;

    if (
      latitude === undefined ||
      longitude === undefined ||
      Number.isNaN(Number(latitude)) ||
      Number.isNaN(Number(longitude))
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid latitude and longitude are required."
      });
    }

    const [
      zoningArea,
      heightOverlay,
      lotCoverageOverlay,
      policyAreaOverlay,
      setbackOverlay,
      parkingOverlay
    ] = await Promise.all([
      queryTorontoLayer(3, longitude, latitude),
      queryTorontoLayer(9, longitude, latitude),
      queryTorontoLayer(10, longitude, latitude),
      queryTorontoLayer(13, longitude, latitude),
      queryTorontoLayer(59, longitude, latitude),
      queryTorontoLayer(61, longitude, latitude)
    ]);

    res.json({
      success: true,
      source: "City of Toronto ArcGIS MapServer",
      layers: {
        zoningArea,
        heightOverlay,
        lotCoverageOverlay,
        policyAreaOverlay,
        setbackOverlay,
        parkingOverlay
      }
    });
  } catch (error) {
    console.error("Zoning lookup error:", error);

    res.status(500).json({
      success: false,
      message: "The Toronto zoning lookup failed."
    });
  }
});

// ------------------------------------------------------------
// Route 3: download applicable zoning by-law pages
// ------------------------------------------------------------

app.post("/api/bylaw", async (req, res) => {
  try {
    const { sectionLink, exceptionLink } = req.body;

    if (!sectionLink && !exceptionLink) {
      return res.status(400).json({
        success: false,
        message: "No applicable by-law links were provided."
      });
    }

    const [zoneSection, exceptionSection] = await Promise.all([
      sectionLink
        ? fetchTorontoBylawPage(sectionLink)
        : Promise.resolve(null),

      exceptionLink
        ? fetchTorontoBylawPage(exceptionLink)
        : Promise.resolve(null)
    ]);

    // Combine both pages into one string
    const combinedText = [
      zoneSection?.text || "",
      exceptionSection?.text || ""
    ].join(" ");

    // Extract the major zoning sections
    const extractedSections = extractBylawSections(combinedText);

    res.json({
      success: true,
      source: "City of Toronto Zoning By-law 569-2013",

      zoneSection,

      exceptionSection,

      extractedSections
    });

  } catch (error) {
    console.error("By-law lookup error:", error);

    res.status(500).json({
      success: false,
      message: "The applicable Toronto by-law text could not be loaded."
    });
  }
});

// ------------------------------------------------------------
// Start the server
// ------------------------------------------------------------

const PORT = 3000;

// ------------------------------------------------------------
// Generate a structured zoning and site-plan report with Gemini
// ------------------------------------------------------------

async function generateGeminiSitePlanReport(input) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is missing. Add it to the .env file and restart the server."
    );
  }

  const {
    address,
    zoning,
    bylaw,
    lot,
    proposedBuilding
  } = input;

  const prompt = `
You are assisting with a preliminary City of Toronto zoning review.

Prepare a concise, professional zoning and conceptual site-plan report.

IMPORTANT RULES:

1. Use only the information supplied below.
2. Do not invent zoning requirements.
3. Do not assume a missing dimension.
4. Clearly identify missing information.
5. The drawing is conceptual and is not a legal survey, permit drawing,
   construction drawing, or professional zoning opinion.
6. Distinguish official zoning values from conceptual calculations.
7. A site-specific exception may modify the base zoning requirements.
8. If the official exception text is unavailable, state that it must be reviewed.
9. Do not say that a proposed building complies unless enough information is supplied.
10. Provide numbers as numbers without unnecessary unit text where the JSON field
    already identifies the unit.

PROPERTY INFORMATION:
${JSON.stringify(
  {
    address,
    zoning,
    bylaw,
    lot,
    proposedBuilding
  },
  null,
  2
)}

Prepare:

- a zoning summary;
- a summary of the site-specific exception;
- a conceptual site-plan explanation;
- a list of zoning requirements used;
- a preliminary compliance review;
- a list of missing information;
- warnings and limitations;
- short drawing notes suitable for displaying beside a conceptual site plan.
`;

  const responseSchema = {
    type: "OBJECT",
    properties: {
      reportTitle: {
        type: "STRING"
      },
      address: {
        type: "STRING"
      },
      zoningSummary: {
        type: "STRING"
      },
      exceptionSummary: {
        type: "STRING"
      },
      sitePlanSummary: {
        type: "STRING"
      },
      requirements: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            requirement: {
              type: "STRING"
            },
            value: {
              type: "STRING"
            },
            source: {
              type: "STRING"
            },
            status: {
              type: "STRING"
            }
          },
          required: [
            "requirement",
            "value",
            "source",
            "status"
          ]
        }
      },
      complianceReview: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            item: {
              type: "STRING"
            },
            required: {
              type: "STRING"
            },
            proposed: {
              type: "STRING"
            },
            result: {
              type: "STRING"
            },
            explanation: {
              type: "STRING"
            }
          },
          required: [
            "item",
            "required",
            "proposed",
            "result",
            "explanation"
          ]
        }
      },
      drawingNotes: {
        type: "ARRAY",
        items: {
          type: "STRING"
        }
      },
      missingInformation: {
        type: "ARRAY",
        items: {
          type: "STRING"
        }
      },
      warnings: {
        type: "ARRAY",
        items: {
          type: "STRING"
        }
      },
      conclusion: {
        type: "STRING"
      }
    },
    required: [
      "reportTitle",
      "address",
      "zoningSummary",
      "exceptionSummary",
      "sitePlanSummary",
      "requirements",
      "complianceReview",
      "drawingNotes",
      "missingInformation",
      "warnings",
      "conclusion"
    ]
  };

  const model = "gemini-2.5-flash";

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/` +
    `${model}:generateContent`;

  const geminiResponse = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: prompt
            }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema,
        temperature: 0.2
      }
    })
  });

  const responseData = await geminiResponse.json();

  if (!geminiResponse.ok) {
    console.error("Gemini API error:", responseData);

    const message =
      responseData?.error?.message ||
      "Gemini was unable to generate the report.";

    throw new Error(message);
  }

  const responseText =
    responseData?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!responseText) {
    throw new Error("Gemini returned an empty response.");
  }

  try {
    return JSON.parse(responseText);
  } catch (error) {
    console.error("Invalid Gemini JSON:", responseText);
    throw new Error("Gemini returned invalid report data.");
  }
}

// ------------------------------------------------------------
// Gemini zoning and conceptual site-plan report endpoint
// ------------------------------------------------------------

app.post("/api/ai-site-plan-report", async (req, res) => {
  try {
    const {
      address,
      zoning,
      bylaw,
      lot,
      proposedBuilding
    } = req.body;

    if (!address) {
      return res.status(400).json({
        error: "Property address is required."
      });
    }

    if (!zoning) {
      return res.status(400).json({
        error: "Zoning information is required."
      });
    }

    if (!lot) {
      return res.status(400).json({
        error: "Lot information is required."
      });
    }

    const report = await generateGeminiSitePlanReport({
      address,
      zoning,
      bylaw: bylaw || {},
      lot,
      proposedBuilding: proposedBuilding || {}
    });

    res.json({
      success: true,
      report
    });
  } catch (error) {
    console.error("AI report error:", error);

    res.status(500).json({
      success: false,
      error: error.message || "Unable to generate the report."
    });
  }
});

app.listen(PORT, () => {
  console.log(`ZoningAI running at http://localhost:${PORT}`);
});
