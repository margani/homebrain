import type {
	AuthUser,
	EventRecord,
	PromptAnswerRecord,
	RoutineRecord,
	ThingRecord,
	UserRecord
} from '../../src/lib/pocketbase/types';

const now = '2026-06-30T12:00:00.000Z';
const older = '2026-06-29T12:00:00.000Z';

export const fixtureUser: AuthUser = {
	id: 'user_1',
	email: 'test@example.com',
	name: 'Test User',
	avatar: '',
	avatarUrl: null,
	verified: true,
	created: older,
	updated: now
};

export const fixtureUserRecord: UserRecord = {
	id: fixtureUser.id,
	collectionId: '_pb_users_auth_',
	collectionName: 'users',
	email: fixtureUser.email,
	name: fixtureUser.name,
	avatar: '',
	verified: true,
	created: older,
	updated: now
};

export const fixtureThings: ThingRecord[] = [
	{
		id: 'thing_inventory',
		collectionId: 'things',
		collectionName: 'things',
		user: fixtureUser.id,
		name: 'Coffee beans',
		type: 'inventory',
		status: 'low',
		category: 'Groceries',
		location: 'loc_kitchen',
		notes: 'Dark roast for morning coffee',
		created: older,
		updated: now,
		expand: {
			location: {
				id: 'loc_kitchen',
				collectionId: 'locations',
				collectionName: 'locations',
				user: fixtureUser.id,
				name: 'Kitchen',
				path: 'Home / Kitchen',
				created: older,
				updated: now
			}
		}
	},
	{
		id: 'thing_empty',
		collectionId: 'things',
		collectionName: 'things',
		user: fixtureUser.id,
		name: 'Dish soap',
		type: 'inventory',
		status: 'empty',
		category: 'Home',
		location: 'loc_kitchen',
		notes: 'Bottle under the sink is empty',
		created: older,
		updated: '2026-06-30T11:00:00.000Z',
		expand: {
			location: {
				id: 'loc_kitchen',
				collectionId: 'locations',
				collectionName: 'locations',
				user: fixtureUser.id,
				name: 'Kitchen',
				path: 'Home / Kitchen',
				created: older,
				updated: now
			}
		}
	},
	{
		id: 'thing_have',
		collectionId: 'things',
		collectionName: 'things',
		user: fixtureUser.id,
		name: 'Rice',
		type: 'inventory',
		status: 'have',
		category: 'Groceries',
		location: 'loc_kitchen',
		notes: 'Pantry staple',
		created: older,
		updated: '2026-06-29T16:00:00.000Z'
	},
	{
		id: 'thing_routine',
		collectionId: 'things',
		collectionName: 'things',
		user: fixtureUser.id,
		name: 'Water plants',
		type: 'routine',
		status: 'due',
		category: 'Home',
		notes: 'Balcony herbs',
		created: older,
		updated: '2026-06-28T12:00:00.000Z'
	},
	{
		id: 'thing_weight',
		collectionId: 'things',
		collectionName: 'things',
		user: fixtureUser.id,
		name: 'Weight',
		type: 'other',
		status: 'unknown',
		category: 'Health',
		notes: 'Body weight measurements',
		created: older,
		updated: '2026-06-30T07:30:00.000Z'
	},
	{
		id: 'thing_archived',
		collectionId: 'things',
		collectionName: 'things',
		user: fixtureUser.id,
		name: 'Old kettle',
		type: 'inventory',
		status: 'archived',
		category: 'Home',
		notes: 'Retired',
		created: older,
		updated: '2026-06-20T12:00:00.000Z'
	}
];

export const fixtureEvents: EventRecord[] = [
	{
		id: 'event_new_note',
		collectionId: 'events',
		collectionName: 'events',
		user: fixtureUser.id,
		event_type: 'note',
		title: 'Buy coffee',
		notes: 'Buy coffee beans',
		metadata: {},
		happened_at: now,
		created: now,
		updated: now
	},
	{
		id: 'event_reviewed_note',
		collectionId: 'events',
		collectionName: 'events',
		user: fixtureUser.id,
		event_type: 'note',
		title: 'Reviewed note',
		notes: 'Already checked',
		metadata: { reviewed: true },
		happened_at: older,
		created: older,
		updated: older
	},
	{
		id: 'event_dismissed_note',
		collectionId: 'events',
		collectionName: 'events',
		user: fixtureUser.id,
		event_type: 'note',
		title: 'Dismissed note',
		notes: 'Not needed now',
		metadata: { reviewed: true, dismissed: true },
		happened_at: older,
		created: older,
		updated: older
	},
	{
		id: 'event_linked_note',
		collectionId: 'events',
		collectionName: 'events',
		user: fixtureUser.id,
		thing: 'thing_inventory',
		event_type: 'note',
		title: 'Linked note',
		notes: 'About coffee beans',
		metadata: { reviewed: true, linked_to: 'thing' },
		happened_at: older,
		created: older,
		updated: older,
		expand: { thing: fixtureThings[0] }
	},
	{
		id: 'event_activity',
		collectionId: 'events',
		collectionName: 'events',
		user: fixtureUser.id,
		thing: 'thing_routine',
		event_type: 'activity',
		title: 'Morning walk',
		notes: 'Walked around the park',
		metadata: { reviewed: true, activity_type: 'walking', duration_minutes: 30 },
		happened_at: now,
		created: now,
		updated: now,
		expand: { thing: fixtureThings[1] }
	},
	{
		id: 'event_metric_weight',
		collectionId: 'events',
		collectionName: 'events',
		user: fixtureUser.id,
		thing: 'thing_weight',
		event_type: 'metric',
		title: 'Weight: 94 kg',
		notes: 'Morning weigh-in',
		metadata: { metric_value: 94, metric_unit: 'kg', metric_label: 'Weight' },
		happened_at: '2026-06-30T07:30:00.000Z',
		created: '2026-06-30T07:30:00.000Z',
		updated: '2026-06-30T07:30:00.000Z',
		expand: { thing: fixtureThings[4] }
	},
	{
		id: 'event_metric_coffee',
		collectionId: 'events',
		collectionName: 'events',
		user: fixtureUser.id,
		thing: 'thing_inventory',
		event_type: 'metric',
		title: 'Coffee beans: 2 bags',
		notes: 'Cupboard check',
		metadata: { metric_value: 2, metric_unit: 'bags', metric_label: 'Coffee beans' },
		happened_at: '2026-06-29T18:00:00.000Z',
		created: '2026-06-29T18:00:00.000Z',
		updated: '2026-06-29T18:00:00.000Z',
		expand: { thing: fixtureThings[0] }
	}
];

export const fixtureRoutines: RoutineRecord[] = [
	{
		id: 'routine_plants',
		collectionId: 'routines',
		collectionName: 'routines',
		user: fixtureUser.id,
		thing: 'thing_routine',
		name: 'Water plants',
		interval_days: 7,
		next_due_at: '2026-06-30T08:00:00.000Z',
		active: true,
		created: older,
		updated: now,
		expand: { thing: fixtureThings[1] }
	}
];

export const fixturePromptAnswers: PromptAnswerRecord[] = [
	{
		id: 'answer_today',
		collectionId: 'prompt_answers',
		collectionName: 'prompt_answers',
		user: fixtureUser.id,
		prompt: 'prompt_1',
		answer: 'A steady day.',
		answered_at: now,
		metadata: { date: '2026-06-30' },
		created: now,
		updated: now
	}
];
