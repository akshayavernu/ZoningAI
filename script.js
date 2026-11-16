// ------------------------------------------------------------
// ZoningAI browser JavaScript
// ------------------------------------------------------------

// Text used whenever official information is unavailable
const NOT_FOUND = "Not Found — Verify with Municipality.";

// ------------------------------------------------------------
// Helper: safely insert values into HTML
// ------------------------------------------------------------

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildTorontoBylawUrl(relativeLink) {
  if (!relativeLink) {
    return null;
  }

  const [fileName, anchor] = relativeLink.split("#");

  const baseUrl =
    "https://www.toronto.ca/zoning/bylaw_amendments/" +
    `ZBL_NewProvision_${fileName}`;

  return anchor ? `${baseUrl}#${anchor}` : baseUrl;
}

// ------------------------------------------------------------
// Helper: convert zoning abbreviations into readable names
// ------------------------------------------------------------

function getZoneName(zoneCode) {
  const zoneNames = {
    R: "Residential Zone",
    RD: "Residential Detached Zone",
    RS: "Residential Semi-Detached Zone",
    RT: "Residential Townhouse Zone",
    RM: "Residential Multiple Zone",
    RA: "Residential Apartment Zone",
    CR: "Commercial Residential Zone",
    CRE: "Commercial Residential Employment Zone",
    CL: "Commercial Local Zone",
    E: "Employment Industrial Zone",
    EH: "Employment Heavy Industrial Zone",
    EL: "Employment Light Industrial Zone",
    EO: "Employment Industrial Office Zone",
    O: "Open Space Zone",
    ON: "Open Space Natural Zone",
    OR: "Open Space Recreation Zone",
    I: "Institutional Zone",
    UT: "Utility and Transportation Zone"
  };

  return zoneNames[zoneCode] || NOT_FOUND;
}

// ------------------------------------------------------------
// Helper: create a general zoning-summary row
// ------------------------------------------------------------

function createRow(label, value, source) {
  return `
    <tr>
      <td>${escapeHtml(label)}</td>
      <td>${escapeHtml(value)}</td>
      <td>${escapeHtml(source)}</td>
    </tr>
  `;
}

// ------------------------------------------------------------
// Helper: create an RD requirement row
// ------------------------------------------------------------

function createRequirementRow(label, value, status) {
  return `
    <tr>
      <td>${escapeHtml(label)}</td>
      <td>${escapeHtml(value)}</td>
      <td>${escapeHtml(status)}</td>
    </tr>
  `;
}

function createLinkedRequirementRow(label, value, link, linkText) {
  const linkHtml = link
    ? `
      <a
        href="${escapeHtml(link)}"
        target="_blank"
        rel="noopener noreferrer"
      >
        ${escapeHtml(linkText)}
      </a>
    `
    : escapeHtml(NOT_FOUND);

  return `
    <tr>
      <td>${escapeHtml(label)}</td>
      <td>${escapeHtml(value)}</td>
      <td>${linkHtml}</td>
    </tr>
  `;
}

// ------------------------------------------------------------
// RD side-yard setback based on required zoning frontage
// ------------------------------------------------------------

function getRdSideSetback(frontage) {
  const value = Number(frontage);

  if (!Number.isFinite(value)) {
    return NOT_FOUND;
  }

  if (value < 6) return "0.6 m";
  if (value < 12) return "0.9 m";
  if (value < 15) return "1.2 m";
  if (value < 18) return "1.5 m";
  if (value < 24) return "1.8 m";
  if (value < 30) return "2.4 m";

  return "3.0 m";
}

// ------------------------------------------------------------
// Build a structured RD detached-house requirements summary
// ------------------------------------------------------------

function buildRdRequirements(
  zoning,
  height,
  coverage,
  exceptionSection
) {
  const frontage = Number(zoning?.ZN_FRONTAGE);

  const hasDensityValue =
    zoning?.ZN_FSI_DENSITY !== null &&
    zoning?.ZN_FSI_DENSITY !== undefined &&
    Number(zoning.ZN_FSI_DENSITY) >= 0;

  const hasException =
    zoning?.ZN_EXCPTN === "Y" &&
    zoning?.ZN_EXCPTN_NO !== null &&
    zoning?.ZN_EXCPTN_NO !== undefined;

  return {
    permittedUse:
      "Dwelling unit in a permitted residential building type",

    permittedBuildingTypes:
      "Detached house, duplex, triplex and fourplex. A townhouse or apartment building may also be permitted on a major street, subject to the by-law.",

    secondarySuite:
      "Permitted with conditions under Section 150.10",

    gardenSuite:
      "Permitted with conditions under Section 150.7",

    lanewaySuite:
      "Permitted with conditions under Section 150.8",

    homeOccupation:
      "Permitted with conditions under Section 150.5",

    minimumLotFrontage:
      zoning?.ZN_FRONTAGE !== null &&
      zoning?.ZN_FRONTAGE !== undefined
        ? `${zoning.ZN_FRONTAGE} m`
        : NOT_FOUND,

    minimumLotArea:
      zoning?.ZN_AREA !== null &&
      zoning?.ZN_AREA !== undefined
        ? `${zoning.ZN_AREA} m²`
        : NOT_FOUND,

    maximumHeight:
      height?.HT_HEIGHT !== null &&
      height?.HT_HEIGHT !== undefined
        ? `${height.HT_HEIGHT} m`
        : "10.0 m where no height-overlay value applies",

    maximumStoreys:
      height?.HT_STORIES !== null &&
      height?.HT_STORIES !== undefined &&
      Number(height.HT_STORIES) >= 0
        ? String(height.HT_STORIES)
        : "Not limited by this regulation where no ST value applies",

    maximumLotCoverage:
      coverage?.ZN_COVERAGE !== null &&
      coverage?.ZN_COVERAGE !== undefined
        ? `${coverage.ZN_COVERAGE}%`
        : "No lot-coverage limit identified by the overlay",

    maximumBuildingLength:
      Number.isFinite(frontage) && frontage <= 18
        ? "17.0 m"
        : NOT_FOUND,

    maximumBuildingDepth:
      Number.isFinite(frontage) && frontage <= 18
        ? "Rear main wall may be no more than 19.0 m from the required front-yard setback"
        : NOT_FOUND,

    maximumFsi:
      hasDensityValue
        ? String(zoning.ZN_FSI_DENSITY)
        : "Not limited by this regulation because no “d” value was identified",

    frontYardSetback:
      "6.0 m unless the prevailing front-yard averaging regulation applies",

    rearYardSetback:
      "Greater of 7.5 m or 25% of the actual lot depth",

    interiorSideYardSetback:
      getRdSideSetback(zoning?.ZN_FRONTAGE),

    exteriorSideYardSetback:
      "3.0 m for certain qualifying corner lots; lot configuration must be verified",

    secondStoreyDeck:
      "Maximum 4.0 m² per platform, subject to location and quantity limits",

    siteSpecificException:
  hasException
    ? `Exception ${zoning.ZN_EXCPTN_NO}`
    : "No site-specific exception identified",

siteSpecificExceptionSummary:
  hasException
    ? (
        exceptionSection?.applicableExceptionText ||
        "The exception applies, but its specific text could not be extracted."
      )
    : "No site-specific exception identified",

siteSpecificExceptionLink:
  zoning?.BYLAW_EXCPTNLINK || null
  };
}

// ------------------------------------------------------------
// Main button function
// ------------------------------------------------------------

async function generateReport() {
  const addressInput = document.getElementById("addressInput");
  const result = document.getElementById("result");
  const button = document.getElementById("generateButton");

  const address = addressInput.value.trim();

  if (!address) {
    result.innerHTML = `
      <div class="message error-message">
        Please enter a property address.
      </div>
    `;
    return;
  }

  button.disabled = true;
  button.textContent = "Generating Report...";

  try {
    // --------------------------------------------------------
    // Step 1: Geocode the address
    // --------------------------------------------------------

    result.innerHTML = `
      <div class="loading-message">
        Step 1 of 3: Finding the property location...
      </div>
    `;

    const geocodeResponse = await fetch("/api/geocode", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ address })
    });

    const geocodeData = await geocodeResponse.json();

    if (!geocodeResponse.ok || !geocodeData.success) {
      throw new Error(
        geocodeData.message || "The address could not be found."
      );
    }

    const matchedAddress = geocodeData.address || "";

    // Stop if the address is outside Toronto
    if (!matchedAddress.toLowerCase().includes("toronto")) {
      result.innerHTML = `
        <section class="report-card">
          <section class="report-section">
            <h2>Property Outside Toronto</h2>

            <p>
              <strong>Matched address:</strong>
              ${escapeHtml(matchedAddress)}
            </p>

            <p>
              Toronto zoning information is not available for this property.
            </p>
          </section>
        </section>
      `;

      return;
    }

    // --------------------------------------------------------
    // Step 2: Query Toronto zoning layers
    // --------------------------------------------------------

    result.innerHTML = `
      <div class="loading-message">
        Step 2 of 3: Retrieving Toronto zoning information...
      </div>
    `;

    const zoningResponse = await fetch("/api/zoning", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        latitude: geocodeData.latitude,
        longitude: geocodeData.longitude
      })
    });

    const zoningData = await zoningResponse.json();

    if (!zoningResponse.ok || !zoningData.success) {
      throw new Error(
        zoningData.message || "The zoning lookup failed."
      );
    }

    const layers = zoningData.layers || {};

    const zoning = layers.zoningArea;
    const height = layers.heightOverlay;
    const coverage = layers.lotCoverageOverlay;
    const policy = layers.policyAreaOverlay;
    const setback = layers.setbackOverlay;
    const parking = layers.parkingOverlay;

    if (!zoning) {
      result.innerHTML = `
        <section class="report-card">
          <section class="report-section">
            <h2>No Zoning Polygon Found</h2>

            <p>
              <strong>Matched address:</strong>
              ${escapeHtml(matchedAddress)}
            </p>

            <p>
              No Toronto zoning-area polygon was found at this point.
              Verify the property using the official Toronto zoning map.
            </p>
          </section>
        </section>
      `;

      return;
    }

    // --------------------------------------------------------
    // Step 3: Download applicable by-law pages
    // --------------------------------------------------------

    result.innerHTML = `
      <div class="loading-message">
        Step 3 of 3: Loading applicable by-law sections...
      </div>
    `;

    let bylawData = null;

    if (zoning.BYLAW_SECTIONLINK || zoning.BYLAW_EXCPTNLINK) {
      const bylawResponse = await fetch("/api/bylaw", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sectionLink: zoning.BYLAW_SECTIONLINK,
          exceptionLink: zoning.BYLAW_EXCPTNLINK
        })
      });

      bylawData = await bylawResponse.json();

      if (!bylawResponse.ok) {
        console.warn(
          "By-law pages could not be loaded:",
          bylawData.message
        );

        bylawData = null;
      }
    }

    const rdRequirements =
  zoning.ZN_ZONE === "RD"
    ? buildRdRequirements(
        zoning,
        height,
        coverage,
        bylawData?.exceptionSection
      )
    : null;

    // --------------------------------------------------------
    // Format general zoning values
    // --------------------------------------------------------

    const zoneCode = zoning.ZN_ZONE || NOT_FOUND;
    const zoneName = getZoneName(zoning.ZN_ZONE);
    const zoningString = zoning.ZN_STRING || NOT_FOUND;

    const minimumFrontage =
      zoning.ZN_FRONTAGE !== null &&
      zoning.ZN_FRONTAGE !== undefined
        ? `${zoning.ZN_FRONTAGE} m`
        : NOT_FOUND;

    const minimumLotArea =
      zoning.ZN_AREA !== null &&
      zoning.ZN_AREA !== undefined
        ? `${zoning.ZN_AREA} m²`
        : NOT_FOUND;

    const maximumHeight =
      height?.HT_HEIGHT !== null &&
      height?.HT_HEIGHT !== undefined
        ? `${height.HT_HEIGHT} m`
        : NOT_FOUND;

    const maximumStoreys =
      height?.HT_STORIES !== null &&
      height?.HT_STORIES !== undefined &&
      Number(height.HT_STORIES) >= 0
        ? String(height.HT_STORIES)
        : NOT_FOUND;

    const maximumCoverage =
      coverage?.ZN_COVERAGE !== null &&
      coverage?.ZN_COVERAGE !== undefined
        ? `${coverage.ZN_COVERAGE}%`
        : NOT_FOUND;

    const fsi =
      zoning.FSI_TOTAL !== null &&
      zoning.FSI_TOTAL !== undefined &&
      Number(zoning.FSI_TOTAL) >= 0
        ? String(zoning.FSI_TOTAL)
        : NOT_FOUND;

    const exceptionValue =
      zoning.ZN_EXCPTN === "Y" && zoning.ZN_EXCPTN_NO
        ? `Yes — Exception ${zoning.ZN_EXCPTN_NO}`
        : "No site-specific exception identified";

    const policyValue = policy
      ? JSON.stringify(policy)
      : NOT_FOUND;

    const setbackValue = setback
      ? JSON.stringify(setback)
      : NOT_FOUND;

    const parkingValue = parking
      ? JSON.stringify(parking)
      : NOT_FOUND;

    // --------------------------------------------------------
    // Display final report
    // --------------------------------------------------------

    result.innerHTML = `
      <section class="report-card">

        <div class="report-heading">
          <div>
            <p class="eyebrow">Preliminary Zoning Report</p>
            <h2>${escapeHtml(zoneCode)} — ${escapeHtml(zoneName)}</h2>
          </div>

          <span class="preliminary-badge">Preliminary</span>
        </div>

        <section class="report-section">
          <h3>Property Information</h3>

          <div class="property-grid">
            <div>
              <span class="field-label">Matched Address</span>
              <span class="field-value">
                ${escapeHtml(matchedAddress)}
              </span>
            </div>

            <div>
              <span class="field-label">Latitude</span>
              <span class="field-value">
                ${escapeHtml(geocodeData.latitude)}
              </span>
            </div>

            <div>
              <span class="field-label">Longitude</span>
              <span class="field-value">
                ${escapeHtml(geocodeData.longitude)}
              </span>
            </div>

            <div>
              <span class="field-label">Data Source</span>
              <span class="field-value">
                City of Toronto ArcGIS MapServer
              </span>
            </div>
          </div>
        </section>

        <section class="report-section">
          <h3>Zoning Summary</h3>

          <div class="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Requirement</th>
                  <th>Value</th>
                  <th>Source</th>
                </tr>
              </thead>

              <tbody>
                ${createRow(
                  "Zoning Code",
                  zoneCode,
                  "Toronto Zoning Area Layer"
                )}

                ${createRow(
                  "Zone Name",
                  zoneName,
                  "Toronto Zoning By-law"
                )}

                ${createRow(
                  "Complete Zoning String",
                  zoningString,
                  "Toronto Zoning Area Layer"
                )}

                ${createRow(
                  "Minimum Lot Frontage",
                  minimumFrontage,
                  "Toronto Zoning Area Layer"
                )}

                ${createRow(
                  "Minimum Lot Area",
                  minimumLotArea,
                  "Toronto Zoning Area Layer"
                )}

                ${createRow(
                  "Maximum Building Height",
                  maximumHeight,
                  "Toronto Height Overlay"
                )}

                ${createRow(
                  "Maximum Storeys",
                  maximumStoreys,
                  "Toronto Height Overlay"
                )}

                ${createRow(
                  "Maximum Lot Coverage",
                  maximumCoverage,
                  "Toronto Lot Coverage Overlay"
                )}

                ${createRow(
                  "Floor Space Index",
                  fsi,
                  "Toronto Zoning Area Layer"
                )}

                ${createRow(
                  "Site-Specific Exception",
                  exceptionValue,
                  "Toronto Zoning Area Layer"
                )}

                ${createRow(
                  "By-law Section",
                  zoning.ZBL_SECTION || NOT_FOUND,
                  "Toronto Zoning Area Layer"
                )}

                ${createRow(
                  "Policy Area Overlay",
                  policyValue,
                  "Toronto Policy Area Overlay"
                )}

                ${createRow(
                  "Building Setback Overlay",
                  setbackValue,
                  "Toronto Building Setback Overlay"
                )}

                ${createRow(
                  "Parking Zone Overlay",
                  parkingValue,
                  "Toronto Parking Zone Overlay"
                )}
              </tbody>
            </table>
          </div>
        </section>

        ${
          rdRequirements
            ? `
              <section class="report-section">
                <h3>Detached House Preliminary Requirements</h3>

                <div class="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Requirement</th>
                        <th>Preliminary Requirement</th>
                        <th>Status</th>
                      </tr>
                    </thead>

                    <tbody>
                      ${createRequirementRow(
                        "Permitted Use",
                        rdRequirements.permittedUse,
                        "Identified"
                      )}

                      ${createRequirementRow(
                        "Permitted Building Types",
                        rdRequirements.permittedBuildingTypes,
                        "Verify conditions"
                      )}

                      ${createRequirementRow(
                        "Secondary Suite",
                        rdRequirements.secondarySuite,
                        "Conditions apply"
                      )}

                      ${createRequirementRow(
                        "Garden Suite",
                        rdRequirements.gardenSuite,
                        "Conditions apply"
                      )}

                      ${createRequirementRow(
                        "Laneway Suite",
                        rdRequirements.lanewaySuite,
                        "Conditions apply"
                      )}

                      ${createRequirementRow(
                        "Home Occupation",
                        rdRequirements.homeOccupation,
                        "Conditions apply"
                      )}

                      ${createRequirementRow(
                        "Minimum Lot Frontage",
                        rdRequirements.minimumLotFrontage,
                        "Identified"
                      )}

                      ${createRequirementRow(
                        "Minimum Lot Area",
                        rdRequirements.minimumLotArea,
                        "Identified"
                      )}

                      ${createRequirementRow(
                        "Maximum Building Height",
                        rdRequirements.maximumHeight,
                        "Identified"
                      )}

                      ${createRequirementRow(
                        "Maximum Storeys",
                        rdRequirements.maximumStoreys,
                        "Identified"
                      )}

                      ${createRequirementRow(
                        "Maximum Lot Coverage",
                        rdRequirements.maximumLotCoverage,
                        "Identified"
                      )}

                      ${createRequirementRow(
                        "Maximum Building Length",
                        rdRequirements.maximumBuildingLength,
                        "Preliminary"
                      )}

                      ${createRequirementRow(
                        "Maximum Building Depth",
                        rdRequirements.maximumBuildingDepth,
                        "Preliminary"
                      )}

                      ${createRequirementRow(
                        "Maximum FSI",
                        rdRequirements.maximumFsi,
                        "Verify exception"
                      )}

                      ${createRequirementRow(
                        "Front-Yard Setback",
                        rdRequirements.frontYardSetback,
                        "Verify averaging"
                      )}

                      ${createRequirementRow(
                        "Rear-Yard Setback",
                        rdRequirements.rearYardSetback,
                        "Requires actual lot depth"
                      )}

                      ${createRequirementRow(
                        "Interior Side-Yard Setback",
                        rdRequirements.interiorSideYardSetback,
                        "Verify frontage"
                      )}

                      ${createRequirementRow(
                        "Exterior Side-Yard Setback",
                        rdRequirements.exteriorSideYardSetback,
                        "Corner lots only"
                      )}

                      ${createRequirementRow(
                        "Second-Storey Deck or Balcony",
                        rdRequirements.secondStoreyDeck,
                        "Conditions apply"
                      )}

                      <tr>
  <td>Site-Specific Exception</td>

  <td>
    <strong>
      ${escapeHtml(
        rdRequirements.siteSpecificException
      )}
    </strong>

    ${
      rdRequirements.siteSpecificExceptionLink
        ? `
          <details class="exception-summary">
            <summary>
              View applicable exception summary
            </summary>

            <p>
              ${escapeHtml(
                rdRequirements.siteSpecificExceptionSummary
              )}
            </p>
          </details>
        `
        : ""
    }
  </td>

  <td>
    ${
      rdRequirements.siteSpecificExceptionLink
        ? `
          <a
            href="${escapeHtml(
              buildTorontoBylawUrl(
                rdRequirements.siteSpecificExceptionLink
              )
            )}"
            target="_blank"
            rel="noopener noreferrer"
          >
            Open Official Exception
          </a>
        `
        : escapeHtml(NOT_FOUND)
    }
  </td>
</tr>
                    </tbody>
                  </table>
                </div>
              </section>
            `
            : `
              <section class="report-section">
                <h3>Detached House Requirements</h3>

                <p>
                  Automated detailed requirements are currently available
                  only for properties identified as RD.
                </p>
              </section>
            `
        }

        <section class="report-section">
          <h3>Applicable By-law Sources</h3>

          <div class="source-links">
            ${
              bylawData?.zoneSection
                ? `
                  <a
                    href="${escapeHtml(bylawData.zoneSection.url)}"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open Official Zone Section
                  </a>
                `
                : `<span>${escapeHtml(NOT_FOUND)}</span>`
            }

            ${
              bylawData?.exceptionSection
                ? `
                  <a
                    href="${escapeHtml(bylawData.exceptionSection.url)}"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open Official Site-Specific Exception
                  </a>
                `
                : `<span>No exception page was loaded.</span>`
            }
          </div>
        </section>

        <section class="report-section">
          <h3>Extracted Zoning Sections</h3>

          <details>
            <summary>Permitted Uses</summary>
            <p>
              ${escapeHtml(
                bylawData?.extractedSections?.permittedUses ||
                NOT_FOUND
              )}
            </p>
          </details>

          <details>
            <summary>Lot Requirements</summary>
            <p>
              ${escapeHtml(
                bylawData?.extractedSections?.lotRequirements ||
                NOT_FOUND
              )}
            </p>
          </details>

          <details>
            <summary>Building Requirements</summary>
            <p>
              ${escapeHtml(
                bylawData?.extractedSections?.buildingRequirements ||
                NOT_FOUND
              )}
            </p>
          </details>

          <details>
            <summary>Yards and Setbacks</summary>
            <p>
              ${escapeHtml(
                bylawData?.extractedSections?.yardsAndSetbacks ||
                NOT_FOUND
              )}
            </p>
          </details>

          <details>
            <summary>Accessory Structures</summary>
            <p>
              ${escapeHtml(
                bylawData?.extractedSections?.accessoryStructures ||
                NOT_FOUND
              )}
            </p>
          </details>

          <details>
            <summary>Parking</summary>
            <p>
              ${escapeHtml(
                bylawData?.extractedSections?.parking ||
                NOT_FOUND
              )}
            </p>
          </details>
        </section>

        ${
          bylawData?.zoneSection || bylawData?.exceptionSection
            ? `
              <section class="report-section">
                <details>
                  <summary>Show downloaded official by-law text</summary>

                  <h4>Zone Section</h4>

                  <pre class="bylaw-text">${escapeHtml(
                    bylawData?.zoneSection?.text || NOT_FOUND
                  )}</pre>

                  <h4>Site-Specific Exception</h4>

                  <pre class="bylaw-text">${escapeHtml(
                    bylawData?.exceptionSection?.text ||
                    "No exception text was loaded."
                  )}</pre>
                </details>
              </section>
            `
            : ""
        }

        <section class="report-section notice-section">
          <h3>Important Notice</h3>

          <p>
            This is a preliminary automated summary. The GIS values do not
            replace a review of Zoning By-law 569-2013, applicable exceptions,
            former municipal by-laws, amendments, appeals, surveys or a formal
            zoning review by the City of Toronto.
          </p>
        </section>

      </section>
    `;
  } catch (error) {
    console.error(error);

    result.innerHTML = `
      <div class="message error-message">
        ${escapeHtml(error.message || "Something went wrong.")}
      </div>
    `;
  } finally {
    button.disabled = false;
    button.textContent = "Generate Zoning Report";
  }
}

// ------------------------------------------------------------
// Conceptual site-plan drawing
// ------------------------------------------------------------

function drawConceptualSitePlan(planData) {
  const drawingContainer =
    document.getElementById("sitePlanDrawing");

  if (!drawingContainer) {
    console.error("sitePlanDrawing container was not found.");
    return;
  }

  const {
    address,
    lotWidth,
    lotDepth,
    frontSetback,
    rearSetback,
    leftSetback,
    rightSetback,
    proposedBuildingWidth,
    proposedBuildingDepth,
    maximumCoverage,
    streetName
  } = planData;

  const numericValues = [
    lotWidth,
    lotDepth,
    frontSetback,
    rearSetback,
    leftSetback,
    rightSetback
  ];

  if (
    numericValues.some(
      value => !Number.isFinite(Number(value))
    )
  ) {
    drawingContainer.innerHTML = `
      <div class="drawing-warning">
        The conceptual drawing could not be generated because one or
        more lot or setback dimensions are missing.
      </div>
    `;

    return;
  }

  const width = Number(lotWidth);
  const depth = Number(lotDepth);

  const front = Number(frontSetback);
  const rear = Number(rearSetback);
  const left = Number(leftSetback);
  const right = Number(rightSetback);

  if (width <= 0 || depth <= 0) {
    drawingContainer.innerHTML = `
      <div class="drawing-warning">
        The lot width and depth must be greater than zero.
      </div>
    `;

    return;
  }

  const buildableWidth = width - left - right;
  const buildableDepth = depth - front - rear;

  if (buildableWidth <= 0 || buildableDepth <= 0) {
    drawingContainer.innerHTML = `
      <div class="drawing-warning">
        The reported setbacks leave no positive conceptual
        building envelope.
      </div>
    `;

    return;
  }

  const requestedBuildingWidth =
    Number(proposedBuildingWidth);

  const requestedBuildingDepth =
    Number(proposedBuildingDepth);

  const buildingWidth =
    Number.isFinite(requestedBuildingWidth) &&
    requestedBuildingWidth > 0
      ? Math.min(requestedBuildingWidth, buildableWidth)
      : buildableWidth;

  const buildingDepth =
    Number.isFinite(requestedBuildingDepth) &&
    requestedBuildingDepth > 0
      ? Math.min(requestedBuildingDepth, buildableDepth)
      : buildableDepth;

  const buildingArea = buildingWidth * buildingDepth;
  const lotArea = width * depth;

  const calculatedCoverage =
    lotArea > 0
      ? (buildingArea / lotArea) * 100
      : 0;

  const viewWidth = 900;
  const viewHeight = 900;

  const marginLeft = 170;
  const marginRight = 120;
  const marginTop = 90;
  const marginBottom = 190;

  const availableWidth =
    viewWidth - marginLeft - marginRight;

  const availableHeight =
    viewHeight - marginTop - marginBottom;

  const scale = Math.min(
    availableWidth / width,
    availableHeight / depth
  );

  const lotDrawingWidth = width * scale;
  const lotDrawingHeight = depth * scale;

  const lotX =
    marginLeft +
    (availableWidth - lotDrawingWidth) / 2;

  const lotY =
    marginTop +
    (availableHeight - lotDrawingHeight) / 2;

  const envelopeX = lotX + left * scale;
  const envelopeY = lotY + rear * scale;

  const envelopeWidth = buildableWidth * scale;
  const envelopeHeight = buildableDepth * scale;

  const buildingX =
    envelopeX +
    (envelopeWidth - buildingWidth * scale) / 2;

  // Place the conceptual building near the front setback line.
  const buildingY =
    lotY +
    lotDrawingHeight -
    front * scale -
    buildingDepth * scale;

  const buildingDrawingWidth =
    buildingWidth * scale;

  const buildingDrawingHeight =
    buildingDepth * scale;

  const streetLabel =
    streetName || "STREET / FRONT LOT LINE";

  const maximumCoverageText =
    Number.isFinite(Number(maximumCoverage))
      ? `${Number(maximumCoverage).toFixed(1)}%`
      : "Not available";

  const svg = `
    <svg
      viewBox="0 0 ${viewWidth} ${viewHeight}"
      class="conceptual-site-plan"
      role="img"
      aria-label="Conceptual site plan for ${escapeHtml(address || "")}"
    >
      <defs>
        <pattern
          id="buildingHatch"
          width="12"
          height="12"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line
            x1="0"
            y1="0"
            x2="0"
            y2="12"
            stroke="currentColor"
            stroke-width="2"
            opacity="0.2"
          />
        </pattern>

        <marker
          id="arrow"
          markerWidth="8"
          markerHeight="8"
          refX="4"
          refY="4"
          orient="auto-start-reverse"
        >
          <path
            d="M 0 0 L 8 4 L 0 8 z"
            fill="currentColor"
          />
        </marker>
      </defs>

      <text
        x="${viewWidth / 2}"
        y="36"
        text-anchor="middle"
        class="plan-title"
      >
        CONCEPTUAL SITE PLAN
      </text>

      <text
        x="${viewWidth / 2}"
        y="62"
        text-anchor="middle"
        class="plan-subtitle"
      >
        ${escapeHtml(address || "Property")}
      </text>

      <!-- Rear label -->
      <text
        x="${lotX + lotDrawingWidth / 2}"
        y="${lotY - 18}"
        text-anchor="middle"
        class="lot-line-label"
      >
        REAR LOT LINE
      </text>

      <!-- Lot -->
      <rect
        x="${lotX}"
        y="${lotY}"
        width="${lotDrawingWidth}"
        height="${lotDrawingHeight}"
        class="lot-boundary"
      />

      <!-- Buildable zoning envelope -->
      <rect
        x="${envelopeX}"
        y="${envelopeY}"
        width="${envelopeWidth}"
        height="${envelopeHeight}"
        class="building-envelope"
      />

      <text
        x="${envelopeX + envelopeWidth / 2}"
        y="${envelopeY + 24}"
        text-anchor="middle"
        class="envelope-label"
      >
        ZONING ENVELOPE
      </text>

      <!-- Proposed or maximum conceptual building -->
      <rect
        x="${buildingX}"
        y="${buildingY}"
        width="${buildingDrawingWidth}"
        height="${buildingDrawingHeight}"
        class="concept-building"
      />

      <rect
        x="${buildingX}"
        y="${buildingY}"
        width="${buildingDrawingWidth}"
        height="${buildingDrawingHeight}"
        fill="url(#buildingHatch)"
      />

      <text
        x="${buildingX + buildingDrawingWidth / 2}"
        y="${buildingY + buildingDrawingHeight / 2 - 10}"
        text-anchor="middle"
        class="building-label"
      >
        CONCEPTUAL
      </text>

      <text
        x="${buildingX + buildingDrawingWidth / 2}"
        y="${buildingY + buildingDrawingHeight / 2 + 14}"
        text-anchor="middle"
        class="building-label"
      >
        BUILDING
      </text>

      <text
        x="${buildingX + buildingDrawingWidth / 2}"
        y="${buildingY + buildingDrawingHeight / 2 + 40}"
        text-anchor="middle"
        class="small-plan-label"
      >
        ${formatMetres(buildingWidth)} ×
        ${formatMetres(buildingDepth)}
      </text>

      <!-- Front setback dimension -->
      ${createVerticalDimension({
        x: lotX + lotDrawingWidth + 55,
        y1: buildingY + buildingDrawingHeight,
        y2: lotY + lotDrawingHeight,
        label: `${formatMetres(front)} front setback`
      })}

      <!-- Rear setback dimension -->
      ${createVerticalDimension({
        x: lotX + lotDrawingWidth + 55,
        y1: lotY,
        y2: envelopeY,
        label: `${formatMetres(rear)} rear setback`
      })}

      <!-- Left setback dimension -->
      ${createHorizontalDimension({
        y: buildingY + buildingDrawingHeight / 2,
        x1: lotX,
        x2: envelopeX,
        label: `${formatMetres(left)}`
      })}

      <!-- Right setback dimension -->
      ${createHorizontalDimension({
        y: buildingY + buildingDrawingHeight / 2,
        x1: envelopeX + envelopeWidth,
        x2: lotX + lotDrawingWidth,
        label: `${formatMetres(right)}`
      })}

      <!-- Lot width -->
      ${createHorizontalDimension({
        y: lotY + lotDrawingHeight + 80,
        x1: lotX,
        x2: lotX + lotDrawingWidth,
        label: `${formatMetres(width)} lot frontage`
      })}

      <!-- Lot depth -->
      ${createVerticalDimension({
        x: lotX - 70,
        y1: lotY,
        y2: lotY + lotDrawingHeight,
        label: `${formatMetres(depth)} lot depth`
      })}

      <!-- Street -->
      <rect
        x="${lotX - 45}"
        y="${lotY + lotDrawingHeight + 105}"
        width="${lotDrawingWidth + 90}"
        height="65"
        class="street"
      />

      <text
        x="${lotX + lotDrawingWidth / 2}"
        y="${lotY + lotDrawingHeight + 144}"
        text-anchor="middle"
        class="street-label"
      >
        ${escapeHtml(streetLabel)}
      </text>

      <!-- North arrow -->
      <g transform="translate(760 100)">
        <text
          x="0"
          y="-18"
          text-anchor="middle"
          class="north-label"
        >
          N
        </text>

        <line
          x1="0"
          y1="55"
          x2="0"
          y2="0"
          class="north-arrow"
          marker-end="url(#arrow)"
        />
      </g>

      <!-- Drawing information -->
      <g transform="translate(30 760)">
        <text x="0" y="0" class="information-label">
          Lot area:
          ${formatArea(lotArea)}
        </text>

        <text x="0" y="25" class="information-label">
          Conceptual footprint:
          ${formatArea(buildingArea)}
        </text>

        <text x="0" y="50" class="information-label">
          Conceptual coverage:
          ${calculatedCoverage.toFixed(1)}%
        </text>

        <text x="0" y="75" class="information-label">
          Reported maximum coverage:
          ${maximumCoverageText}
        </text>
      </g>

      <text
        x="${viewWidth / 2}"
        y="875"
        text-anchor="middle"
        class="disclaimer-label"
      >
        PRELIMINARY CONCEPT ONLY — NOT A SURVEY OR PERMIT DRAWING
      </text>
    </svg>
  `;

  drawingContainer.innerHTML = svg;
}

function formatMetres(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "N/A";
  }

  return `${number.toFixed(2)} m`;
}

function formatArea(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "N/A";
  }

  return `${number.toFixed(1)} m²`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function createHorizontalDimension({
  y,
  x1,
  x2,
  label
}) {
  const centre = (x1 + x2) / 2;

  return `
    <line
      x1="${x1}"
      y1="${y}"
      x2="${x2}"
      y2="${y}"
      class="dimension-line"
      marker-start="url(#arrow)"
      marker-end="url(#arrow)"
    />

    <text
      x="${centre}"
      y="${y - 9}"
      text-anchor="middle"
      class="dimension-label"
    >
      ${escapeHtml(label)}
    </text>
  `;
}

function createVerticalDimension({
  x,
  y1,
  y2,
  label
}) {
  const centre = (y1 + y2) / 2;

  return `
    <line
      x1="${x}"
      y1="${y1}"
      x2="${x}"
      y2="${y2}"
      class="dimension-line"
      marker-start="url(#arrow)"
      marker-end="url(#arrow)"
    />

    <text
      x="${x + 16}"
      y="${centre}"
      text-anchor="middle"
      class="dimension-label"
      transform="rotate(90 ${x + 16} ${centre})"
    >
      ${escapeHtml(label)}
    </text>
  `;
}
