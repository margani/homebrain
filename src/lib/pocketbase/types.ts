import type { RecordModel } from 'pocketbase';

export type JsonValue =
	| string
	| number
	| boolean
	| null
	| JsonValue[]
	| { [key: string]: JsonValue };

export type ThingType =
	| 'inventory'
	| 'chore'
	| 'personal_care'
	| 'location_item'
	| 'routine'
	| 'note'
	| 'other';

export type ThingStatus = 'ok' | 'low' | 'empty' | 'missing' | 'due' | 'paused' | 'unknown';

export const thingTypeOptions: ThingType[] = [
	'inventory',
	'chore',
	'personal_care',
	'location_item',
	'routine',
	'note',
	'other'
];

export const thingStatusOptions: ThingStatus[] = [
	'ok',
	'low',
	'empty',
	'missing',
	'due',
	'paused',
	'unknown'
];

export type EventType =
	| 'mood'
	| 'note'
	| 'created'
	| 'done'
	| 'bought'
	| 'used'
	| 'found'
	| 'moved'
	| 'observed'
	| 'stock_update'
	| 'reminder'
	| 'other';

export type Mood = 'good' | 'okay' | 'bad' | 'mixed' | 'unknown';

export interface AuthUser {
	id: string;
	email: string;
	name: string;
	avatar: string;
	avatarUrl: string | null;
	verified: boolean;
	created: string;
	updated: string;
}

export interface UserRecord extends RecordModel {
	email: string;
	emailVisibility?: boolean;
	verified?: boolean;
	name?: string;
	avatar?: string;
	created: string;
	updated: string;
}

export interface LocationRecord extends RecordModel {
	user: string;
	name: string;
	path?: string;
	notes?: string;
	created: string;
	updated: string;
}

export interface ThingRecord extends RecordModel {
	user: string;
	name: string;
	type: ThingType;
	status?: ThingStatus;
	location?: string;
	quantity_text?: string;
	quantity_number?: number;
	unit?: string;
	metadata?: JsonValue;
	notes?: string;
	created: string;
	updated: string;
	expand?: {
		location?: LocationRecord;
	};
}

export interface EventRecord extends RecordModel {
	user: string;
	thing?: string;
	event_type: EventType;
	title?: string;
	notes?: string;
	mood?: Mood;
	quantity_change?: number;
	metadata?: JsonValue;
	happened_at?: string;
	created: string;
	updated: string;
	expand?: {
		thing?: ThingRecord;
	};
}

export interface RoutineRecord extends RecordModel {
	user: string;
	thing?: string;
	name: string;
	interval_days?: number;
	last_done_at?: string;
	next_due_at?: string;
	active?: boolean;
	metadata?: JsonValue;
	created: string;
	updated: string;
	expand?: {
		thing?: ThingRecord;
	};
}

export interface PromptRecord extends RecordModel {
	user?: string;
	text: string;
	prompt_type?: 'daily_reflection' | 'mood' | 'task_capture' | 'shopping' | 'custom';
	active?: boolean;
	is_system?: boolean;
	sort_order?: number;
	created: string;
	updated: string;
}

export interface PromptAnswerRecord extends RecordModel {
	user: string;
	prompt: string;
	answer?: string;
	answered_at?: string;
	metadata?: JsonValue;
	created: string;
	updated: string;
	expand?: {
		prompt?: PromptRecord;
	};
}
