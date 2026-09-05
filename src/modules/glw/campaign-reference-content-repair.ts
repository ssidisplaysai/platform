import type { GlwGeneratedDraftArtifact } from "./page-execution";
import type { GlwGenerationRequest } from "./page-generation";
import { isPeFanCooledStarterCampaignRequest } from "./projectorenclosure-campaign-authority";

export type GlwCampaignReferenceRepairResult = {
  artifact: GlwGeneratedDraftArtifact;
  repaired: boolean;
};

const SSI_ACCENT_TEXAS_CITY_CAMPAIGN_ID =
  "campaign-ssi-site-ssi-screen-solutions-international-ssi-accent-rear-projection-film-texas-cities";

const SSI_ACCENT_PRODUCT_ID =
  "prod-ssi-accent-rear-projection-film";

const SSI_SITE_ID =
  "site-ssi-screen-solutions-international";

function isSsiAccentCampaignCityRequest(
  request: GlwGenerationRequest,
): boolean {
  return Boolean(
    request.campaignId === SSI_ACCENT_TEXAS_CITY_CAMPAIGN_ID
      && request.productId === SSI_ACCENT_PRODUCT_ID
      && request.siteId === SSI_SITE_ID
      && request.pageType === "city_service"
      && request.stateCode === "TX",
  );
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildAuthorityConstrainedReferenceHtml(request: GlwGenerationRequest): string {
  const product = escapeHtml(request.productTopic);
  const city = escapeHtml(request.cityName ?? "the target city");
  const state = escapeHtml(request.stateName ?? request.stateCode);
  const site = escapeHtml(request.siteName);

  return [
    `<h1>${product} in ${city}</h1>`,
    `<p>${site} provides ${product} for commercial projects in ${city}, ${state}. This page is intended to help project teams organize the questions, measurements, responsibilities, and purchasing information that should be resolved before a rear projection film order is finalized. Because project conditions vary, the page does not assume a particular projector, glazing condition, installation method, viewing environment, or performance specification. Those details should be confirmed against the actual project requirements and approved product documentation.</p>`,

    `<h2>Planning a ${product} Project in ${city}</h2>`,
    `<p>A useful starting point is to define what the project team wants the finished display area to accomplish. Record the intended display location, the approximate visible area, who will view the content, when the display will operate, and what surrounding architectural elements must remain accessible. If the project involves glass, acrylic, partitions, windows, or another transparent surface, document the exact surface type rather than assuming that every surface should be handled the same way. The purpose of this early planning is not to select technical specifications by guesswork; it is to give ${site} enough project information to help identify the appropriate next steps.</p>`,
    `<p>Teams should also identify who owns each part of the project. A typical commercial installation may involve an architect, general contractor, audiovisual integrator, glazing contractor, facilities team, content team, or other trades. Not every project requires every discipline, but assigning responsibility early reduces uncertainty. The film itself is only one part of a rear projection system, so questions about projection equipment, mounting, signal routing, electrical service, content sources, access, and final commissioning should be coordinated with the parties responsible for those systems.</p>`,

    `<h2>Information to Gather Before Requesting a Quote</h2>`,
    `<p>Before requesting pricing, assemble the facts that can be verified at the project site. Useful information includes the city and project address or general location, the width and height of the intended display area, photographs of the surface and surrounding space, drawings when available, the project schedule, and any access limitations. If a projector has already been selected, provide its exact manufacturer and model instead of describing it only by brightness or resolution. If no projector has been selected, state that clearly so the system can be evaluated without assuming compatibility.</p>`,
    `<p>The project team should also explain whether the film is being considered for a new build, tenant improvement, retrofit, exhibit, event, retail environment, corporate space, hospitality project, institutional setting, or another commercial application. These categories are useful for context, but they do not establish technical suitability on their own. The final recommendation should be based on documented project conditions and approved product information rather than a generic use-case label.</p>`,

    `<h2>Measure the Intended Display Area Carefully</h2>`,
    `<p>Accurate dimensions are essential for any made-to-project requirement. Measure the intended visible width and height and note whether the project drawings use rough opening dimensions, glass dimensions, finished visible dimensions, or another convention. If multiple pieces are involved, identify each opening separately and provide a simple elevation or marked photograph. Do not assume that two panels that appear identical have the same finished dimensions. Field conditions, framing, mullions, gaskets, trim, and tolerances can affect the available area.</p>`,
    `<p>When a project contains unusual geometry, document it before ordering. Curves, angled edges, divided glazing, interruptions, penetrations, hardware, or adjacent finishes may change how the film should be planned. The safest purchasing process is to treat the approved field dimensions and drawings as the source of truth. ${site} can then review the requirement against the product information available for ${product} without inventing dimensions or installation assumptions.</p>`,

    `<h2>Coordinate the Projection System Separately</h2>`,
    `<p>Rear projection film is part of a larger display system, so projector selection should be handled as its own engineering decision. Project teams should document the available projection distance, projector location, mounting constraints, lens requirements, image size, content resolution, expected operating schedule, and service access. The correct values depend on the actual projector and space. This page therefore does not claim a required brightness level, gain value, throw ratio, resolution, or ambient-light performance for ${product}.</p>`,
    `<p>If the project already has projection equipment, provide the exact equipment list and current layout for review. If equipment still needs to be selected, the team should identify the desired image size and physical constraints before comparing projector options. This approach keeps the film selection and projection-system engineering aligned while avoiding unsupported assumptions about compatibility.</p>`,

    `<h2>Review the Surface and Installation Conditions</h2>`,
    `<p>Before installation planning begins, the team should confirm the exact surface receiving the film and the condition of that surface. Record whether the substrate is existing or new, whether it is accessible from the installation side, whether nearby hardware can be removed or must remain in place, and whether other trades will work in the same area. Any cleaning, preparation, application, trimming, edge treatment, or removal procedure should follow the approved product instructions and the installer&#39;s documented method rather than generalized advice.</p>`,
    `<p>Environmental conditions should also be treated as project-specific inputs. If temperature, direct sunlight, humidity, exterior exposure, cleaning chemicals, security requirements, or other conditions may affect the installation, identify them during review. This page does not claim that ${product} is approved for a particular outdoor, high-temperature, high-humidity, impact-resistant, or other specialized environment unless that use is supported by approved product documentation.</p>`,

    `<h2>Plan Content, Viewing, and Operations</h2>`,
    `<p>Project teams can make better purchasing decisions when they describe how the display will actually be used. Identify whether the content is primarily branding, wayfinding, presentations, video, motion graphics, product information, exhibit material, or another format. Note the approximate viewing positions and whether viewers will primarily approach from one direction or several directions. These details help the system designer ask the right questions without turning general planning guidance into unsupported product-performance claims.</p>`,
    `<p>Operational planning is equally important. Determine who will control the content source, how content updates will be handled, where source equipment will be located, what network or signal infrastructure is required, and who will support the system after handoff. If touch or another interactive layer is being considered, treat it as a separate component that requires its own compatibility review. Do not assume interactivity is included with the film or automatically compatible with every system.</p>`,

    `<h2>Commercial Procurement Checklist</h2>`,
    `<ul>`,
    `<li>Confirm the exact product name: ${product}.</li>`,
    `<li>Identify the project as a ${city}, ${state} requirement.</li>`,
    `<li>Provide verified field dimensions for every intended display area.</li>`,
    `<li>Provide drawings, photographs, or elevations when they are available.</li>`,
    `<li>List the exact projector model if projection equipment has already been selected.</li>`,
    `<li>State clearly when projector selection is still open.</li>`,
    `<li>Describe the surface type and whether the installation is new construction or retrofit work.</li>`,
    `<li>Identify schedule milestones that could affect ordering, installation, or commissioning.</li>`,
    `<li>Identify the party responsible for film installation and the party responsible for projection-system integration.</li>`,
    `<li>Request written confirmation for any product specification that is material to the project.</li>`,
    `</ul>`,

    `<h2>How to Compare Rear Projection Film Options</h2>`,
    `<p>When comparing alternatives, separate verified specifications from marketing language. Build a simple comparison sheet using only values that are documented by the manufacturer or supplier for the exact product being considered. Depending on the project, the team may need to ask about available sizes, appearance, optical characteristics, application method, care requirements, expected environment, warranty terms, lead time, packaging, and other purchasing details. The relevant comparison criteria should come from the project brief and approved documentation, not from assumptions carried over from a different film or display technology.</p>`,
    `<p>It is also useful to compare complete system implications rather than film price alone. A lower material price does not automatically produce a lower installed system cost, and a higher material price does not automatically produce a better result. Projection equipment, mounting, construction, labor, access, controls, cabling, content, testing, and service requirements can all affect the total project. A disciplined comparison keeps those categories visible and lets the project team decide which tradeoffs matter for the specific ${city} application.</p>`,

    `<h2>Avoid Unsupported Assumptions</h2>`,
    `<p>Rear projection projects can become difficult when a general statement is treated as if it were a confirmed specification. Do not assume that ${product} has a particular gain, viewing angle, transparency level, ambient-light rejection rating, scratch resistance, outdoor rating, life expectancy, adhesive system, roll size, projector compatibility, or touch capability unless the applicable product documentation confirms it. The same rule applies to installation claims, cleaning methods, warranties, certifications, code compliance, availability, and delivery timing.</p>`,
    `<p>Geographic pages require the same discipline. The fact that this page addresses ${city} does not mean ${site} has a local office, warehouse, installation crew, completed project, customer, or inventory position in ${city}. Any such statement should appear only when supported by current business records. Geographic relevance should come from helping a ${city} buyer organize a real project requirement, not from inventing local history or local presence.</p>`,

    `<h2>Questions to Review With ${site}</h2>`,
    `<p>When you contact ${site}, bring the project information already collected and use the discussion to close factual gaps. Ask which product documentation applies to the exact ${product} configuration being quoted. Ask what dimensions and file formats are needed for review. Ask whether the intended surface and environment require additional verification. Ask what information is needed about the projector and mounting geometry. Ask which responsibilities belong to the film supplier, installer, audiovisual integrator, glazing contractor, and end user. Ask which specifications, warranty terms, lead times, and installation requirements can be confirmed in writing for the proposed order.</p>`,
    `<p>For projects that are still early in design, it is acceptable to say that some answers are not known yet. A clear list of open questions is more useful than filling those gaps with assumed specifications. The project can then move from concept to quotation to final coordination as verified information becomes available.</p>`,

    `<h2>Request a ${product} Quote for ${city}</h2>`,
    `<p>For a ${city}, ${state} project involving ${product}, contact ${site} with the available dimensions, drawings, photographs, projector information, schedule, and application description. The goal of the initial review is to establish the exact project requirement and identify any information that still needs confirmation before ordering. This keeps the purchasing process grounded in documented product authority and actual field conditions while giving the project team a clear path toward quotation and technical coordination.</p>`,
  ].join("\n");
}

function buildPeFanCooledAuthorityHtml(request: GlwGenerationRequest): string {
  const product = escapeHtml(request.productTopic);
  const city = escapeHtml(request.cityName ?? "the target city");
  const state = escapeHtml(request.stateName ?? request.stateCode);
  const site = escapeHtml(request.siteName);
  const authorityUrl = "https://projectorenclosure.com/fan-cooled-projector-enclosures/";

  return [
    `<h1>${product} in ${city}</h1>`,
    `<p>${site} provides ${product} for projector protection planning in ${city}, ${state}. The verified product authority identifies three relevant characteristics: Built-In Fan Cooling, Durable Metal Construction, and removable or hinged access panels. Those facts establish a useful starting point for project review, but they do not replace confirmation of projector dimensions, environmental conditions, installation responsibilities, or the requirements of the specific venue.</p>`,
    `<p>This guide helps buyers, integrators, contractors, and facility teams organize a request without inventing specifications. Every installation should be evaluated from documented field conditions and current product information. Review the <a href="${authorityUrl}">canonical ${product} product page</a> and ask ${site} to confirm the configuration proposed for the project before purchasing or construction decisions are finalized.</p>`,

    `<h2>Start With the Project Requirement</h2>`,
    `<p>Begin by recording why the projector needs an enclosure and where the assembly is expected to operate. Describe the venue, the intended projector location, the operating schedule, the audience area, and the parties responsible for the projection system. Note whether the work is part of a new installation, a renovation, a replacement, or an upgrade to an existing system. This context helps the project team separate confirmed needs from assumptions and gives ${site} a practical basis for review.</p>`,
    `<p>A city-focused planning page does not establish inventory, personnel, facilities, completed projects, delivery timing, or code approval in ${city}. Geographic relevance comes from organizing the details that a project team in ${city} should verify. Availability, shipping, installation support, and regulatory obligations must be confirmed for the actual order and site rather than inferred from the page title.</p>`,

    `<h2>Document the Projector</h2>`,
    `<p>Provide the exact projector manufacturer and model whenever it is known. Include current manufacturer drawings, the orientation proposed by the system designer, lens information, cable locations, control connections, service points, and any accessories expected to remain attached. If a projector has not been selected, state that clearly. An enclosure decision should not be based on an approximate description when the final equipment may differ in size, layout, service needs, or operating requirements.</p>`,
    `<p>Field measurements and equipment documentation serve different purposes. Field measurements describe the available location, while manufacturer documentation describes the projector itself. Keep both sets of information in the project record. A photograph can clarify surroundings, but it should not replace dimensions or technical drawings. Ask the responsible audiovisual professional to identify any projector-specific requirements that must be maintained inside an enclosure.</p>`,

    `<h2>Measure the Available Location</h2>`,
    `<p>Record the width, height, and depth available at the proposed location, along with nearby walls, ceilings, beams, screens, structures, furnishings, and access routes. Identify which dimensions are field verified and which are taken from design documents. Note anything that could obstruct doors or access panels. Durable Metal Construction does not remove the need to coordinate the enclosure footprint and access clearances with the surrounding work.</p>`,
    `<p>Also document how the enclosure and projector can be brought to the installation point. Doorways, stairs, lifts, roof access, finished surfaces, occupied areas, and restricted work hours may affect planning. Assign responsibility for verifying support conditions and attachment methods to the qualified project professional. This page does not specify structural loads, mounting hardware, anchorage, or a universal installation method.</p>`,

    `<h2>Review the Operating Environment</h2>`,
    `<p>Describe whether the proposed location is indoors, outdoors, sheltered, exposed, conditioned, dusty, humid, hot, cold, or subject to changing weather. Record nearby heat sources, water sources, airborne contaminants, direct sun, cleaning activity, and other conditions that the project team considers relevant. These observations should be provided to ${site} for configuration review. No environmental suitability should be assumed from the product name alone.</p>`,
    `<p>Built-In Fan Cooling is a verified product characteristic. It is not, by itself, a promise that every projector will operate correctly in every environment. The project team should provide the projector documentation, operating schedule, location details, and environmental information needed for review. Final operating suitability depends on the selected equipment, enclosure configuration, field conditions, installation, and maintenance practices.</p>`,

    `<h2>Plan Airflow Without Guesswork</h2>`,
    `<p>Keep proposed intake and discharge areas visible in drawings and photographs, and identify surrounding objects that could interfere with air movement. Do not place finishes, storage, signage, landscaping, or temporary equipment around the enclosure without reviewing their effect on the approved configuration. The exact airflow path and clearances should come from current product guidance and the project-specific review, not from a generic distance invented for a location page.</p>`,
    `<p>Projector operation and enclosure operation should be coordinated as one system. Record expected hours of use, shutdown practices, seasonal changes, and who will monitor the equipment after handoff. If operating conditions change later, the responsible team should reassess the installation rather than assuming the original review covers every future use. Keep the final approved documentation available to operations personnel.</p>`,

    `<h2>Coordinate Service Access</h2>`,
    `<p>Removable or hinged access panels are part of the verified product authority. During layout, identify where those panels need to move and what technicians must reach during inspection or projector service. Nearby construction should not make approved access impractical. Drawings should show the enclosure in relation to walls, structure, screens, cable routes, and other installed systems so conflicts can be addressed before fabrication or installation.</p>`,
    `<p>Define who may open the enclosure and which work belongs to the audiovisual integrator, facilities team, electrical contractor, enclosure supplier, or another qualified party. Service planning should account for safe access to the location and for protection of surrounding finishes and occupied areas. Do not infer tool requirements, maintenance intervals, filter schedules, replacement procedures, or warranty terms unless current documentation confirms them.</p>`,

    `<h2>Coordinate Power, Signal, and Controls</h2>`,
    `<p>List the power, signal, control, and network connections required by the projector and related equipment. Show where those services originate and how they reach the proposed enclosure location. The electrical design, cable types, penetrations, routing, strain relief, separation, protection, and code compliance remain project-specific responsibilities. Confirm interfaces before work is installed so the enclosure location does not conflict with the approved system design.</p>`,
    `<p>If the projector is part of a managed system, identify how operators will start, stop, monitor, and troubleshoot it. Record where source equipment and control hardware will be located and who will support them. The enclosure should be included in commissioning discussions, but this page does not claim that controls, monitoring hardware, network services, electrical components, or integration labor are included with ${product}.</p>`,

    `<h2>Assign Design and Installation Responsibilities</h2>`,
    `<p>A commercial project may involve an owner, architect, engineer, general contractor, audiovisual integrator, electrical contractor, structural professional, installer, and facilities team. The exact group varies, but each relevant responsibility should have a named owner. Clarify who verifies dimensions, selects the projector, approves the location, designs support, supplies power and signal, coordinates access, installs the enclosure, commissions the system, and maintains it after turnover.</p>`,
    `<p>${site} can review the product requirement and available project information, while qualified project professionals remain responsible for their respective design and installation scopes. Do not interpret general planning guidance as engineering approval, permit approval, code interpretation, or a substitute for site-specific professional judgment. Written decisions and approved documents should be retained with the project record.</p>`,

    `<h2>Prepare a Useful Request for Review</h2>`,
    `<ul>`,
    `<li>Identify ${product} and link the request to the canonical product authority.</li>`,
    `<li>Provide the ${city}, ${state} project location and describe the venue.</li>`,
    `<li>Provide the exact projector manufacturer and model, or state that selection is pending.</li>`,
    `<li>Attach projector drawings and relevant project drawings when available.</li>`,
    `<li>Provide field-verified dimensions and photographs of the proposed location.</li>`,
    `<li>Describe environmental conditions without assigning unsupported ratings.</li>`,
    `<li>Show surrounding obstructions and the space available for access panels.</li>`,
    `<li>Describe power, signal, control, structural, and access coordination needs.</li>`,
    `<li>Identify the parties responsible for installation, commissioning, and maintenance.</li>`,
    `<li>Ask for written confirmation of material specifications important to the project.</li>`,
    `</ul>`,

    `<h2>Review Verified Product Characteristics</h2>`,
    `<p>The current product authority supports three concise facts. Built-In Fan Cooling describes the cooling method. Durable Metal Construction describes the construction at a general level. Removable or hinged access panels describe the service-access approach. These facts can be repeated in planning materials, but they should not be expanded into unverified dimensions, materials, finishes, ratings, performance values, certifications, accessories, warranties, or environmental claims.</p>`,
    `<p>When a project depends on a detail beyond those three facts, ask for current written documentation for the exact configuration being proposed. Examples include overall size, projector capacity, finish, hardware, electrical provisions, filtration, environmental protection, sound, security, mounting, lead time, shipping, and warranty. The absence of a claim on this page means it remains to be confirmed; it should not be filled in from another product or an older project.</p>`,

    `<h2>Compare Options Consistently</h2>`,
    `<p>If the team is considering multiple enclosure options, create a comparison based on the same project inputs. Use the selected projector, location, environmental description, access requirements, support concept, integration scope, schedule, and documented product facts for every option. This produces a more useful decision record than comparing marketing phrases that may describe different configurations or assumptions.</p>`,
    `<p>Separate confirmed facts, pending questions, and project-team decisions in the comparison. A confirmed fact should cite current documentation. A pending question should name the person responsible for obtaining an answer. A project decision should record who approved it and when. This discipline is especially useful when procurement, design, and installation are handled by different organizations.</p>`,

    `<h2>Plan Delivery and Installation</h2>`,
    `<p>Before ordering, identify the requested schedule and the milestones that depend on the enclosure. Ask ${site} to confirm current availability and order requirements rather than assuming timing from a prior purchase. Coordinate receiving, inspection, storage, transport to the installation point, and protection of the product while other work continues. Report shipping damage or discrepancies through the applicable documented process.</p>`,
    `<p>The installer should work from the approved product information and coordinated project drawings. Verify the final location before installation and resolve conflicts with structure, electrical work, signal routes, finishes, and service access. Any field change that affects the approved arrangement should be reviewed by the responsible parties. This page does not authorize modification of the enclosure or projector.</p>`,

    `<h2>Commission the Complete System</h2>`,
    `<p>Commissioning should verify the installed condition against approved project documents. Confirm that the correct projector and enclosure are present, access remains available, surrounding work is complete, connections are coordinated, and operating responsibilities have been assigned. Follow current manufacturer and supplier instructions for startup and inspection. Record issues and their resolution before project handoff.</p>`,
    `<p>Provide the owner or operator with the documentation needed to understand the installed system. Include relevant product information, projector documentation, approved drawings, responsible contacts, and records of project-specific decisions. Training and handoff scope should be agreed by the project team. The existence of this planning guide does not establish an included commissioning or maintenance service.</p>`,

    `<h2>Maintain Documented Authority</h2>`,
    `<p>After handoff, keep product and project records associated with the installed equipment. When the projector, operating schedule, surroundings, or environmental conditions change, review whether the original enclosure decision remains appropriate. Replacement parts, cleaning, inspections, and service procedures should follow current approved guidance for the exact product and installation.</p>`,
    `<p>Online pages can change over time, so material decisions should rely on documentation current at the time of review. Contact ${site} when a specification, configuration, service procedure, or replacement requirement is unclear. Preserving a short written trail of questions and answers helps future operators distinguish verified product authority from assumptions made during early planning.</p>`,

    `<h2>Request a ${product} Review for ${city}</h2>`,
    `<p>For a project in ${city}, ${state}, send ${site} the projector identity, location dimensions, photographs, drawings, environmental description, schedule, and responsibility list. Refer to the verified Built-In Fan Cooling, Durable Metal Construction, and removable or hinged access panels only as documented starting points. Ask for written confirmation of every additional characteristic that matters to design, procurement, installation, operation, or maintenance.</p>`,
    `<p>A careful request gives the review team enough context to identify missing information without pretending that a city page can settle project-specific engineering questions. Use the <a href="${authorityUrl}">official ${product} authority page</a> as the product reference, preserve the resulting documentation, and keep the installation in draft planning until the responsible parties have resolved the applicable technical and commercial requirements.</p>`,
  ].join("\n");
}

export function repairGlwCampaignReferenceCityArtifact(input: {
  artifact: GlwGeneratedDraftArtifact;
  request: GlwGenerationRequest;
}): GlwCampaignReferenceRepairResult {
  const isSsiRequest = isSsiAccentCampaignCityRequest(input.request);
  const isPeRequest = isPeFanCooledStarterCampaignRequest(input.request);

  if (!isSsiRequest && !isPeRequest) {
    return { artifact: input.artifact, repaired: false };
  }

  const city = input.request.cityName ?? input.request.stateName ?? "your project";
  const contentHtml = isPeRequest
    ? buildPeFanCooledAuthorityHtml(input.request)
    : buildAuthorityConstrainedReferenceHtml(input.request);

  return {
    repaired: contentHtml !== input.artifact.contentHtml,
    artifact: {
      ...input.artifact,
      title: `${input.request.productTopic} in ${city}`,
      contentHtml,
      slug: input.request.canonicalPath,
      excerpt: `Plan a ${input.request.productTopic} project in ${city} with verified dimensions, documented requirements, and SSI product authority.`,
      seoTitle: input.request.seoTitle,
      metaDescription: input.request.metaDescription,
      focusKeyphrase: input.artifact.focusKeyphrase?.trim() || input.request.productTopic,
    },
  };
}
