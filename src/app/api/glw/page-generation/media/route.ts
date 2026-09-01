import { NextRequest, NextResponse } from "next/server";
import {
  authorizeRequest,
  hasOrganizationScope,
  resolveRequestScope,
} from "@/modules/foundation/api-auth";
import { getSiteById } from "@/modules/foundation/site-repository";
import { attachGenesisWordPressFeaturedImage } from "@/modules/foundation/wordpress-media-writer";
import { generateGenesisFeaturedImage } from "@/modules/glw/generated-image-service";
import { glwPageExecutionRepository } from "@/modules/glw/page-execution-repository";

export async function POST(request: NextRequest) {
  const auth = authorizeRequest(request, "sites:update");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const scope = resolveRequestScope(request);
  if (!hasOrganizationScope(scope)) {
    return NextResponse.json({ error: "Organization scope is required." }, { status: 403 });
  }

  const body = await request.json().catch(() => null) as { jobId?: string } | null;
  const jobId = body?.jobId?.trim() ?? "";
  if (!jobId) {
    return NextResponse.json({ error: "jobId is required." }, { status: 400 });
  }

  const job = await glwPageExecutionRepository.getById(jobId);
  if (!job) {
    return NextResponse.json({ error: "GLW execution was not found." }, { status: 404 });
  }
  if (job.organizationId !== scope.organizationId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!job.generatedDraft) {
    return NextResponse.json({ error: "The execution has no persisted generated draft artifact." }, { status: 409 });
  }
  if (!job.wordpressObjectId || job.wordpressStatus !== "draft") {
    return NextResponse.json({ error: "An exact WordPress draft identity is required for media repair." }, { status: 409 });
  }
  if (job.featuredImagePresent === true) {
    return NextResponse.json({ job, repaired: false, alreadyComplete: true });
  }

  const site = getSiteById(job.siteId);
  if (!site || site.organizationId !== scope.organizationId) {
    return NextResponse.json({ error: "Configured site was not found in the authorized organization." }, { status: 404 });
  }

  const location = [job.city, job.state].filter(Boolean).join(", ");
  const image = await generateGenesisFeaturedImage({
    prompt: [
      `Photorealistic commercial installation featuring ${job.productTopic}.`,
      location ? `The scene should be appropriate for a commercial project in ${location}.` : "Use a premium commercial architectural environment.",
      `Create a polished website hero visual for ${site.displayName}.`,
      "Show the product clearly and realistically with professional lighting, believable materials, correct scale, and useful negative space.",
    ].join(" "),
    siteName: site.displayName,
    productTopic: job.productTopic,
  });

  if (!image.ok) {
    return NextResponse.json({
      error: image.message,
      code: `IMAGE_${image.state.toUpperCase()}`,
      job,
    }, { status: image.state === "not_configured" ? 503 : 502 });
  }

  const media = await attachGenesisWordPressFeaturedImage({
    site,
    wordpressObjectId: job.wordpressObjectId,
    canonicalSlug: job.slug,
    contentHtml: job.generatedDraft.contentHtml,
    image: image.image,
    title: `${job.productTopic}${location ? ` in ${location}` : ""}`,
    altText: `${job.productTopic}${location ? ` in ${location}` : ""}`,
    description: `Commercial hero image for ${job.productTopic}${location ? ` in ${location}` : ""} on ${site.displayName}.`,
  });

  if (!media.ok) {
    return NextResponse.json({
      error: media.message,
      code: `WORDPRESS_MEDIA_${media.state.toUpperCase()}`,
      job,
    }, { status: 502 });
  }

  const timestamp = new Date().toISOString();
  const repairedJob = await glwPageExecutionRepository.update(job.jobId, {
    status: "COMPLETE",
    featuredImagePresent: true,
    qaStatus: "COMPLETE",
    errorCode: null,
    errorMessage: null,
    updatedAt: timestamp,
    completedAt: timestamp,
  });

  return NextResponse.json({
    job: repairedJob,
    repaired: true,
    media: {
      mediaId: media.mediaId,
      mediaUrl: media.mediaUrl,
    },
  });
}
