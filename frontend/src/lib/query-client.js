import { QueryClient } from '@tanstack/react-query';

export const queryClientInstance = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			refetchOnMount: false,
			refetchOnReconnect: false,
			staleTime: 5 * 60 * 1000, // 5 minutes - data is fresh for longer
			gcTime: 10 * 60 * 1000, // 10 minutes garbage collection time
			retry: 1,
		},
	},
});