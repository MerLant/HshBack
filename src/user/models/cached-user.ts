export interface CachedUser {
	id: string;
	nickName: string | null;
	displayName: string | null;
	isBlocked: boolean;
	Role?: {
		name: string;
	};
}
