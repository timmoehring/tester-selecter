import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { parseGoldenTickets } from "@/lib/parsing/csv-parser";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const entries = await prisma.goldenTicketEntry.findMany({
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(entries);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) {
      return NextResponse.json({ error: "File required" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const entries = parseGoldenTickets(buffer, file.name);

    const created = await prisma.goldenTicketEntry.createMany({
      data: entries
        .filter((e) => e.email || e.username)
        .map((e) => ({
          email: e.email?.toLowerCase(),
          username: e.username,
          priorityLevel: e.priorityLevel || 1,
        })),
      skipDuplicates: true,
    });

    return NextResponse.json({ count: created.count });
  }

  const body = await req.json();
  const entry = await prisma.goldenTicketEntry.create({
    data: {
      email: body.email?.toLowerCase(),
      username: body.username,
      priorityLevel: body.priorityLevel || 1,
      reason: body.reason,
    },
  });

  return NextResponse.json(entry, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await req.json();
  await prisma.goldenTicketEntry.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
