import type PocketBase from 'pocketbase';
import type { AuthRecord } from 'pocketbase';
import type { AuthUser, UserRecord } from './types';

export function toAuthUser(record: AuthRecord, pb?: PocketBase): AuthUser | null {
	if (!record) return null;

	const user = record as UserRecord;
	if (!user.id) return null;

	const avatar = user.avatar ?? '';

	return {
		id: user.id,
		email: user.email ?? '',
		name: user.name ?? '',
		avatar,
		avatarUrl: avatar && pb ? pb.files.getURL(user, avatar, { thumb: '96x96' }) : null,
		verified: Boolean(user.verified),
		created: user.created,
		updated: user.updated
	};
}

export function displayName(user: AuthUser | null) {
	if (!user) return 'HomeBrain';
	return user.name || user.email || 'HomeBrain';
}

export function initialsForUser(user: AuthUser | null) {
	const source = displayName(user).trim();
	const parts = source.split(/\s+/).filter(Boolean);

	if (parts.length >= 2) {
		return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
	}

	return source.slice(0, 2).toUpperCase();
}
