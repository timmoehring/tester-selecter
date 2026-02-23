import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await auth();
  const projects = await prisma.project.findMany({
    where: { userId: session!.user.id },
    orderBy: { updatedAt: "desc" },
    take: 5,
  });

  const projectCount = await prisma.project.count({
    where: { userId: session!.user.id },
  });

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">
          Welcome back, {session!.user.name || session!.user.email}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your beta tester recruitment projects
        </p>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">Total Projects</p>
          <p className="mt-1 text-3xl font-bold">{projectCount}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">Active</p>
          <p className="mt-1 text-3xl font-bold">
            {projects.filter((p) => p.status !== "COMPLETED").length}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">Completed</p>
          <p className="mt-1 text-3xl font-bold">
            {projects.filter((p) => p.status === "COMPLETED").length}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Recent Projects</h2>
        <Link
          href="/dashboard/projects/new"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          New Project
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed border-border p-12 text-center">
          <p className="text-muted-foreground">
            No projects yet. Create your first one to get started.
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/dashboard/projects/${project.id}/upload`}
              className="flex items-center justify-between rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted/50"
            >
              <div>
                <h3 className="font-medium">{project.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {project.description || "No description"}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  {project.status}
                </span>
                <span className="text-xs text-muted-foreground">
                  {project.targetCount} testers
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
