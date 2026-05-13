import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";

function resolveMutationName(mutationKey: unknown): string {
  if (!mutationKey) {
    return "anonymous";
  }
  if (Array.isArray(mutationKey)) {
    return mutationKey.map((item) => String(item)).join(".");
  }
  return String(mutationKey);
}

export const queryClient = new QueryClient({
  defaultOptions: {
    //读数据的重试次数和策略
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: false,
    },
    //写数据的重试次数和策略
    mutations: {
      retry: false,
    },
  },
  queryCache: new QueryCache({
    onError: (error: unknown, query: { queryHash: string }) => {
      if (import.meta.env.DEV) {
        console.error(`[Query Error] ${query.queryHash}`, error);
      }
    },
  }),
  mutationCache: new MutationCache({
    onError: (
      error: unknown,
      _variables: unknown,
      _context: unknown,
      mutation: { options: { mutationKey?: unknown } },
    ) => {
      if (import.meta.env.DEV) {
        console.error(`[Mutation Error] ${resolveMutationName(mutation.options.mutationKey)}`, error);
      }
    },
  }),
});
