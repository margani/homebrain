import type PocketBase from 'pocketbase';
import type { AuthUser } from '$lib/pocketbase/types';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			pb: PocketBase;
			pbConfigured: boolean;
			user: AuthUser | null;
		}
		interface PageData {
			pbConfigured: boolean;
			user: AuthUser | null;
		}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
