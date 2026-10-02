import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac/authorize";
import { MIME_BY_EXT, categoryOf, isValidKey, readStoredFile } from "@/lib/storage";

const INLINE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

function notFound() {
  return new Response("Not found", { status: 404 });
}

// Serves uploaded files after checking the viewer may see them. Unauthorized
// requests get a 404 so file keys can't be probed.
export async function GET(_request: Request, ctx: RouteContext<"/api/files/[...key]">) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const key = (await ctx.params).key.join("/");
  if (!isValidKey(key)) return notFound();

  let downloadName: string | undefined;
  switch (categoryOf(key)) {
    case "photos":
      // Profile photos appear across the directory and org chart.
      break;
    case "documents": {
      const doc = await db.employeeDocument.findUnique({ where: { fileKey: key } });
      if (!doc || !can(user, "employee:read", { employeeId: doc.employeeId })) return notFound();
      downloadName = doc.name;
      break;
    }
    case "resumes": {
      const candidate = await db.candidate.findFirst({ where: { resumeKey: key } });
      if (!candidate) return notFound();
      // Recruiters, plus anyone assigned to interview this candidate.
      const interviewing =
        user.employeeId &&
        (await db.interview.count({
          where: {
            application: { candidateId: candidate.id },
            interviewers: { some: { id: user.employeeId } },
          },
        })) > 0;
      if (!can(user, "recruitment:read") && !interviewing) return notFound();
      downloadName = candidate.resumeFileName ?? undefined;
      break;
    }
  }

  const body = await readStoredFile(key);
  if (!body) return notFound();

  const ext = key.split(".").pop() ?? "";
  const type = MIME_BY_EXT[ext] ?? "application/octet-stream";
  const disposition = INLINE_TYPES.has(type) ? "inline" : "attachment";
  const filename = downloadName ? `; filename*=UTF-8''${encodeURIComponent(downloadName)}` : "";

  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": type,
      "Content-Disposition": `${disposition}${filename}`,
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
