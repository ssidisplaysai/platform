jest.mock("server-only", () => ({}));

import { inventoryCommercialStainlessPages } from "../commercial-stainless-rich-composition";
import { auditCommercialStainlessWave2Diversity, COMMERCIAL_STAINLESS_WAVE_2_PATHS, stageCommercialStainlessWave2 } from "../commercial-stainless-wave2-rollout";

const definitions = [
  [10,"Home","/","HOME"],[11,"Capabilities","/capabilities/","CAPABILITIES"],[12,"Commercial Stainless Counters","/commercial-stainless-counters/","CATEGORY"],[13,"Commercial Worktables & Prep Tables","/commercial-worktables-and-prep-tables/","OFFERING"],[14,"Design-Build Fabrication","/design-build-fabrication/","OFFERING"],[15,"Mobile & Modular Stainless Workstations","/mobile-and-modular-stainless-workstations/","OFFERING"],[16,"Stainless Countertops","/stainless-countertop/","OFFERING"],[17,"Education Solutions","/markets/education/","MARKET"],[18,"Foodservice Solutions","/markets/foodservice/","MARKET"],[19,"Healthcare Solutions","/markets/healthcare/","MARKET"],[20,"Hospitality Solutions","/markets/hospitality/","MARKET"],[21,"Industrial Solutions","/markets/industrial/","MARKET"],[22,"Labs Solutions","/markets/labs/","MARKET"],[23,"About","/about/","ABOUT"],[24,"Request a Quote","/request-a-quote/","CONTACT"],
] as const;
const paths=definitions.map(([, ,path])=>path);
const pages=definitions.map(([id,name,canonicalPath,pageRole])=>({pageId:`page-${id}`,pageRevisionId:`page-${id}-r1`,name,canonicalPath,pageRole,h1:`${name} approved H1`,seoTitle:`${name} | Commercial Stainless Counters`,metaDescription:`${name} approved meta description.`,sections:Array.from({length:6},(_,index)=>({heading:`${name} section ${index+1}`,presentation:index===0?"HERO":index===5?"CTA":"PROSE",body:[`Approved ${name} content ${index+1}.`]})),internalLinks:paths.filter(path=>path!==canonicalPath).slice(0,6).map(href=>({href,anchorText:href}))}));
const visuals=definitions.map(([id,name])=>({pageId:`page-${id}`,wordpressObjectId:String(id),wordpressMediaId:String(20+id*2),wordpressMediaUrl:`https://commercialstainlesscounters.com/wp-content/uploads/2026/09/${name.toLowerCase().replace(/[^a-z0-9]+/g,"-")}.jpg`,imageProvenance:"GENERATED_VISUAL",referenceClassification:"OWNER_SUPPLIED_REFERENCE"})) as never[];
const inventory=inventoryCommercialStainlessPages({pages:pages as never[],visuals});
const shell=(path:string)=>`<!doctype html><html><head><title>Current</title><meta name="description" content="Current"><link rel="canonical" href="https://commercialstainlesscounters.com${path}"></head><body><div class="wp-site-blocks"><header class="wp-block-template-part"><nav>Global navigation</nav></header><main><h1>Legacy</h1></main><footer class="wp-block-template-part">Global footer</footer></div></body></html>`;
const stages=stageCommercialStainlessWave2({pages:pages as never[],inventory,publicHtmlByPath:Object.fromEntries(COMMERCIAL_STAINLESS_WAVE_2_PATHS.map(path=>[path,shell(path)]))});

describe("Commercial Stainless Wave 2 compositions",()=>{
  test("targets exactly the five authorized Wave 2 objects and profiles",()=>{
    expect(stages.map(stage=>stage.wordpressObjectId)).toEqual([12,15,16,18,19]);
    expect(stages.map(stage=>stage.path)).toEqual([...COMMERCIAL_STAINLESS_WAVE_2_PATHS]);
    expect(stages.map(stage=>stage.profile)).toEqual(["PRODUCT_SERVICE","PRODUCT_SERVICE","PRODUCT_SERVICE","INDUSTRY_APPLICATION","INDUSTRY_APPLICATION"]);
  });
  test("passes host, media, SEO, link, and readiness preflight without mutation",()=>{
    for(const stage of stages){expect(stage).toMatchObject({status:"OWNER_REVIEW_READY",wordpressMutation:false,publicationMutation:false,seoIdentityPreserved:true,canonicalPreserved:true,indexabilityPreserved:true,featuredMediaAuthorityPreserved:true,linksValid:true,noExcessiveWhitespace:true,noAccidentalEmptyRegions:true});expect(stage.hostPreflight).toMatchObject({eligible:true,themeFeaturedImageCount:0,hostDuplicateMediaCount:0,hostResidualSpacing:0,globalHeaderCount:1,globalFooterCount:1,bodyNavigationCount:0,h1Count:1,pass:true});expect(stage.mediaPolicy.pass).toBe(true);expect(stage.mediaPolicy.findings).toHaveLength(0);expect(stage.mediaInstances.length).toBe(5);expect(new Set(stage.mediaInstances.map(item=>item.mediaSourceIdentity)).size).toBe(5);expect(stage.mediaInstances.every(item=>item.claimClass==="CONCEPTUAL"&&item.hostOrCompositionAuthority==="GOVERNED_COMPOSITION")).toBe(true);}
  });
  test("provides meaningful layout diversity",()=>{
    expect(auditCommercialStainlessWave2Diversity(stages)).toEqual({profileCount:2,heroVariantCount:5,sectionSequenceVariantCount:5,mediaLayoutVariantCount:5,ctaPlacementVariantCount:5});
  });
  test("preserves all approved content sections and avoids unsupported documentary claims",()=>{
    for(const stage of stages){const page=pages.find(item=>Number(item.pageId.replace("page-",""))===stage.wordpressObjectId)!;for(const section of page.sections)for(const paragraph of section.body)expect(stage.wordpressContent).toContain(paragraph.replaceAll("&","&amp;"));expect(stage.wordpressContent).not.toMatch(/actual (?:customer|completed) project|certified installation/i);}
  });
});
