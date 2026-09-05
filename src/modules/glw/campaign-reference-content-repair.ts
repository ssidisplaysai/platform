import type { GlwGeneratedDraftArtifact } from "./page-execution";
import type { GlwGenerationRequest } from "./page-generation";

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

export function repairGlwCampaignReferenceCityArtifact(input: {
  artifact: GlwGeneratedDraftArtifact;
  request: GlwGenerationRequest;
}): GlwCampaignReferenceRepairResult {
  if (!isSsiAccentCampaignCityRequest(input.request)) {
    return { artifact: input.artifact, repaired: false };
  }

  const city = input.request.cityName ?? input.request.stateName ?? "your project";
  const contentHtml = buildAuthorityConstrainedReferenceHtml(input.request);

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
