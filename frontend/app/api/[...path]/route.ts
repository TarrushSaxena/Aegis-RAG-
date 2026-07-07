export const dynamic = "force-dynamic";

const API_BASE = process.env.API_BASE ?? "http://localhost:8010/api";

type RouteParams = { params: Promise<{ path: string[] }> };

async function proxy(request: Request, { params }: RouteParams): Promise<Response> {
  const { path } = await params;
  const url = new URL(request.url);
  const target = `${API_BASE}/${path.join("/")}${url.search}`;

  const init: RequestInit = { method: request.method };
  if (!["GET", "HEAD", "DELETE"].includes(request.method)) {
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("multipart/form-data")) {
      init.body = await request.formData();
    } else {
      init.body = await request.text();
      init.headers = { "Content-Type": contentType || "application/json" };
    }
  }

  const response = await fetch(target, init);
  return new Response(response.body, { status: response.status, headers: response.headers });
}

export async function GET(request: Request, ctx: RouteParams) {
  return proxy(request, ctx);
}
export async function POST(request: Request, ctx: RouteParams) {
  return proxy(request, ctx);
}
export async function PATCH(request: Request, ctx: RouteParams) {
  return proxy(request, ctx);
}
export async function DELETE(request: Request, ctx: RouteParams) {
  return proxy(request, ctx);
}
