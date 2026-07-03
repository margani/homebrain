import { redirect } from '@sveltejs/kit';
import { getBrowserPb, requireUser } from './client';

export async function loadUserAndPb() {
	try {
		const user = await requireUser();
		if (!user.id) throw new Error('Sign in again before continuing.');
		return { pb: getBrowserPb(), user };
	} catch {
		redirect(303, '/login');
	}
}
