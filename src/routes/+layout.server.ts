export function load({ locals }) {
	return {
		pbConfigured: locals.pbConfigured,
		user: locals.user
	};
}
