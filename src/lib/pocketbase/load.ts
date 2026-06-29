import { redirect } from '@sveltejs/kit';
import { getBrowserPb, requireUser } from './client';

export async function loadUserAndPb() {
	try {
		const user = await requireUser();
		return { pb: getBrowserPb(), user };
	} catch {
		redirect(303, '/login');
	}
}
