import type { ThingInput } from './data';
import {
	thingStatusOptions,
	thingTypeOptions,
	type JsonValue,
	type ThingStatus,
	type ThingType
} from './types';

export interface ThingFormValues {
	name: string;
	type: string;
	status: string;
	location: string;
	quantity_text: string;
	quantity_number: string;
	unit: string;
	notes: string;
	metadata: string;
	new_location_name: string;
	new_location_path: string;
	new_location_notes: string;
}

export interface ParsedThingForm {
	values: ThingFormValues;
	thing: ThingInput;
	newLocation:
		| {
				name: string;
				path?: string;
				notes?: string;
		  }
		| null;
	error?: string;
}

const defaultThingType: ThingType = 'other';

function value(formData: FormData, key: keyof ThingFormValues) {
	return String(formData.get(key) ?? '').trim();
}

function parseMetadata(raw: string): { value?: JsonValue; error?: string } {
	if (!raw) return {};

	try {
		return { value: JSON.parse(raw) as JsonValue };
	} catch {
		return { error: 'Metadata must be valid JSON.' };
	}
}

export function parseThingFormData(formData: FormData): ParsedThingForm {
	const values: ThingFormValues = {
		name: value(formData, 'name'),
		type: value(formData, 'type'),
		status: value(formData, 'status'),
		location: value(formData, 'location'),
		quantity_text: value(formData, 'quantity_text'),
		quantity_number: value(formData, 'quantity_number'),
		unit: value(formData, 'unit'),
		notes: value(formData, 'notes'),
		metadata: value(formData, 'metadata'),
		new_location_name: value(formData, 'new_location_name'),
		new_location_path: value(formData, 'new_location_path'),
		new_location_notes: value(formData, 'new_location_notes')
	};

	const type = thingTypeOptions.includes(values.type as ThingType)
		? (values.type as ThingType)
		: defaultThingType;
	const status = thingStatusOptions.includes(values.status as ThingStatus)
		? (values.status as ThingStatus)
		: '';

	if (!values.name) {
		return {
			values,
			thing: { name: '', type },
			newLocation: null,
			error: 'Name is required.'
		};
	}

	let quantityNumber: number | undefined;
	if (values.quantity_number) {
		quantityNumber = Number(values.quantity_number);
		if (!Number.isFinite(quantityNumber)) {
			return {
				values,
				thing: { name: values.name, type },
				newLocation: null,
				error: 'Quantity number must be a valid number.'
			};
		}
	}

	const metadata = parseMetadata(values.metadata);
	if (metadata.error) {
		return {
			values,
			thing: { name: values.name, type },
			newLocation: null,
			error: metadata.error
		};
	}

	return {
		values,
		thing: {
			name: values.name,
			type,
			status,
			location: values.location,
			quantity_text: values.quantity_text,
			quantity_number: quantityNumber,
			unit: values.unit,
			notes: values.notes,
			metadata: metadata.value
		},
		newLocation: values.new_location_name
			? {
					name: values.new_location_name,
					path: values.new_location_path,
					notes: values.new_location_notes
				}
			: null
	};
}
