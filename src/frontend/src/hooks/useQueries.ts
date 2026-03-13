import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Piece, Sheet } from "../backend.d";
import { createActorWithConfig } from "../config";
import { getSecretParameter } from "../utils/urlParams";
import { useActor } from "./useActor";
import { useInternetIdentity } from "./useInternetIdentity";

// If the call fails due to authorization, re-initializes and retries once.
async function withEnsureRegistered<T>(
  identity: ReturnType<typeof useInternetIdentity>["identity"],
  fn: () => Promise<T>,
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (
      msg.includes("not registered") ||
      msg.includes("Unauthorized") ||
      msg.includes("rejection")
    ) {
      // Re-initialize and retry once
      if (identity) {
        const freshActor = await createActorWithConfig({
          agentOptions: { identity },
        });
        const adminToken = getSecretParameter("caffeineAdminToken") || "";
        try {
          await freshActor._initializeAccessControlWithSecret(adminToken);
        } catch (_) {}
        return await fn();
      }
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
      return withEnsureRegistered(identity, () =>
        actor.createProject(name, sheets, pieces),
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
      return withEnsureRegistered(identity, () =>
        actor.updateProject(id, name, sheets, pieces),
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
      return withEnsureRegistered(identity, () =>
        actor.deleteProject(projectId),
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}
