import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { backendInterface } from "../backend";
import type { Piece, Sheet } from "../backend.d";
import { createActorWithConfig } from "../config";
import { getSecretParameter } from "../utils/urlParams";
import { useActor } from "./useActor";
import { useInternetIdentity } from "./useInternetIdentity";

// Determines if an error is a canister-stopped / IC0508 error
function isCanisterStoppedError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes("IC0508") ||
    (msg.includes("Canister") && msg.includes("is stopped"))
  );
}

// Re-initializes a fresh actor using the provided identity and retries the operation.
async function withRetryOnAuthError<T>(
  identity: ReturnType<typeof useInternetIdentity>["identity"],
  actor: backendInterface,
  fn: (a: backendInterface) => Promise<T>,
): Promise<T> {
  try {
    return await fn(actor);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isAuthError =
      msg.includes("not registered") ||
      msg.includes("Unauthorized") ||
      msg.includes("rejection");
    const isStoppedError = isCanisterStoppedError(err);

    if ((isAuthError || isStoppedError) && identity) {
      // Create a fresh actor and retry once
      const freshActor = await createActorWithConfig({
        agentOptions: { identity },
      });
      const adminToken = getSecretParameter("caffeineAdminToken") || "";
      try {
        await freshActor._initializeAccessControlWithSecret(adminToken);
      } catch (_) {
        // Already registered -- safe to ignore
      }
      return await fn(freshActor);
    }
    throw err;
  }
}

export function useGetAllProjects() {
  const { actor, isFetching } = useActor();
  return useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getAllProjects();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useCreateProject() {
  const { actor } = useActor();
  const { identity } = useInternetIdentity();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      name,
      sheets,
      pieces,
    }: { name: string; sheets: Sheet[]; pieces: Piece[] }) => {
      if (!actor) throw new Error("Not connected");
      return withRetryOnAuthError(identity, actor, (a) =>
        a.createProject(name, sheets, pieces),
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useUpdateProject() {
  const { actor } = useActor();
  const { identity } = useInternetIdentity();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      name,
      sheets,
      pieces,
    }: { id: string; name: string; sheets: Sheet[]; pieces: Piece[] }) => {
      if (!actor) throw new Error("Not connected");
      return withRetryOnAuthError(identity, actor, (a) =>
        a.updateProject(id, name, sheets, pieces),
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useDeleteProject() {
  const { actor } = useActor();
  const { identity } = useInternetIdentity();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (projectId: string) => {
      if (!actor) throw new Error("Not connected");
      return withRetryOnAuthError(identity, actor, (a) =>
        a.deleteProject(projectId),
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}
